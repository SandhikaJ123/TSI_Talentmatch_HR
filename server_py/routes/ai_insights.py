"""
routes/ai_insights.py — AI-powered candidate analysis endpoints.

Supports OpenAI (GPT-4o) and Anthropic Claude (claude-3-5-sonnet).
Requires OPENAI_API_KEY or ANTHROPIC_API_KEY; returns 503 when neither is configured.

Endpoints:
  POST /api/ai-insights/explain-candidate  — full structured breakdown of a candidate's
                                              score with strengths, risks, and interview focus areas
  POST /api/ai-insights/compare-candidates — side-by-side comparison of 2-5 candidates
                                              with ranking and hiring recommendation
  POST /api/ai-insights/explain-score      — 2-3 sentence plain-English explanation of
                                              a single score dimension
"""

import json
import os
from datetime import datetime
from fastapi import APIRouter, HTTPException
from openai import AsyncOpenAI
import anthropic
from db import db

router = APIRouter()

_openai_client = None
_anthropic_client = None


def _get_provider() -> str:
    if os.getenv("OPENAI_API_KEY"):
        return "openai"
    if os.getenv("ANTHROPIC_API_KEY"):
        return "anthropic"
    return ""


def _ai_enabled():
    return bool(_get_provider())


def _get_openai():
    global _openai_client
    if _openai_client is None:
        _openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    return _openai_client


def _get_anthropic():
    global _anthropic_client
    if _anthropic_client is None:
        _anthropic_client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    return _anthropic_client


async def _chat_json(prompt: str, max_tokens: int = 1500) -> str:
    """Send a prompt and return the raw text response."""
    provider = _get_provider()
    if provider == "openai":
        resp = await _get_openai().chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=max_tokens,
            response_format={"type": "json_object"},
        )
        return resp.choices[0].message.content
    else:
        resp = await _get_anthropic().messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=max_tokens,
            temperature=0.3,
            messages=[{"role": "user", "content": prompt}],
        )
        text = resp.content[0].text.strip()
        if "```" in text:
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return text


async def _chat_text(prompt: str, max_tokens: int = 200) -> str:
    """Send a prompt and return plain text response."""
    provider = _get_provider()
    if provider == "openai":
        resp = await _get_openai().chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=max_tokens,
        )
        return resp.choices[0].message.content.strip()
    else:
        resp = await _get_anthropic().messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=max_tokens,
            temperature=0.3,
            messages=[{"role": "user", "content": prompt}],
        )
        return resp.content[0].text.strip()


def _fetch_candidate(candidate_id: str):
    row = db().execute(
        """SELECT c.*,s.job_title,j.description as job_description
           FROM candidates c JOIN sessions s ON c.session_id=s.id
           LEFT JOIN jobs j ON s.job_id=j.id WHERE c.id=?""",
        (candidate_id,),
    ).fetchone()
    return dict(row) if row else None


@router.post("/explain-candidate")
async def explain_candidate(body: dict):
    if not _ai_enabled():
        raise HTTPException(503, "AI features not available. Set OPENAI_API_KEY or ANTHROPIC_API_KEY.")
    candidate_id = body.get("candidateId")
    if not candidate_id:
        raise HTTPException(400, "candidateId is required")
    candidate = _fetch_candidate(candidate_id)
    if not candidate:
        raise HTTPException(404, "Candidate not found")

    bd = json.loads(candidate.get("breakdown") or "{}")
    prompt = f"""You are an expert HR analyst. Provide a detailed, professional explanation of this candidate's resume evaluation.

CANDIDATE: {candidate['name']}
JOB POSITION: {candidate['job_title']}
SCORES:
- Final Score: {candidate['final_score']}%
- Skills: {bd.get('skills',{}).get('score',0)}%
- Experience: {bd.get('experience',{}).get('score',0)}%
- Education: {bd.get('education',{}).get('score',0)}%
- Overall Fit: {bd.get('tfidf',{}).get('score',0)}%
MATCHED SKILLS: {', '.join(bd.get('skills',{}).get('matched',[]) or ['None'])}
MISSING SKILLS: {', '.join(bd.get('skills',{}).get('missing',[]) or ['None'])}
EXPERIENCE: {bd.get('experience',{}).get('detectedYears',0)} years detected
EDUCATION: {bd.get('education',{}).get('label','Not specified')}
{('JOB REQUIREMENTS:\n' + (candidate.get('job_description') or '')[:1500]) if candidate.get('job_description') else ''}

Provide a comprehensive analysis in JSON format with keys: overallAssessment, scoreBreakdown (skills/experience/education/overallFit), keyStrengths, keyWeaknesses, missingCriticalSkills, developmentAreas, recommendation, interviewFocus, hiringRisk, riskFactors."""

    return {
        "candidateId": candidate_id,
        "candidateName": candidate["name"],
        "finalScore": candidate["final_score"],
        "insights": json.loads(await _chat_json(prompt, max_tokens=1500)),
        "generatedAt": datetime.utcnow().isoformat(),
    }


