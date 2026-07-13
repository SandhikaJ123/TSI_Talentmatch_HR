"""
routes/data.py — Bulk data management endpoints.

Endpoints:
  DELETE /api/data/clear-all — delete all candidates, sessions, and jobs in one call
"""

from fastapi import APIRouter
from db import db

router = APIRouter()


@router.delete("/clear-all")
def clear_all():
    conn = db()
    conn.execute("DELETE FROM candidates")
    conn.execute("DELETE FROM sessions")
    conn.execute("DELETE FROM jobs")
    conn.commit()
    return {"success": True}
