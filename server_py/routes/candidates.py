"""
routes/candidates.py — Candidate management and export endpoints.

Endpoints:
  GET    /api/candidates                  — paginated list with optional filters
                                            (?status, ?sessionId, ?search, ?sortBy, ?order, ?limit, ?offset)
  GET    /api/candidates/export/csv       — download filtered candidates as CSV
  POST   /api/candidates/interview-pdf    — generate interview guide PDF for a candidate
  GET    /api/candidates/:id              — single candidate detail
  PATCH  /api/candidates/:id              — update status (new/shortlisted/interview/offered/hired/rejected)
                                            and/or recruiter notes
"""

import json
import io
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from db import db

router = APIRouter()

ALLOWED_SORT = {"final_score", "name", "created_at", "status"}
ALLOWED_STATUS = {"new", "shortlisted", "interview", "offered", "hired", "rejected"}


def _parse_candidate(row) -> dict:
    r = dict(row)
    for field in ("breakdown", "preferences"):
        if isinstance(r.get(field), str):
            r[field] = json.loads(r[field] or "{}")
    for field in ("strengths", "weaknesses"):
        if isinstance(r.get(field), str):
            r[field] = json.loads(r[field] or "[]")
    r.pop("embedding", None)
    return r


@router.get("/export/csv")
def export_csv(status: str = None, sessionId: str = None):
    conn = db()
    query = "SELECT c.*,s.job_title FROM candidates c JOIN sessions s ON s.id=c.session_id WHERE 1=1"
    params = []
    if status:
        query += " AND c.status=?"; params.append(status)
    if sessionId:
        query += " AND c.session_id=?"; params.append(sessionId)
    query += " ORDER BY c.final_score DESC"
    rows = [_parse_candidate(r) for r in conn.execute(query, params).fetchall()]

    headers = ["Name","File","Job","Score","Grade","Status","Skills Score","Exp Score","Edu Score","Matched Skills","Missing Skills","Notes"]
    def _row(c):
        bd = c.get("breakdown", {})
        return [
            c["name"], c["file_name"], c.get("job_title",""), c["final_score"],
            c.get("grade_label",""), c.get("status",""),
            bd.get("skills",{}).get("score",""),
            bd.get("experience",{}).get("score",""),
            bd.get("education",{}).get("score",""),
            ";".join(bd.get("skills",{}).get("matched",[])),
            ";".join(bd.get("skills",{}).get("missing",[])),
            c.get("notes","") or "",
        ]

    def _quote(v):
        return f'"{str(v or "").replace(chr(34), chr(34)+chr(34))}"'

    csv_lines = [",".join(_quote(h) for h in headers)]
    for c in rows:
        csv_lines.append(",".join(_quote(v) for v in _row(c)))
    csv_content = "\n".join(csv_lines)

    return StreamingResponse(
        io.StringIO(csv_content),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="candidates.csv"'},
    )


@router.get("")
def list_candidates(
    status: str = None, sessionId: str = None, search: str = None,
    sortBy: str = "final_score", order: str = "DESC",
    limit: int = 100, offset: int = 0,
):
    conn = db()
    sort_col = sortBy if sortBy in ALLOWED_SORT else "final_score"
    sort_order = "ASC" if order.upper() == "ASC" else "DESC"

    query = "SELECT c.*,s.job_title FROM candidates c JOIN sessions s ON s.id=c.session_id WHERE 1=1"
    count_query = "SELECT COUNT(*) as count FROM candidates c JOIN sessions s ON s.id=c.session_id WHERE 1=1"
    params = []

    if status:
        query += " AND c.status=?"; count_query += " AND c.status=?"; params.append(status)
    if sessionId:
        query += " AND c.session_id=?"; count_query += " AND c.session_id=?"; params.append(sessionId)
    if search:
        query += " AND (c.name ILIKE ? OR s.job_title ILIKE ?)"; count_query += " AND (c.name ILIKE ? OR s.job_title ILIKE ?)"
        params.extend([f"%{search}%", f"%{search}%"])

    total = conn.execute(count_query, params).fetchone()["count"]
    query += f" ORDER BY c.{sort_col} {sort_order} LIMIT ? OFFSET ?"
    rows = conn.execute(query, params + [limit, offset]).fetchall()

    return {
        "candidates": [_parse_candidate(r) for r in rows],
        "total": total, "limit": limit, "offset": offset,
    }


