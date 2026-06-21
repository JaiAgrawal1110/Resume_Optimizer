from dotenv import load_dotenv
load_dotenv()

import json
import os

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import cv_parser, groq_service, latex_service
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

    # Phase 5 + 6: render to LaTeX, compile to PDF, and if it overflows one
    # page, re-prompt the AI to trim and recompile (up to 3 attempts).
    page_count = None
    pdf_warning = None
    trim_attempts = 0
    MAX_TRIM_ATTEMPTS = 3

    try:
        tex_source = latex_service.render_tex(tailored_cv)
        latex_service.save_tex(tex_source, history_row.id)
        pdf_path = latex_service.compile_pdf(history_row.id)
        page_count = latex_service.count_pdf_pages(pdf_path)

        while page_count > 1 and trim_attempts < MAX_TRIM_ATTEMPTS:
            trim_attempts += 1
            try:
                tailored_cv = groq_service.trim_cv(tailored_cv, jd_text)
            except groq_service.TailoringError:
                break  # trim attempt itself failed; stop trying, keep last good PDF
            tex_source = latex_service.render_tex(tailored_cv)
            latex_service.save_tex(tex_source, history_row.id)
            pdf_path = latex_service.compile_pdf(history_row.id)
            page_count = latex_service.count_pdf_pages(pdf_path)

        history_row.pdf_path = str(pdf_path)
        history_row.tailored_json = tailored_cv.model_dump_json()  # may have been trimmed
        db.add(history_row)
        db.commit()

        if page_count > 1:
            pdf_warning = (
                f"Resume still spans {page_count} pages after {trim_attempts} "
                "trim attempts. Returning the best version achieved — consider "
                "manually shortening the master CV for this role."
            )
    except latex_service.LatexRenderError as e:
        # Don't fail the whole request — the tailored JSON is still valid
        # and useful even if rendering broke. Surface the error instead.
        pdf_warning = str(e)

    return {
        "generation_id": history_row.id,
        "tailored_cv": tailored_cv.model_dump(),
        "pdf_ready": pdf_warning is None,
        "page_count": page_count,
        "trim_attempts": trim_attempts,
        "pdf_warning": pdf_warning,
    }


@app.get("/download/{generation_id}")
def download_resume(generation_id: int, db: Session = Depends(get_db)):
    from fastapi.responses import FileResponse

    row = (
        db.query(GenerationHistoryRow)
        .filter(GenerationHistoryRow.id == generation_id, GenerationHistoryRow.user_id == DEFAULT_USER_ID)
        .first()
    )
    if not row or not row.pdf_path:
        raise HTTPException(status_code=404, detail="No compiled PDF found for this generation.")
    pdf_path = row.pdf_path
    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail="PDF file is missing from disk.")
    return FileResponse(pdf_path, media_type="application/pdf", filename=f"resume_{generation_id}.pdf")


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


@app.post("/ats-score/{generation_id}")
def ats_score(generation_id: int, db: Session = Depends(get_db)):
    """
    Phase 7: scores a previously tailored resume against the job
    description it was generated for. Looks up both from generation_history
    by id (no need to re-paste the JD).
    """
    row = (
        db.query(GenerationHistoryRow)
        .filter(GenerationHistoryRow.id == generation_id, GenerationHistoryRow.user_id == DEFAULT_USER_ID)
        .first()
    )
    if not row or not row.tailored_json:
        raise HTTPException(status_code=404, detail="No tailored resume found for this generation.")

    tailored_cv = MasterCV.model_validate(json.loads(row.tailored_json))
    resume_text_parts = [tailored_cv.name, tailored_cv.summary or ""]
    for category, items in tailored_cv.skills.items():
        resume_text_parts.append(f"{category}: {', '.join(items)}")
    for exp in tailored_cv.experience:
        resume_text_parts.append(f"{exp.title} at {exp.organization}: " + " ".join(exp.bullets))
    for proj in tailored_cv.projects:
        resume_text_parts.append(f"{proj.name}: " + " ".join(proj.bullets))
    resume_text = "\n".join(p for p in resume_text_parts if p)

    try:
        result = groq_service.score_ats(resume_text, row.job_description)
    except groq_service.ATSScoringError as e:
        raise HTTPException(status_code=502, detail=str(e))

    row.ats_score = result["score"]
    db.add(row)
    db.commit()

    return {"generation_id": generation_id, **result}


# Routers will be added here as phases land:
# Phase 8: Frontend
# Phase 9: Integration & hardening