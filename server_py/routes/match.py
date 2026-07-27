"""
routes/match.py — Resume matching endpoint.

Endpoint:
  POST /api/match  — accepts multipart form with:
    - resumes[]          one or more resume files (PDF/DOCX/TXT, up to 50)
    - requirements       optional JD file
    - requirementsText   optional JD plain text
    - jobId               optional saved job ID (loads stored embedding)
    - jobTitle            optional session label
    - preferences         JSON weights for skills / experience / education / overall

Flow: extract text → hybrid match (NLP + semantic) → persist session &
candidates to SQLite → return ranked results with session ID.
"""

import json
import uuid
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from db import db
from services.file_parser import extract_text
from services.hybrid_matcher import match_resumes_hybrid
from services.embedding_service import embed_batch, vector_to_bytes, bytes_to_vector, build_resume_embedding_text
import os

router = APIRouter()

MAX_CUSTOM_CRITERIA = 5
MAX_TERM_LENGTH = 150


def sanitize_custom_criteria(raw):
    if not isinstance(raw, list):
        return []
    out = []
    for i, c in enumerate(raw):
        if not isinstance(c, dict):
            continue
        term = str(c.get("term", "")).strip()
        if not term or c.get("enabled") is False:
            continue
        try:
            weight = float(c.get("weight", 0))
        except (TypeError, ValueError):
            weight = 0
        weight = max(0, min(50, weight))
        if weight <= 0:
            continue
        out.append({"id": c.get("id") or f"custom_{i}", "term": term[:MAX_TERM_LENGTH], "weight": weight})
        if len(out) >= MAX_CUSTOM_CRITERIA:
            break
    return out

@router.post("")
async def match_resumes(
    resumes: list[UploadFile] = File(...),
    requirements: UploadFile = File(None),
    requirementsText: str = Form(""),
    jobId: str = Form(""),
    jobTitle: str = Form(""),
    preferences: str = Form("{}"),
):
    conn = db()

    # 1. Requirements text
    req_text = requirementsText
    if not req_text and requirements:
        data = await requirements.read()
        req_text = extract_text(data, requirements.filename)

    job_row = None
    if jobId:
        job_row = conn.execute("SELECT * FROM jobs WHERE id=?", (jobId,)).fetchone()
        if job_row and not req_text:
            req_text = dict(job_row)["description"]

    if not req_text or not req_text.strip():
        raise HTTPException(400, "Job requirements are required (text or file).")

    # 2. Parse resumes
    if not resumes:
        raise HTTPException(400, "At least one resume file is required.")

    parse_errors = []
    parsed_resumes = []
    for f in resumes:
        try:
            data = await f.read()
            text = extract_text(data, f.filename)
            name = f.filename.rsplit(".", 1)[0].replace("-", " ").replace("_", " ")
            parsed_resumes.append({"name": name, "fileName": f.filename, "fileSize": len(data), "text": text})
        except Exception as e:
            parse_errors.append({"file": f.filename, "error": str(e)})

    if not parsed_resumes:
        raise HTTPException(400, "Could not parse any resume files.")

    # 3. Preferences
    try:
        prefs_raw = json.loads(preferences)
    except Exception:
        raise HTTPException(400, "Invalid preferences JSON.")
    prefs = {
        "skillsWeight":     float(prefs_raw.get("skillsWeight", 40)),
        "experienceWeight": float(prefs_raw.get("experienceWeight", 25)),
        "educationWeight":  float(prefs_raw.get("educationWeight", 20)),
        "overallWeight":    float(prefs_raw.get("overallWeight", 15)),
        "customCriteria":   sanitize_custom_criteria(prefs_raw.get("customCriteria")),
    }

    # 4. Job embedding
    job_vector = None
    if job_row and dict(job_row).get("embedding"):
        job_vector = bytes_to_vector(dict(job_row)["embedding"])

    # 5. Match
    results = await match_resumes_hybrid(req_text, parsed_resumes, prefs, job_vector)

    # 6. Resume embeddings for storage
    resume_embeddings = None
    if os.getenv("OPENAI_API_KEY"):
        try:
            texts = [build_resume_embedding_text(r) for r in parsed_resumes]
            resume_embeddings = await embed_batch(texts)
        except Exception as e:
            print(f"Resume embedding failed: {e}")

    # 7. Persist session + candidates
    session_id = str(uuid.uuid4())
    final_job_title = jobTitle or (dict(job_row)["title"] if job_row else "Untitled Session")
    valid_job_id = jobId if job_row else None

    conn.execute(
        "INSERT INTO sessions (id,job_id,job_title,preferences,result_count) VALUES (?,?,?,?,?)",
        (session_id, valid_job_id, final_job_title, json.dumps(prefs), len(results)),
    )

    for i, c in enumerate(results):
        res_idx = next((j for j, r in enumerate(parsed_resumes) if r["fileName"] == c["fileName"]), None)
        resume = parsed_resumes[res_idx] if res_idx is not None else {}
        vec = resume_embeddings[res_idx] if resume_embeddings and res_idx is not None else None
        conn.execute(
            """INSERT INTO candidates
                (id,session_id,name,file_name,file_size,raw_text,
                final_score,grade_label,grade_color,
                breakdown,title,location,email,phone,
                strengths,weaknesses,summary,
                interview_focus_areas,interview_questions,top_interview_questions,
                embedding,embedding_model)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                str(uuid.uuid4()), session_id, c["name"], c["fileName"],
                resume.get("fileSize", 0),
                (resume.get("text") or ""),
                c["finalScore"], c["grade"]["label"], c["grade"]["color"],
                json.dumps(c["breakdown"]),
                c.get("title"), c.get("location"), c.get("email"), c.get("phone"),
                json.dumps(c.get("strengths", [])),
                json.dumps(c.get("weaknesses", [])),
                c.get("summary"),
                json.dumps(c.get("interviewFocusAreas", [])),
                json.dumps(c.get("interviewQuestions", [])),
                json.dumps(c.get("topInterviewQuestions", [])),
                vector_to_bytes(vec) if vec else None,
                "text-embedding-3-small" if vec else None,
            ),
        )
    conn.commit()

    return {
        "sessionId": session_id,
        "jobTitle": final_job_title,
        "scoredBy": results[0].get("scoredBy", "hybrid") if results else "hybrid",
        "semanticEnabled": bool(job_vector),
        "totalParsed": len(parsed_resumes),
        "parseErrors": parse_errors,
        "results": results,
    }