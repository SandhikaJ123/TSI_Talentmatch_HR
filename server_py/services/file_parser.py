"""
services/file_parser.py — Server-side file text extraction.

Extracts plain text from uploaded PDF, DOCX/DOC, and TXT files.
- PDF  → pdfplumber (handles multi-page, preserves layout better than pdf-parse)
- DOCX → python-docx paragraph concatenation
- TXT  → raw UTF-8 decode
Raises ValueError for unsupported extensions or empty/image-only documents.
"""

import io
import re
import pdfplumber
from docx import Document


def extract_text(file_bytes: bytes, filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower()
    if ext == "pdf":
        return _from_pdf(file_bytes)
    if ext in ("docx", "doc"):
        return _from_docx(file_bytes)
    if ext == "txt":
        return file_bytes.decode("utf-8", errors="replace")
    raise ValueError(f"Unsupported file type: .{ext}. Supported: PDF, DOCX, TXT")


def _from_pdf(data: bytes) -> str:
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        pages = [p.extract_text() or "" for p in pdf.pages]
    text = "\n".join(pages)
    text = re.sub(r" {3,}", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    if len(text) < 20:
        raise ValueError("PDF appears to be scanned/image-based. Please use a text-based PDF.")
    return text


def _from_docx(data: bytes) -> str:
    doc = Document(io.BytesIO(data))
    text = "\n".join(p.text for p in doc.paragraphs).strip()
    if len(text) < 20:
        raise ValueError("DOCX file appears to be empty or unreadable.")
    return text
