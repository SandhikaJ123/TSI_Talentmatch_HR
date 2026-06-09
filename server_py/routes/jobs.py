"""
routes/jobs.py — Job posting CRUD and vectorisation endpoints.

Endpoints:
  POST   /api/jobs/parse          — parse a JD file/text, return structured preview (no save)
  GET    /api/jobs                — list all jobs (optional ?status filter)
  GET    /api/jobs/:id            — get single job
  POST   /api/jobs                — save a confirmed job; triggers background embedding
  PUT    /api/jobs/:id            — full update
  PATCH  /api/jobs/:id/status     — change status (active / closed / draft)
  GET    /api/jobs/:id/embedding  — check vectorisation status
  POST   /api/jobs/:id/vectorize  — (re)generate embedding on demand
  DELETE /api/jobs/:id            — remove job
"""

import json
import uuid
import asyncio
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from db import db
from services.file_parser import extract_text
from services.job_parser import parse_job_nlp, parse_job_ai
from services.embedding_service import embed_text, vector_to_bytes, bytes_to_vector, build_job_embedding_text
import os

router = APIRouter()
MAX_MB = int(os.getenv("MAX_FILE_SIZE_MB", "10"))


def _parse_job(row) -> dict:
    if row is None:
        return None
    r = dict(row)
    r["required_skills"]     = json.loads(r.get("required_skills") or "[]")
    r["nice_to_have_skills"] = json.loads(r.get("nice_to_have_skills") or "[]")
    r["responsibilities"]    = json.loads(r.get("responsibilities") or "[]")
    r["is_vectorized"]       = bool(r.get("embedding"))
    r.pop("embedding", None)
    return r


@router.post("/parse")
async def parse_job_endpoint(
    file: UploadFile = File(None),
    text: str = Form(""),
    useAI: str = Form("true"),
):
    raw_text = text
    if not raw_text and file:
        data = await file.read()
        raw_text = extract_text(data, file.filename)
    if not raw_text or len(raw_text.strip()) < 30:
        raise HTTPException(400, "Please provide a job description (text or file, min 30 chars).")
    use_ai = useAI != "false" and bool(os.getenv("OPENAI_API_KEY"))
    parsed = await parse_job_ai(raw_text) if use_ai else parse_job_nlp(raw_text)
    return {"parsed": parsed}