@router.post("/interview-pdf")
async def generate_interview_pdf(request: Request):
    import traceback
    try:
        from fpdf import FPDF
    except ImportError:
        raise HTTPException(500, "fpdf2 is required. Run: pip install fpdf2")

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid JSON body")

    name = str(body.get("name", "Candidate"))
    questions = body.get("interviewQuestions") or []
    focus_areas = body.get("interviewFocusAreas") or []

    if not questions:
        raise HTTPException(400, "No interview questions provided")

    def _safe(text: str) -> str:
        return text.encode("latin-1", errors="replace").decode("latin-1")

    try:
        pdf = FPDF()
        pdf.set_margins(15, 15, 15)
        pdf.add_page()

        # Title block
        pdf.set_font("Helvetica", "B", 18)
        pdf.cell(0, 12, "Interview Guide", new_x="LMARGIN", new_y="NEXT", align="C")
        pdf.set_font("Helvetica", "", 13)
        pdf.cell(0, 8, _safe(name), new_x="LMARGIN", new_y="NEXT", align="C")
        pdf.ln(4)

        # Divider
        pdf.set_draw_color(130, 80, 200)
        pdf.set_line_width(0.5)
        y = pdf.get_y()
        pdf.line(15, y, 195, y)
        pdf.ln(6)

        # Focus areas section
        if focus_areas:
            pdf.set_font("Helvetica", "B", 12)
            pdf.cell(0, 8, "Interview Focus Areas", new_x="LMARGIN", new_y="NEXT")
            pdf.ln(1)
            pdf.set_font("Helvetica", "", 11)
            for i, area in enumerate(focus_areas, 1):
                pdf.set_x(pdf.l_margin)
                pdf.multi_cell(pdf.epw, 7, f"  {i}. {_safe(str(area))}")
            pdf.ln(4)

        # Questions section
        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(0, 8, "Gap-Focused Interview Questions", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(1)
        pdf.set_font("Helvetica", "", 11)
        for i, q in enumerate(questions, 1):
            pdf.set_x(pdf.l_margin)
            pdf.multi_cell(pdf.epw, 7, f"{i}. {_safe(str(q))}")
            pdf.ln(3)

        pdf_bytes = bytes(pdf.output())
    except Exception:
        traceback.print_exc()
        raise HTTPException(500, "PDF generation failed — see server console for details")

    safe_name = "".join(c if c.isalnum() or c in " _-" else "_" for c in name).replace(" ", "_")

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}_Interview_Guide.pdf"'},
    )


@router.get("/{candidate_id}")
def get_candidate(candidate_id: str):
    row = db().execute(
        "SELECT c.*,s.job_title,s.preferences FROM candidates c JOIN sessions s ON s.id=c.session_id WHERE c.id=?",
        (candidate_id,),
    ).fetchone()
    if not row:
        raise HTTPException(404, "Candidate not found")
    return {"candidate": _parse_candidate(row)}


@router.delete("/{candidate_id}")
def delete_candidate(candidate_id: str):
    conn = db()
    # Get session_id before deleting
    row = conn.execute("SELECT session_id FROM candidates WHERE id=?", (candidate_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Candidate not found")
    session_id = row["session_id"]

    conn.execute("DELETE FROM candidates WHERE id=?", (candidate_id,))

    # If session has no more candidates, delete the session too
    remaining = conn.execute("SELECT COUNT(*) as c FROM candidates WHERE session_id=?", (session_id,)).fetchone()["c"]
    if remaining == 0:
        conn.execute("DELETE FROM sessions WHERE id=?", (session_id,))

    conn.commit()
    return {"success": True}


@router.patch("/{candidate_id}")
async def patch_candidate(candidate_id: str, request: Request):
    body = await request.json()
    status = body.get("status")
    notes  = body.get("notes")
    if status and status not in ALLOWED_STATUS:
        raise HTTPException(400, f"Invalid status. Must be one of: {', '.join(ALLOWED_STATUS)}")
    conn = db()
    if not conn.execute("SELECT id FROM candidates WHERE id=?", (candidate_id,)).fetchone():
        raise HTTPException(404, "Candidate not found")
    updates, params = [], []
    if status is not None:
        updates.append("status=?"); params.append(status)
    if notes is not None:
        updates.append("notes=?"); params.append(notes)
    updates.append("updated_at=datetime('now')")
    conn.execute(f"UPDATE candidates SET {','.join(updates)} WHERE id=?", params + [candidate_id])
    conn.commit()
    return {"candidate": _parse_candidate(conn.execute("SELECT * FROM candidates WHERE id=?", (candidate_id,)).fetchone())}
