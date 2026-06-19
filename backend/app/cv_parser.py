"""
cv_parser.py
Extracts raw text from an uploaded master CV file (PDF, DOCX, or TXT).
This module does NOT structure the content — it just gets clean raw text.
Structuring into the canonical JSON schema happens in groq_service.py (Phase 2).
"""

import io
from typing import Literal

import pdfplumber
from docx import Document

SUPPORTED_EXTENSIONS = {"pdf", "docx", "txt"}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


class UnsupportedFileTypeError(Exception):
    pass


class FileTooLargeError(Exception):
    pass


class EmptyContentError(Exception):
    pass


def get_extension(filename: str) -> str:
    if "." not in filename:
        return ""
    return filename.rsplit(".", 1)[-1].lower()


def validate_upload(filename: str, file_bytes: bytes) -> str:
    """Validates extension and size. Returns the normalized extension."""
    ext = get_extension(filename)
    if ext not in SUPPORTED_EXTENSIONS:
        raise UnsupportedFileTypeError(
            f"Unsupported file type '.{ext}'. Supported types: "
            f"{', '.join(sorted(SUPPORTED_EXTENSIONS))}."
        )
    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise FileTooLargeError(
            f"File exceeds the {MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB limit."
        )
    if len(file_bytes) == 0:
        raise EmptyContentError("Uploaded file is empty.")
    return ext


def extract_text_from_pdf(file_bytes: bytes) -> str:
    text_parts = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
    return "\n".join(text_parts).strip()


def extract_text_from_docx(file_bytes: bytes) -> str:
    doc = Document(io.BytesIO(file_bytes))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]

    # Also pull text out of tables (some resumes use table layouts)
    for table in doc.tables:
        for row in table.rows:
            row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
            if row_text:
                paragraphs.append(row_text)

    return "\n".join(paragraphs).strip()


def extract_text_from_txt(file_bytes: bytes) -> str:
    # Try utf-8 first, fall back to latin-1 for odd encodings
    try:
        return file_bytes.decode("utf-8").strip()
    except UnicodeDecodeError:
        return file_bytes.decode("latin-1").strip()


def extract_text(filename: str, file_bytes: bytes) -> str:
    """
    Main entrypoint: validates the upload, dispatches to the right extractor,
    and returns raw text. Raises on unsupported type, oversized file, or
    empty/unextractable content.
    """
    ext = validate_upload(filename, file_bytes)

    extractors = {
        "pdf": extract_text_from_pdf,
        "docx": extract_text_from_docx,
        "txt": extract_text_from_txt,
    }

    text = extractors[ext](file_bytes)

    if not text or not text.strip():
        raise EmptyContentError(
            "Could not extract any text from this file. "
            "If it's a scanned/image-based PDF, please upload a text-based version instead."
        )

    return text
