"""
routes/analytics.py — Reporting and dashboard data endpoints.

Endpoints:
  GET /api/analytics/summary        — aggregate counts (candidates, sessions, jobs),
                                      pipeline stage breakdown, score distribution,
                                      average score, and conversion rate
  GET /api/analytics/sessions-trend — daily session + candidate counts (last 30 days)
  GET /api/analytics/top-skills     — top 15 most frequently matched skills across all candidates
"""

import json
from fastapi import APIRouter
from db import db

router = APIRouter()


@router.get("/summary")
def summary():
    conn = db()
    total_candidates = conn.execute("SELECT COUNT(*) as c FROM candidates").fetchone()["c"]
    total_sessions   = conn.execute("SELECT COUNT(*) as c FROM sessions").fetchone()["c"]
    total_jobs       = conn.execute("SELECT COUNT(*) as c FROM jobs").fetchone()["c"]
    active_jobs      = conn.execute("SELECT COUNT(*) as c FROM jobs WHERE status='active'").fetchone()["c"]
    hired            = conn.execute("SELECT COUNT(*) as c FROM candidates WHERE status='hired'").fetchone()["c"]
    avg_row          = conn.execute("SELECT AVG(final_score) as avg FROM candidates").fetchone()
    avg_score        = avg_row["avg"] or 0

    pipeline = conn.execute("SELECT status, COUNT(*) as count FROM candidates GROUP BY status").fetchall()

    score_dist = [
        {"range": "85-100", "count": conn.execute("SELECT COUNT(*) as c FROM candidates WHERE final_score>=85").fetchone()["c"]},
        {"range": "70-84",  "count": conn.execute("SELECT COUNT(*) as c FROM candidates WHERE final_score>=70 AND final_score<85").fetchone()["c"]},
        {"range": "55-69",  "count": conn.execute("SELECT COUNT(*) as c FROM candidates WHERE final_score>=55 AND final_score<70").fetchone()["c"]},
        {"range": "40-54",  "count": conn.execute("SELECT COUNT(*) as c FROM candidates WHERE final_score>=40 AND final_score<55").fetchone()["c"]},
        {"range": "0-39",   "count": conn.execute("SELECT COUNT(*) as c FROM candidates WHERE final_score<40").fetchone()["c"]},
    ]

    return {
        "totalCandidates": total_candidates,
        "totalSessions": total_sessions,
        "totalJobs": total_jobs,
        "activeJobs": active_jobs,
        "hired": hired,
        "conversionRate": round((hired / total_candidates) * 100) if total_candidates else 0,
        "avgScore": round(avg_score),
        "pipelineCounts": {r["status"]: r["count"] for r in pipeline},
        "scoreDistribution": score_dist,
    }


@router.get("/sessions-trend")
def sessions_trend():
    rows = db().execute(
        """SELECT date(created_at) as date, COUNT(*) as sessions, SUM(result_count) as candidates
           FROM sessions GROUP BY date(created_at) ORDER BY date ASC LIMIT 30"""
    ).fetchall()
    return {"trend": [dict(r) for r in rows]}


@router.get("/top-skills")
def top_skills():
    rows = db().execute("SELECT breakdown FROM candidates").fetchall()
    freq: dict[str, int] = {}
    for r in rows:
        try:
            bd = json.loads(r["breakdown"] or "{}")
            for skill in bd.get("skills", {}).get("matched", []):
                freq[skill] = freq.get(skill, 0) + 1
        except Exception:
            pass
    top = sorted(freq.items(), key=lambda x: x[1], reverse=True)[:15]
    return {"topSkills": [{"skill": s, "count": c} for s, c in top]}
