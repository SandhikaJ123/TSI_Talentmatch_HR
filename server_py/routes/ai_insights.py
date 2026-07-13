"""
routes/ai_insights.py — AI-powered candidate analysis endpoints.

Primary provider: Anthropic Claude (ANTHROPIC_API_KEY).
Fallback provider: OpenAI (OPENAI_API_KEY), if set.
Returns 503 when neither key is configured.

Endpoints:
  POST /api/ai-insights/explain-candidate  — full structured breakdown of a candidate
  POST /api/ai-insights/compare-candidates — side-by-side comparison of 2-5 candidates
  POST /api/ai-insights/explain-score      — plain-English explanation of one score dimension
"""

import json
import re
import os
from datetime import datetime
from fastapi import APIRouter, HTTPException, Request
import anthropic
from db import db

router = APIRouter()

_anthropic_client = None
_openai_client = None


# ── Provider helpers ───────────────────────────────────────────────────────────

def _get_provider() -> str:
    """Anthropic is preferred; OpenAI used only if Anthropic key is absent."""
    if os.getenv("ANTHROPIC_API_KEY"):
        return "anthropic"
    if os.getenv("OPENAI_API_KEY"):
        return "openai"
    return ""


def _ai_enabled() -> bool:
    return bool(_get_provider())


def _get_anthropic() -> anthropic.AsyncAnthropic:
    global _anthropic_client
    if _anthropic_client is None:
        _anthropic_client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    return _anthropic_client


def _get_openai():
    global _openai_client
    if _openai_client is None:
        from openai import AsyncOpenAI
        _openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    return _openai_client


# ── JSON extraction helper ─────────────────────────────────────────────────────

def _extract_json(text: str) -> str:
    """
    Robustly pull a JSON object out of an AI response.
    Handles: raw JSON, ```json fences, and preamble text before the first {.
    """
    stripped = text.strip()

    # 1. Try inside markdown code fences first
    if "```" in stripped:
        parts = stripped.split("```")
        for part in parts[1::2]:          # odd-indexed = inside fences
            content = part.strip()
            if content.startswith("json"):
                content = content[4:].strip()
            if content.startswith("{"):
                return content

    # 2. Find the first { ... } block in case of leading preamble text
    match = re.search(r'\{[\s\S]*\}', stripped)
    if match:
        return match.group(0)

    # 3. Return as-is and let json.loads raise a clear error
    return stripped


# ── Core AI callers ────────────────────────────────────────────────────────────

async def _chat_json(prompt: str, max_tokens: int = 1500) -> dict:
    """Call the active AI provider and return a parsed JSON dict."""
    provider = _get_provider()

    if provider == "anthropic":
        resp = await _get_anthropic().messages.create(
            model=os.getenv("AI_MODEL", "claude-haiku-4-5-20251001"),
            max_tokens=max_tokens,
            temperature=float(os.getenv("AI_TEMPERATURE", "0.2")),
            system=(
                "You are an expert HR analyst. "
                "Respond with a valid JSON object only. "
                "Do not include any text, explanation, or markdown outside the JSON."
            ),
            messages=[{"role": "user", "content": prompt}],
        )
        raw = resp.content[0].text.strip()
        try:
            return json.loads(_extract_json(raw))
        except json.JSONDecodeError as exc:
            raise ValueError(f"AI returned invalid JSON ({exc}). Preview: {raw[:300]}")

    if provider == "openai":
        resp = await _get_openai().chat.completions.create(
            model=os.getenv("AI_MODEL", "claude-haiku-4-5-20251001"),
            messages=[{"role": "user", "content": prompt}],
            temperature=float(os.getenv("AI_TEMPERATURE", "0.2")),
            max_tokens=max_tokens,
            response_format={"type": "json_object"},
        )
        return json.loads(resp.choices[0].message.content)

    raise HTTPException(503, "No AI provider configured.")


async def _chat_text(prompt: str, max_tokens: int = 200) -> str:
    """Call the active AI provider and return a plain-text response."""
    provider = _get_provider()

    if provider == "anthropic":
        resp = await _get_anthropic().messages.create(
            model=os.getenv("AI_MODEL", "claude-haiku-4-5-20251001"),
            max_tokens=max_tokens,
            temperature=float(os.getenv("AI_TEMPERATURE", "0.2")),
            messages=[{"role": "user", "content": prompt}],
        )
        return resp.content[0].text.strip()

    if provider == "openai":
        resp = await _get_openai().chat.completions.create(
            model=os.getenv("AI_MODEL", "claude-haiku-4-5-20251001"),
            messages=[{"role": "user", "content": prompt}],
            temperature=float(os.getenv("AI_TEMPERATURE", "0.2")),
            max_tokens=max_tokens,
        )
        return resp.choices[0].message.content.strip()

    raise HTTPException(503, "No AI provider configured.")


# ── DB helper ──────────────────────────────────────────────────────────────────

