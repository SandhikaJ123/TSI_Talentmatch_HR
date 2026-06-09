"""
services/ai_extractor.py — AI-powered candidate information extraction.

Supports OpenAI (GPT-4o-mini) and Anthropic Claude (claude-3-5-haiku).
Provider is selected automatically: OpenAI takes precedence if both keys are set.

Uses the active provider to analyse each resume against the job requirements and return:
- Structured contact info  (name, title, location, email, phone)
- Strengths — evidence-based positives relevant to the job
- Weaknesses — explicit gaps where job requirements are not met
- Summary — 2-3 sentence professional assessment

extract_candidate_info_batch() processes resumes in parallel batches of 3.
"""

import os
import json
import asyncio
from openai import AsyncOpenAI
import anthropic

_openai_client = None
_anthropic_client = None


def _get_provider() -> str:
    if os.getenv("OPENAI_API_KEY"):
        return "openai"
    if os.getenv("ANTHROPIC_API_KEY"):
        return "anthropic"
    return ""


def _get_openai_client() -> AsyncOpenAI:
    global _openai_client
    if _openai_client is None:
        _openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    return _openai_client


def _get_anthropic_client() -> anthropic.AsyncAnthropic:
    global _anthropic_client
    if _anthropic_client is None:
        _anthropic_client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    return _anthropic_client


def is_ai_extraction_enabled() -> bool:
    return bool(_get_provider())


def get_active_provider() -> str:
    return _get_provider()


_EXTRACTION_PROMPT = """You are an expert HR recruiter. Analyze this candidate's resume against the job requirements.

JOB REQUIREMENTS:
{job_header}

CANDIDATE'S RESUME:
{resume_header}

SCORING BREAKDOWN:
- Skills Match: {skills_score}% ({matched_count}/{total_skills} skills matched)
- Experience: {exp_score}% ({detected_years} years detected, {required_years} required)
- Education: {edu_score}% ({edu_level})
- Matched Skills: {matched_skills}
- Missing Skills: {missing_skills}

Return ONLY valid JSON:
{{
  "name": "Candidate full name",
  "title": "Current/desired job title",
  "location": "City, State or empty string",
  "email": "Email or empty string",
  "phone": "Phone or empty string",
  "strengths": ["3-5 specific, evidence-based strengths relevant to the job"],
  "weaknesses": ["2-4 specific gaps where job requirements are not met"],
  "summary": "2-3 sentence professional assessment"
}}"""


def _build_prompt(resume_text: str, job_requirements: str, breakdown: dict) -> str:
    sk = breakdown.get("skills", {})
    ex = breakdown.get("experience", {})
    edu = breakdown.get("education", {})
    return _EXTRACTION_PROMPT.format(
        job_header=job_requirements[:2000],
        resume_header=resume_text[:3000],
        skills_score=sk.get("score", 0),
        matched_count=len(sk.get("matched", [])),
        total_skills=sk.get("total", 0),
        exp_score=ex.get("score", 0),
        detected_years=ex.get("detectedYears", 0),
        required_years=ex.get("requiredYears", 0),
        edu_score=edu.get("score", 0),
        edu_level=edu.get("label", ""),
        matched_skills=", ".join(sk.get("matched", [])[:10]),
        missing_skills=", ".join(sk.get("missing", [])[:10]),
    )


def _parse_result(raw: str) -> dict:
    result = json.loads(raw)
    return {
        "name":      (result.get("name") or "").strip(),
        "title":     (result.get("title") or "").strip(),
        "location":  (result.get("location") or "").strip(),
        "email":     (result.get("email") or "").strip(),
        "phone":     (result.get("phone") or "").strip(),
        "strengths": result.get("strengths") if isinstance(result.get("strengths"), list) else [],
        "weaknesses": result.get("weaknesses") if isinstance(result.get("weaknesses"), list) else [],
        "summary":   (result.get("summary") or "").strip(),
    }


async def _extract_openai(prompt: str) -> dict:
    resp = await _get_openai_client().chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=500,
        response_format={"type": "json_object"},
    )
    return _parse_result(resp.choices[0].message.content)


async def _extract_anthropic(prompt: str) -> dict:
    resp = await _get_anthropic_client().messages.create(
        model="claude-3-5-haiku-20241022",
        max_tokens=500,
        temperature=0.2,
        messages=[{"role": "user", "content": prompt}],
    )
    text = resp.content[0].text.strip()
    # Extract JSON block if wrapped in markdown
    if "```" in text:
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return _parse_result(text)


async def extract_candidate_info_with_analysis(
    resume_text: str, job_requirements: str, breakdown: dict
) -> dict:
    provider = _get_provider()
    if not provider:
        raise RuntimeError("No AI API key configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY.")
    prompt = _build_prompt(resume_text, job_requirements, breakdown)
    if provider == "openai":
        return await _extract_openai(prompt)
    return await _extract_anthropic(prompt)


async def extract_candidate_info_batch(
    resumes: list[dict], job_requirements: str, breakdowns: list[dict]
) -> list[dict]:
    BATCH_SIZE = 3
    results = []
    for i in range(0, len(resumes), BATCH_SIZE):
        batch = resumes[i: i + BATCH_SIZE]
        batch_breakdowns = breakdowns[i: i + BATCH_SIZE]
        batch_results = await asyncio.gather(
            *[
                extract_candidate_info_with_analysis(r["text"], job_requirements, bd)
                for r, bd in zip(batch, batch_breakdowns)
            ],
            return_exceptions=True,
        )
        for r, res in zip(batch, batch_results):
            if isinstance(res, Exception):
                print(f"✗ AI extraction failed for {r['fileName']}: {res}")
                results.append({"name": r["name"], "title": "", "location": "", "email": "", "phone": "", "strengths": [], "weaknesses": [], "summary": ""})
            else:
                results.append(res)
    return results
