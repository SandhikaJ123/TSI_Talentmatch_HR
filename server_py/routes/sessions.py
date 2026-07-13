"""
routes/sessions.py — Matching session management endpoints.

A session is created automatically on each /api/match call and groups
all candidates processed in that run.

Endpoints:
  GET    /api/sessions       — list all sessions with candidate counts
  GET    /api/sessions/:id   — full session detail with all candidates (sorted by score)
  DELETE /api/sessions/:id   — delete session and cascade-delete its candidates
"""

import json
from fastapi import APIRouter, HTTPException
from db import db

router = APIRouter()


def _parse_session(row) -> dict:
    r = dict(row)
    r["preferences"] = json.loads(r.get("preferences") or "{}")
    return r


def _parse_candidate(row) -> dict:
    r = dict(row)
    if isinstance(r.get("breakdown"), str):
        r["breakdown"] = json.loads(r["breakdown"] or "{}")
    r.pop("embedding", None)
    return r


@router.get("")
def list_sessions():
    rows = db().execute(
        """SELECT s.*, COUNT(c.id) as candidate_count
           FROM sessions s LEFT JOIN candidates c ON c.session_id=s.id
           GROUP BY s.id ORDER BY s.created_at DESC"""
    ).fetchall()
    return {"sessions": [_parse_session(r) for r in rows]}


@router.get("/{session_id}")
def get_session(session_id: str):
    conn = db()
    session = conn.execute("SELECT * FROM sessions WHERE id=?", (session_id,)).fetchone()
    if not session:
        raise HTTPException(404, "Session not found")
    candidates = conn.execute(
        "SELECT * FROM candidates WHERE session_id=? ORDER BY final_score DESC", (session_id,)
    ).fetchall()
    return {
        "session": _parse_session(session),
        "candidates": [_parse_candidate(c) for c in candidates],
    }


@router.delete("/{session_id}")
def delete_session(session_id: str):
    conn = db()
    r = conn.execute("DELETE FROM sessions WHERE id=?", (session_id,))
    conn.commit()
    if r.rowcount == 0:
        raise HTTPException(404, "Session not found")
    return {"success": True}