def _fetch_candidate(candidate_id: str):
    row = db().execute(
        """SELECT c.*, s.job_title, j.description AS job_description
           FROM candidates c
           JOIN sessions s ON c.session_id = s.id
           LEFT JOIN jobs j ON s.job_id = j.id
           WHERE c.id = ?""",
        (candidate_id,),
    ).fetchone()
    return dict(row) if row else None


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/explain-candidate")
async def explain_candidate(request: Request):
    body = await request.json()
    if not _ai_enabled():
        raise HTTPException(503, "AI features not available. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.")

    candidate_id = body.get("candidateId")
    if not candidate_id:
        raise HTTPException(400, "candidateId is required")

    candidate = _fetch_candidate(candidate_id)
    if not candidate:
        raise HTTPException(404, "Candidate not found")

    bd         = json.loads(candidate.get("breakdown")             or "{}")
    strengths  = json.loads(candidate.get("strengths")             or "[]")
    weaknesses = json.loads(candidate.get("weaknesses")            or "[]")
    summary    = candidate.get("summary")                          or ""
    focus_areas = json.loads(candidate.get("interview_focus_areas") or "[]")

    prompt = f"""You are an expert HR analyst making a hiring decision.
All factual data about this candidate has already been extracted — your job is ONLY to provide judgment.

CANDIDATE: {candidate['name']}
POSITION:  {candidate['job_title']}
FINAL SCORE: {candidate['final_score']}%

ALREADY EXTRACTED — DO NOT REPEAT:
Summary      : {summary or 'Not available'}
Strengths    : {'; '.join(strengths)   or 'None identified'}
Gaps         : {'; '.join(weaknesses)  or 'None identified'}
Interview Focus: {'; '.join(focus_areas) or 'None identified'}

SCORING DATA:
- Skills Match : {bd.get('skills',     {}).get('score', 0)}%  ({len(bd.get('skills', {}).get('matched', []))} matched, {len(bd.get('skills', {}).get('missing', []))} missing)
- Experience   : {bd.get('experience', {}).get('score', 0)}%  ({bd.get('experience', {}).get('detectedYears', 0)} yrs detected, {bd.get('experience', {}).get('requiredYears', 0)} required)
- Education    : {bd.get('education',  {}).get('score', 0)}%  ({bd.get('education', {}).get('label', 'Not specified')})
- Overall Fit  : {bd.get('tfidf',      {}).get('score', 0)}%
- Missing Skills: {', '.join(bd.get('skills', {}).get('missing', [])[:8]) or 'None'}
{('JOB REQUIREMENTS:\n' + (candidate.get('job_description') or '')[:800]) if candidate.get('job_description') else ''}

Return ONLY this JSON — do not re-state strengths/gaps already listed above:
{{
  "overallAssessment": "2-3 sentence hiring judgment integrating all the data above",
  "recommendation": "HIRE | PASS | CONSIDER — one clear word then a single sentence reason",
  "hiringRisk": "low | medium | high — assess honestly based on score gaps and missing skills",
  "riskFactors": ["specific risk derived from the data above, not generic statements"],
  "developmentPlan": ["concrete step this candidate must take to close a specific gap"]
}}"""

    try:
        insights = await _chat_json(prompt, max_tokens=600)
    except Exception as exc:
        raise HTTPException(500, f"AI analysis failed: {exc}")

    return {
        "candidateId":   candidate_id,
        "candidateName": candidate["name"],
        "finalScore":    candidate["final_score"],
        "insights":      insights,
        "stored": {
            "summary":            summary,
            "strengths":          strengths,
            "weaknesses":         weaknesses,
            "interviewFocusAreas": focus_areas,
            "interviewQuestions": json.loads(candidate.get("interview_questions") or "[]"),
        },
        "generatedAt": datetime.utcnow().isoformat(),
    }


