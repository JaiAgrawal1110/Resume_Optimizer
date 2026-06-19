from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app import cv_parser, groq_service
from app.db import init_db, get_db, MasterCVRow, DEFAULT_USER_ID

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
    return {"status": "ok", "phase": "2 - cv structuring"}


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
    import json
    return {"master_cv": json.loads(row.json_data), "updated_at": str(row.updated_at)}


# Routers will be added here as phases land:
# Phase 3: POST /tailor
# Phase 4-6: latex_service + compilation + page-check loop
# Phase 7: POST /ats-score
