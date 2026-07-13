"""
services/job_parser.py — Job description structured extraction.

Two parsing modes:
- parse_job_nlp()  — fully offline, regex + keyword matching against a skill
  taxonomy; extracts title, department, location, type, experience, education,
  required/nice-to-have skills, responsibilities, and salary.
- parse_job_ai()   — sends the description to GPT-4o with a strict JSON prompt
  for higher-accuracy extraction; falls back to NLP on failure.

Both return the same dict shape so callers are agnostic to which was used.
"""

import os
import re
import json
from openai import AsyncOpenAI
import anthropic

SKILL_GROUPS = {
    "languages": ["javascript","typescript","python","java","c++","c#","ruby","go","golang","rust","swift","kotlin","scala","php","r","matlab","perl","bash","shell","powershell"],
    "frontend":  ["react","angular","vue","svelte","next.js","nextjs","nuxt","html","css","sass","tailwind","bootstrap","webpack","vite","redux","graphql"],
    "backend":   ["node","nodejs","express","fastapi","django","flask","spring","rails","laravel","nestjs","grpc","rest","microservices"],
    "databases": ["sql","mysql","postgresql","postgres","mongodb","redis","elasticsearch","dynamodb","cassandra","oracle","sqlite","firebase"],
    "cloud":     ["aws","azure","gcp","google cloud","docker","kubernetes","terraform","ansible","jenkins","ci/cd","devops","linux"],
    "data":      ["machine learning","deep learning","nlp","tensorflow","pytorch","pandas","numpy","spark","hadoop","tableau","power bi"],
    "practices": ["agile","scrum","kanban","tdd","git","jira","confluence","design patterns","microservices"],
}
ALL_SKILLS = [s for g in SKILL_GROUPS.values() for s in g]

DEPARTMENTS = ["Engineering","Product","Design","Marketing","Sales","HR","Finance","Operations","Data","DevOps","QA","Security","Legal","Support"]
JOB_TYPES   = ["Full-time","Part-time","Contract","Internship","Freelance","Remote"]

EDUCATION_LEVELS = [
    (["phd","ph.d","doctorate"],            "PhD / Doctorate"),
    (["master","mba","msc","m.sc","ms "],   "Master's"),
    (["bachelor","bsc","b.sc","bs ","b.e."],"Bachelor's"),
    (["associate"],                         "Associate"),
    (["diploma"],                           "Diploma"),
    (["certification","certified"],         "Certification"),
]

EXP_PATTERNS = [
    re.compile(r"(\d+)\+?\s*(?:to\s*\d+\s*)?years?\s+(?:of\s+)?(?:professional\s+)?(?:work\s+)?experience", re.I),
    re.compile(r"experience\s*(?:of\s*)?(\d+)\+?\s*years?", re.I),
    re.compile(r"(\d+)\+?\s*years?\s+(?:in|of|with)\s+\w", re.I),
    re.compile(r"minimum\s+(?:of\s+)?(\d+)\s+years?", re.I),
    re.compile(r"at\s+least\s+(\d+)\s+years?", re.I),
]


def _extract_skills(text: str) -> list[str]:
    lower = text.lower()
    found: set[str] = set()
    for skill in ALL_SKILLS:
        if re.search(rf"(?<![a-z]){re.escape(skill)}(?![a-z])", lower, re.I):
            found.add(skill)
    stop = {"The","And","For","With","Work","Team","Company","Senior","Junior","Lead","Manager","Engineer","Developer"}
    for w in re.findall(r"\b[A-Z][a-zA-Z0-9.+#]{2,}\b", text):
        if w not in stop:
            lw = w.lower()
            if re.search(r"[0-9.+#]", w) or (w == w.upper() and 2 <= len(w) <= 6) or re.match(r"^[A-Z][a-z]+[A-Z]", w):
                found.add(lw)
    return list(found)


def _extract_experience(text: str) -> int:
    best = 0
    for pat in EXP_PATTERNS:
        for m in pat.finditer(text):
            y = int(m.group(1))
            if y > best and y < 50:
                best = y
    return best


def _extract_education(text: str):
    lower = text.lower()
    for keywords, label in EDUCATION_LEVELS:
        if any(kw in lower for kw in keywords):
            return label
    return None


def _extract_title(text: str) -> str:
    for line in text.split("\n")[:5]:
        line = line.strip().lstrip("#").strip()  # strip markdown heading markers
        if 3 < len(line) < 100 and not line.endswith(".") and not line.startswith("-"):
            return re.sub(r"^(job title|position|role)[:\s]*", "", line, flags=re.I).strip()
    return ""


def _extract_department(text: str) -> str:
    lower = text.lower()
    for d in DEPARTMENTS:
        if d.lower() in lower:
            return d
    return "Engineering"