@router.get("")
def list_jobs(status: str = None):
    conn = db()
    if status:
        rows = conn.execute("SELECT * FROM jobs WHERE status=? ORDER BY created_at DESC", (status,)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM jobs ORDER BY created_at DESC").fetchall()
    return {"jobs": [_parse_job(r) for r in rows]}


@router.get("/{job_id}/embedding")
def get_job_embedding(job_id: str):
    row = db().execute("SELECT id,title,embedding,embedding_model,embedding_at FROM jobs WHERE id=?", (job_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Job not found")
    r = dict(row)
    return {
        "jobId": r["id"], "title": r["title"],
        "isVectorized": bool(r["embedding"]),
        "embeddingModel": r["embedding_model"],
        "embeddingAt": r["embedding_at"],
        "dims": len(r["embedding"]) // 4 if r["embedding"] else 0,
    }


@router.get("/{job_id}")
def get_job(job_id: str):
    row = db().execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Job not found")
    return {"job": _parse_job(row)}


@router.post("", status_code=201)
async def create_job(body: dict, background_tasks: BackgroundTasks):
    title = (body.get("title") or "").strip()
    description = (body.get("description") or "").strip()
    if not title or not description:
        raise HTTPException(400, "title and description are required")

    job_id = str(uuid.uuid4())
    conn = db()
    conn.execute(
        """INSERT INTO jobs (id,title,department,location,type,description,status,
           min_experience,education_level,required_skills,nice_to_have_skills,
           responsibilities,salary,summary,parsed_by)
           VALUES (?,?,?,?,?,?,'active',?,?,?,?,?,?,?,?)""",
        (
            job_id, title,
            body.get("department", "Engineering"),
            body.get("location", ""),
            body.get("type", "Full-time"),
            description,
            body.get("minExperience", 0),
            body.get("educationLevel", ""),
            json.dumps(body.get("requiredSkills", [])),
            json.dumps(body.get("niceToHaveSkills", [])),
            json.dumps(body.get("responsibilities", [])),
            body.get("salary", ""),
            body.get("summary", ""),
            body.get("parsedBy", "nlp"),
        ),
    )
    conn.commit()
    saved = conn.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone()

    async def _vectorize():
        try:
            emb_text = build_job_embedding_text(dict(saved))
            vector = await embed_text(emb_text)
            blob = vector_to_bytes(vector)
            conn.execute(
                "UPDATE jobs SET embedding=?,embedding_model='text-embedding-3-small',embedding_at=datetime('now') WHERE id=?",
                (blob, job_id),
            )
            conn.commit()
            print(f"✓ Vectorized job \"{title}\" ({job_id})")
        except Exception as e:
            print(f"✗ Embedding failed for \"{title}\": {e}")

    background_tasks.add_task(_vectorize)
    return {"job": _parse_job(saved), "vectorizing": True}


@router.put("/{job_id}")
def update_job(job_id: str, body: dict):
    conn = db()
    if not conn.execute("SELECT id FROM jobs WHERE id=?", (job_id,)).fetchone():
        raise HTTPException(404, "Job not found")
    conn.execute(
        """UPDATE jobs SET title=?,department=?,location=?,type=?,description=?,status=?,
           min_experience=?,education_level=?,required_skills=?,nice_to_have_skills=?,
           responsibilities=?,salary=?,summary=?,updated_at=datetime('now') WHERE id=?""",
        (
            body.get("title"), body.get("department"), body.get("location"),
            body.get("type"), body.get("description"), body.get("status", "active"),
            body.get("minExperience", 0), body.get("educationLevel", ""),
            json.dumps(body.get("requiredSkills", [])),
            json.dumps(body.get("niceToHaveSkills", [])),
            json.dumps(body.get("responsibilities", [])),
            body.get("salary", ""), body.get("summary", ""), job_id,
        ),
    )
    conn.commit()
    return {"job": _parse_job(conn.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone())}


@router.patch("/{job_id}/status")
def patch_job_status(job_id: str, body: dict):
    status = body.get("status")
    if status not in ("active", "closed", "draft"):
        raise HTTPException(400, "status must be one of: active, closed, draft")
    conn = db()
    conn.execute("UPDATE jobs SET status=?,updated_at=datetime('now') WHERE id=?", (status, job_id))
    conn.commit()
    return {"success": True}


@router.post("/{job_id}/vectorize")
async def vectorize_job(job_id: str):
    conn = db()
    row = conn.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Job not found")
    job = dict(row)
    emb_text = build_job_embedding_text(job)
    vector = await embed_text(emb_text)
    blob = vector_to_bytes(vector)
    conn.execute(
        "UPDATE jobs SET embedding=?,embedding_model='text-embedding-3-small',embedding_at=datetime('now') WHERE id=?",
        (blob, job_id),
    )
    conn.commit()
    return {"success": True, "dims": len(vector), "model": "text-embedding-3-small"}


@router.delete("/{job_id}")
def delete_job(job_id: str):
    conn = db()
    # Delete sessions for this job (and their candidates via explicit delete)
    session_ids = [r["id"] for r in conn.execute("SELECT id FROM sessions WHERE job_id=?", (job_id,)).fetchall()]
    if session_ids:
        placeholders = ",".join("?" * len(session_ids))
        conn.execute(f"DELETE FROM candidates WHERE session_id IN ({placeholders})", session_ids)
        conn.execute(f"DELETE FROM sessions WHERE id IN ({placeholders})", session_ids)
    r = conn.execute("DELETE FROM jobs WHERE id=?", (job_id,))
    conn.commit()
    if r.rowcount == 0:
        raise HTTPException(404, "Job not found")
    return {"success": True}