@router.post("/compare-candidates")
async def compare_candidates(request: Request):
    body = await request.json()
    if not _ai_enabled():
        raise HTTPException(503, "AI features not available. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.")

    ids = body.get("candidateIds", [])
    if not isinstance(ids, list) or len(ids) < 2:
        raise HTTPException(400, "At least 2 candidateIds are required")
    if len(ids) > 5:
        raise HTTPException(400, "Maximum 5 candidates can be compared at once")

    placeholders = ",".join("?" * len(ids))
    rows = db().execute(
        f"""SELECT c.*, s.job_title, j.description AS job_description
            FROM candidates c
            JOIN sessions s ON c.session_id = s.id
            LEFT JOIN jobs j ON s.job_id = j.id
            WHERE c.id IN ({placeholders})""",
        ids,
    ).fetchall()

    if len(rows) < 2:
        raise HTTPException(404, "Not enough candidates found")

    candidates_data = []
    for r in rows:
        c = dict(r)
        bd = json.loads(c.get("breakdown") or "{}")
        candidates_data.append({
            "name":       c["name"],
            "finalScore": c["final_score"],
            "grade":      c.get("grade_label"),
            "skills": {
                "score":   bd.get("skills", {}).get("score", 0),
                "matched": bd.get("skills", {}).get("matched", []),
                "missing": bd.get("skills", {}).get("missing", []),
            },
            "experience": {
                "score": bd.get("experience", {}).get("score", 0),
                "years": bd.get("experience", {}).get("detectedYears", 0),
            },
            "education": {
                "score": bd.get("education", {}).get("score", 0),
                "level": bd.get("education", {}).get("label", "Not specified"),
            },
        })

    job_title = dict(rows[0])["job_title"]
    job_desc  = (dict(rows[0]).get("job_description") or "")[:1000]

    candidate_block = "\n".join(
        f"{i + 1}. {c['name']}\n"
        f"   Final Score : {c['finalScore']}% ({c['grade']})\n"
        f"   Skills      : {c['skills']['score']}% | Matched: {', '.join(c['skills']['matched'][:5]) or 'None'}\n"
        f"   Experience  : {c['experience']['score']}% ({c['experience']['years']} yrs)\n"
        f"   Education   : {c['education']['score']}% ({c['education']['level']})"
        for i, c in enumerate(candidates_data)
    )

    prompt = f"""Compare these candidates for the position: {job_title}
{('JOB REQUIREMENTS (excerpt): ' + job_desc) if job_desc else ''}

CANDIDATES:
{candidate_block}

Return a JSON object with EXACTLY these keys:
{{
  "summary": "2-3 sentence overview of the candidate pool",
  "topCandidate": "name of the best candidate",
  "topCandidateReason": "one sentence explaining why",
  "ranking": [
    {{"name": "candidate name", "rank": 1, "reasoning": "one sentence"}}
  ],
  "comparisonMatrix": {{
    "skills": "comparison sentence",
    "experience": "comparison sentence",
    "education": "comparison sentence",
    "overallFit": "comparison sentence"
  }},
  "uniqueStrengths": {{
    "CandidateName": "their unique strength"
  }},
  "recommendation": "final hiring recommendation",
  "alternativeScenarios": ["scenario 1", "scenario 2"]
}}"""

    try:
        comparison = await _chat_json(prompt, max_tokens=min(400 + len(ids) * 250, 1800))
    except Exception as exc:
        raise HTTPException(500, f"AI comparison failed: {exc}")

    return {
        "jobTitle":       job_title,
        "candidateCount": len(rows),
        "candidates":     candidates_data,
        "comparison":     comparison,
        "generatedAt":    datetime.utcnow().isoformat(),
    }


@router.post("/explain-score")
async def explain_score(request: Request):
    body = await request.json()
    if not _ai_enabled():
        raise HTTPException(503, "AI features not available. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.")

    candidate_id = body.get("candidateId")
    score_type   = body.get("scoreType")
    valid_types  = {"skills", "experience", "education", "overall", "final"}

    if not candidate_id or not score_type:
        raise HTTPException(400, "candidateId and scoreType are required")
    if score_type not in valid_types:
        raise HTTPException(400, f"Invalid scoreType. Must be one of: {', '.join(valid_types)}")

    row = db().execute(
        "SELECT c.*, s.job_title FROM candidates c JOIN sessions s ON c.session_id = s.id WHERE c.id = ?",
        (candidate_id,),
    ).fetchone()
    if not row:
        raise HTTPException(404, "Candidate not found")

    c  = dict(row)
    bd = json.loads(c.get("breakdown") or "{}")

    score_map = {
        "skills":     (bd.get("skills", {}).get("score", 0),     f"Matched: {', '.join(bd.get('skills', {}).get('matched', []))}, Missing: {', '.join(bd.get('skills', {}).get('missing', []))}"),
        "experience": (bd.get("experience", {}).get("score", 0), f"{bd.get('experience', {}).get('detectedYears', 0)} years detected"),
        "education":  (bd.get("education", {}).get("score", 0),  bd.get("education", {}).get("label", "Not specified")),
        "overall":    (bd.get("tfidf", {}).get("score", 0),      "Overall fit and relevance"),
        "final":      (c["final_score"],                          "Weighted average of all scores"),
    }
    score_value, score_details = score_map[score_type]

    try:
        explanation = await _chat_text(
            f"Explain in 2-3 clear sentences why this candidate received a {score_value}% score for {score_type}.\n\n"
            f"Candidate: {c['name']}\nPosition: {c['job_title']}\nScore: {score_value}%\nDetails: {score_details}\n\n"
            f"Be brief and professional.",
            max_tokens=200,
        )
    except Exception as exc:
        raise HTTPException(500, f"AI explanation failed: {exc}")

    return {
        "candidateId":   candidate_id,
        "candidateName": c["name"],
        "scoreType":     score_type,
        "scoreValue":    score_value,
        "explanation":   explanation,
        "generatedAt":   datetime.utcnow().isoformat(),
    }
