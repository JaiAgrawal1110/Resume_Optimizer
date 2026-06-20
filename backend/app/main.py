from dotenv import load_dotenv
load_dotenv()

import json

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import cv_parser, groq_service
from app.models import MasterCV
from app.db import (
    init_db,
    get_db,
    MasterCVRow,
    GenerationHistoryRow,
    DEFAULT_USER_ID,
)

app = FastAPI(title="AI Resume Tailor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/health")
def health_check():
    return {"status": "ok", "phase": "3 - tailoring engine"}


@app.post("/upload-cv")
async def upload_cv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Phase 1 + 2: accepts a PDF/DOCX/TXT master CV, extracts raw text,
    structures it into the canonical master_cv JSON via Groq, validates it,
    persists it (one active row per user_id), and returns it for review.
    """
    file_bytes = await file.read()

    try:
        raw_text = cv_parser.extract_text(file.filename, file_bytes)
    except cv_parser.UnsupportedFileTypeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except cv_parser.FileTooLargeError as e:
        raise HTTPException(status_code=413, detail=str(e))
    except cv_parser.EmptyContentError as e:
        raise HTTPException(status_code=422, detail=str(e))

    try:
        master_cv = groq_service.structure_cv(raw_text)
    except groq_service.CVStructuringError as e:
        raise HTTPException(status_code=502, detail=str(e))

    # Upsert: one active master_cv row per user (multi-user-ready via user_id,
    # single user today)
    existing = db.query(MasterCVRow).filter(MasterCVRow.user_id == DEFAULT_USER_ID).first()
    json_data = master_cv.model_dump_json()
    if existing:
        existing.json_data = json_data
        db.add(existing)
    else:
        db.add(MasterCVRow(user_id=DEFAULT_USER_ID, json_data=json_data))
    db.commit()

    return {
        "filename": file.filename,
        "char_count": len(raw_text),
        "master_cv": master_cv.model_dump(),
    }


@app.get("/master-cv")
def get_master_cv(db: Session = Depends(get_db)):
    row = db.query(MasterCVRow).filter(MasterCVRow.user_id == DEFAULT_USER_ID).first()
    if not row:
        raise HTTPException(status_code=404, detail="No master CV uploaded yet.")
    return {"master_cv": json.loads(row.json_data), "updated_at": str(row.updated_at)}


@app.post("/tailor")
async def tailor_resume(
    job_description: str = Form(None),
    jd_file: UploadFile = File(None),
    db: Session = Depends(get_db),
):
    """
    Phase 3: loads the stored master_cv, sends it + the job description to
    Groq for selection/condensing under a one-page content budget and
    JD-keyword optimization, validates the result, logs it to
    generation_history, and returns the tailored JSON.

    Accepts the job description EITHER as:
    - a plain text form field `job_description`, OR
    - a file upload `jd_file` (PDF/DOCX/TXT) — extracted the same way as
      /upload-cv.
    Provide exactly one.

    NOTE: this returns tailored JSON only — LaTeX rendering, PDF
    compilation, and the page-check loop are Phase 4-6, not built yet.
    """
    has_text = bool(job_description and job_description.strip())
    has_file = jd_file is not None and jd_file.filename

    if has_text and has_file:
        raise HTTPException(
            status_code=422,
            detail="Provide either job_description text or jd_file, not both.",
        )
    if not has_text and not has_file:
        raise HTTPException(
            status_code=422,
            detail="Provide a job_description string or a jd_file upload.",
        )

    if has_file:
        file_bytes = await jd_file.read()
        try:
            jd_text = cv_parser.extract_text(jd_file.filename, file_bytes)
        except cv_parser.UnsupportedFileTypeError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except cv_parser.FileTooLargeError as e:
            raise HTTPException(status_code=413, detail=str(e))
        except cv_parser.EmptyContentError as e:
            raise HTTPException(status_code=422, detail=str(e))
    else:
        jd_text = job_description.strip()

    row = db.query(MasterCVRow).filter(MasterCVRow.user_id == DEFAULT_USER_ID).first()
    if not row:
        raise HTTPException(
            status_code=404,
            detail="No master CV found. Upload one via /upload-cv first.",
        )
    master_cv = MasterCV.model_validate(json.loads(row.json_data))

    try:
        tailored_cv = groq_service.tailor_cv(master_cv, jd_text)
    except groq_service.TailoringError as e:
        raise HTTPException(status_code=502, detail=str(e))

    history_row = GenerationHistoryRow(
        user_id=DEFAULT_USER_ID,
        job_description=jd_text,
        tailored_json=tailored_cv.model_dump_json(),
    )
    db.add(history_row)
    db.commit()
    db.refresh(history_row)

    return {
        "generation_id": history_row.id,
        "tailored_cv": tailored_cv.model_dump(),
    }


@app.get("/history")
def get_history(db: Session = Depends(get_db)):
    rows = (
        db.query(GenerationHistoryRow)
        .filter(GenerationHistoryRow.user_id == DEFAULT_USER_ID)
        .order_by(GenerationHistoryRow.created_at.desc())
        .all()
    )
    return {
        "history": [
            {
                "id": r.id,
                "job_description_snippet": (r.job_description or "")[:200],
                "ats_score": r.ats_score,
                "pdf_path": r.pdf_path,
                "created_at": str(r.created_at),
            }
            for r in rows
        ]
    }


# Routers will be added here as phases land:
# Phase 4-6: latex_service + compilation + page-check loop
# Phase 7: POST /ats-score