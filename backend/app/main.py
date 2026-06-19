from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app import cv_parser

app = FastAPI(title="AI Resume Tailor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "ok", "phase": "1 - cv parsing"}


@app.post("/upload-cv")
async def upload_cv(file: UploadFile = File(...)):
    """
    Phase 1: accepts a PDF/DOCX/TXT master CV, validates it, and extracts
    raw text.

    NOTE: This currently returns raw extracted text only. Phase 2 will wire
    in groq_service.structure_cv() to convert this into the canonical
    master_cv JSON schema and persist it to SQLite.
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

    return {
        "filename": file.filename,
        "char_count": len(raw_text),
        "raw_text": raw_text,
        # "master_cv" will appear here once Phase 2 (Groq structuring) lands
    }


# Routers will be added here as phases land:
# Phase 2: groq_service -> CV structuring (called from /upload-cv above)
# Phase 3: POST /tailor
# Phase 4-6: latex_service + compilation + page-check loop
# Phase 7: POST /ats-score