@router.post("/compare-candidates")
async def compare_candidates(body: dict):
    if not _ai_enabled():
        raise HTTPException(503, "AI features not available. Set OPENAI_API_KEY or ANTHROPIC_API_KEY.")
    ids = body.get("candidateIds", [])
    if not isinstance(ids, list) or len(ids) < 2:
        raise HTTPException(400, "At least 2 candidateIds are required")
    if len(ids) > 5:
        raise HTTPException(400, "Maximum 5 candidates can be compared at once")

    placeholders = ",".join("?" * len(ids))
    rows = db().execute(
        f"""SELECT c.*,s.job_title,j.description as job_description
            FROM candidates c JOIN sessions s ON c.session_id=s.id
            LEFT JOIN jobs j ON s.job_id=j.id WHERE c.id IN ({placeholders})""",
        ids,
    ).fetchall()
    if len(rows) < 2:
        raise HTTPException(404, "Not enough candidates found")

    candidates_data = []
    for r in rows:
        c = dict(r)
        bd = json.loads(c.get("breakdown") or "{}")
        candidates_data.append({
            "name": c["name"], "finalScore": c["final_score"], "grade": c.get("grade_label"),
            "skills": {"score": bd.get("skills",{}).get("score",0), "matched": bd.get("skills",{}).get("matched",[]), "missing": bd.get("skills",{}).get("missing",[])},
            "experience": {"score": bd.get("experience",{}).get("score",0), "years": bd.get("experience",{}).get("detectedYears",0)},
            "education": {"score": bd.get("education",{}).get("score",0), "level": bd.get("education",{}).get("label","Not specified")},
        })

    job_title = dict(rows[0])["job_title"]
    job_desc = (dict(rows[0]).get("job_description") or "")[:1000]
    candidate_block = "\n".join(
        f"{i+1}. {c['name']}\n   - Final Score: {c['finalScore']}% ({c['grade']})\n"
        f"   - Skills: {c['skills']['score']}% | Matched: {', '.join(c['skills']['matched']) or 'None'}\n"
        f"   - Experience: {c['experience']['score']}% ({c['experience']['years']} yrs)\n"
        f"   - Education: {c['education']['score']}% ({c['education']['level']})"
        for i, c in enumerate(candidates_data)
    )

    prompt = f"""You are an expert HR analyst comparing candidates for: {job_title}
{('JOB REQUIREMENTS: ' + job_desc) if job_desc else ''}

CANDIDATES:
{candidate_block}

Provide comparison JSON with keys: summary, topCandidate, topCandidateReason, ranking (array with name/rank/reasoning), comparisonMatrix (skills/experience/education/overallFit), uniqueStrengths (by name), recommendation, alternativeScenarios."""

    return {
        "jobTitle": job_title,
        "candidateCount": len(rows),
        "candidates": candidates_data,
        "comparison": json.loads(await _chat_json(prompt, max_tokens=2000)),
        "generatedAt": datetime.utcnow().isoformat(),
    }


@router.post("/explain-score")
async def explain_score(body: dict):
    if not _ai_enabled():
        raise HTTPException(503, "AI features not available. Set OPENAI_API_KEY or ANTHROPIC_API_KEY.")
    candidate_id = body.get("candidateId")
    score_type   = body.get("scoreType")
    valid_types  = {"skills", "experience", "education", "overall", "final"}
    if not candidate_id or not score_type:
        raise HTTPException(400, "candidateId and scoreType are required")
    if score_type not in valid_types:
        raise HTTPException(400, f"Invalid scoreType. Must be one of: {', '.join(valid_types)}")

    row = db().execute(
        "SELECT c.*,s.job_title FROM candidates c JOIN sessions s ON c.session_id=s.id WHERE c.id=?",
        (candidate_id,),
    ).fetchone()
    if not row:
        raise HTTPException(404, "Candidate not found")
    c = dict(row)
    bd = json.loads(c.get("breakdown") or "{}")

    score_map = {
        "skills":     (bd.get("skills",{}).get("score",0), f"Matched: {', '.join(bd.get('skills',{}).get('matched',[]))}, Missing: {', '.join(bd.get('skills',{}).get('missing',[]))}"),
        "experience": (bd.get("experience",{}).get("score",0), f"{bd.get('experience',{}).get('detectedYears',0)} years detected"),
        "education":  (bd.get("education",{}).get("score",0), bd.get("education",{}).get("label","Not specified")),
        "overall":    (bd.get("tfidf",{}).get("score",0), "Overall fit and relevance"),
        "final":      (c["final_score"], "Weighted average of all scores"),
    }
    score_value, score_details = score_map[score_type]

    return {
        "candidateId": candidate_id,
        "candidateName": c["name"],
        "scoreType": score_type,
        "scoreValue": score_value,
        "explanation": await _chat_text(
            f"Explain in 2-3 clear sentences why this candidate received a {score_value}% score for {score_type}.\n\n"
            f"Candidate: {c['name']}\nPosition: {c['job_title']}\nScore: {score_value}%\nDetails: {score_details}\n\n"
            f"Provide a brief, professional explanation."
        ),
        "generatedAt": datetime.utcnow().isoformat(),
    }