def _extract_job_type(text: str) -> str:
    lower = text.lower()
    for t in JOB_TYPES:
        if t.lower() in lower:
            return t
    return "Full-time"


def _extract_location(text: str) -> str:
    m = re.search(r"\b(?:location|based in|office)[:\s]+([A-Za-z ,]+)", text, re.I)
    return m.group(1).strip()[:50] if m else ""


def _extract_nice_to_have(text: str) -> list[str]:
    m = re.search(r"(?:nice[- ]to[- ]have|preferred|bonus|plus|advantageous)[:\s\n]+([\s\S]{0,500}?)(?:\n\n|\n[A-Z]|$)", text, re.I)
    return _extract_skills(m.group(1)) if m else []


def _extract_responsibilities(text: str) -> list[str]:
    bullets = re.findall(r"^[\s]*[-•*]\s+(.+)$", text, re.MULTILINE)
    return [b.strip() for b in bullets if 10 < len(b.strip()) < 200][:10]


def _extract_salary(text: str) -> str:
    m = re.search(r"\$[\d,]+(?:\s*[-–]\s*\$[\d,]+)?(?:\s*(?:per\s+)?(?:year|yr|annual|month|hour|hr))?", text, re.I)
    return m.group(0).strip() if m else ""


def parse_job_nlp(text: str) -> dict:
    skills = _extract_skills(text)
    nice = _extract_nice_to_have(text)
    required = [s for s in skills if s not in nice]
    return {
        "title":            _extract_title(text),
        "department":       _extract_department(text),
        "location":         _extract_location(text),
        "type":             _extract_job_type(text),
        "minExperience":    _extract_experience(text),
        "educationLevel":   _extract_education(text),
        "requiredSkills":   required,
        "niceToHaveSkills": nice,
        "responsibilities": _extract_responsibilities(text),
        "salary":           _extract_salary(text),
        "rawText":          text,
        "parsedBy":         "nlp",
    }


def _get_provider() -> str:
    if os.getenv("OPENAI_API_KEY"):
        return "openai"
    if os.getenv("ANTHROPIC_API_KEY"):
        return "anthropic"
    return ""


_JOB_PARSE_PROMPT = """You are an expert HR analyst. Extract structured information from this job description.

JOB DESCRIPTION:
{text}

IMPORTANT: requiredSkills and niceToHaveSkills must ONLY be actual technical skills/tools/frameworks/languages.
DO NOT include: job duties, soft skills, adjectives, or common words.

Respond with ONLY valid JSON:
{{
  "title": "<job title>",
  "department": "<Engineering|Product|Design|Marketing|Sales|HR|Finance|Operations|Data|DevOps|QA|Security|Legal|Support|Other>",
  "location": "<city/remote/hybrid or empty string>",
  "type": "<Full-time|Part-time|Contract|Internship|Freelance|Remote>",
  "minExperience": <number>,
  "educationLevel": "<Bachelor's|Master's|PhD / Doctorate|Associate|Diploma|Certification|null>",
  "requiredSkills": ["skill1"],
  "niceToHaveSkills": ["skill1"],
  "responsibilities": ["responsibility1"],
  "salary": "<salary range or empty string>",
  "summary": "<2-3 sentence summary>"
}}"""


async def parse_job_ai(text: str) -> dict:
    provider = _get_provider()
    if not provider:
        return parse_job_nlp(text)

    prompt = _JOB_PARSE_PROMPT.format(text=text[:4000])
    try:
        if provider == "openai":
            client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
            resp = await client.chat.completions.create(
                model=os.getenv("OPENAI_AI_MODEL", "gpt-4o-mini"),
                messages=[{"role": "user", "content": prompt}],
                temperature=float(os.getenv("AI_TEMPERATURE", "0.2")),
                max_tokens=int(os.getenv("AI_MAX_TOKENS", "1500")),
                seed=12345,
                response_format={"type": "json_object"},
            )
            raw = resp.choices[0].message.content
        else:
            client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
            resp = await client.messages.create(
                model=os.getenv("AI_MODEL", "claude-haiku-4-5-20251001"),
                max_tokens=int(os.getenv("AI_MAX_TOKENS", "1500")),
                temperature=float(os.getenv("AI_TEMPERATURE", "0.2")),
                messages=[{"role": "user", "content": prompt}],
            )
            raw = resp.content[0].text.strip()
            if "```" in raw:
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
        parsed = json.loads(raw)
        return {**parsed, "rawText": text, "parsedBy": "ai"}
    except Exception as e:
        print(f"AI job parse failed, falling back to NLP: {e}")
        return parse_job_nlp(text)
