"""
services/hybrid_matcher.py — Core resume-to-job matching engine.

Combines two scoring methods and merges them into a single ranked list:
1. Rule-based NLP scoring (deterministic, always runs)
   - Skill matching with fuzzy synonyms against a curated skill taxonomy
   - Experience scoring via regex year extraction
   - Education level detection
   - TF-IDF overall fit score
2. Semantic similarity via OpenAI embeddings (runs when a job embedding exists)
   - Cosine similarity between job and resume embeddings
   - Blended 75% rule-based + 25% semantic

AI extraction (ai_extractor) is called after NLP scoring to enrich each
result with name, title, location, contact info, strengths, and weaknesses.
"""

import re
import math
from collections import Counter
from .embedding_service import (
    embed_batch, cosine_similarity, similarity_to_score, build_resume_embedding_text,
)
from .ai_extractor import extract_candidate_info_batch, is_ai_extraction_enabled

# ── Skill taxonomy ─────────────────────────────────────────────────────────────
SKILL_GROUPS = {
    "languages": ["javascript","typescript","python","java","c++","c#","ruby","go","golang","rust","swift","kotlin","scala","php","r","matlab","perl","bash","shell","powershell","sql","html","css","dart","elixir"],
    "frontend":  ["react","angular","vue","svelte","nextjs","next.js","nuxt","sass","scss","tailwind","bootstrap","webpack","vite","redux","mobx","graphql","apollo","jquery","material-ui","chakra-ui","styled-components"],
    "backend":   ["node","nodejs","express","fastapi","django","flask","spring","spring boot","rails","laravel","asp.net","nestjs","koa","grpc","rest","restful","microservices","fastify","gin"],
    "databases": ["sql","mysql","postgresql","postgres","mongodb","redis","elasticsearch","dynamodb","cassandra","oracle","sqlite","neo4j","firebase","supabase","prisma","sequelize","typeorm","mongoose"],
    "cloud":     ["aws","azure","gcp","google cloud","docker","kubernetes","k8s","terraform","ansible","jenkins","github actions","gitlab ci","circleci","ci/cd","devops","linux","nginx","apache","heroku","vercel","netlify"],
    "data":      ["machine learning","deep learning","nlp","natural language processing","computer vision","tensorflow","pytorch","keras","scikit-learn","pandas","numpy","spark","hadoop","airflow","dbt","tableau","power bi","jupyter"],
    "mobile":    ["react native","flutter","swift","kotlin","android","ios","xamarin","ionic","expo"],
    "practices": ["agile","scrum","kanban","tdd","test-driven development","bdd","solid","design patterns","microservices","event-driven","ddd","clean architecture","git","jira","unit testing","integration testing"],
    "testing":   ["jest","mocha","chai","jasmine","pytest","junit","testng","selenium","cypress","playwright","puppeteer","cucumber","rspec"],
    "security":  ["oauth","jwt","saml","ssl","tls","encryption","authentication","authorization","owasp","cors","csrf","xss"],
}
ALL_SKILLS = [s for group in SKILL_GROUPS.values() for s in group]

NON_SKILLS = {
    "the","and","for","with","this","that","from","have","will","must","should","can","may",
    "are","you","our","your","we","be","is","in","to","of","at","as","an","or","not","but",
    "work","team","company","project","experience","years","role","position","job","candidate",
    "resume","cv","skills","education","degree","responsibilities","requirements","qualifications",
    "strong","excellent","good","great","solid","proven","senior","junior","lead","manager",
    "engineer","developer","designer","analyst","architect",
}

EDUCATION_LEVELS = [
    (["phd","ph.d","doctorate","doctoral"],                          100, "PhD / Doctorate"),
    (["master","mba","msc","m.sc","ms ","m.s.","meng","m.eng"],      85,  "Master's"),
    (["bachelor","bsc","b.sc","bs ","b.s.","beng","b.eng","b.e."],   70,  "Bachelor's"),
    (["associate","a.s.","a.a."],                                     50,  "Associate"),
    (["diploma","higher national"],                                   35,  "Diploma"),
    (["certification","certified","certificate"],                     25,  "Certification"),
]

EXP_PATTERNS = [
    re.compile(r"(\d+)\+?\s*(?:to\s*\d+\s*)?years?\s+(?:of\s+)?(?:professional\s+)?(?:work\s+)?experience", re.I),
    re.compile(r"experience\s*(?:of\s*)?(\d+)\+?\s*years?", re.I),
    re.compile(r"(\d+)\+?\s*years?\s+(?:in|of|with)\s+\w", re.I),
    re.compile(r"minimum\s+(?:of\s+)?(\d+)\s+years?", re.I),
]

SKILL_SYNONYMS = {
    "javascript": ["js","ecmascript","es6","es2015"],
    "typescript": ["ts"],
    "react": ["reactjs","react.js"],
    "node": ["nodejs","node.js"],
    "postgresql": ["postgres","psql"],
    "mongodb": ["mongo"],
    "kubernetes": ["k8s"],
    "docker": ["containerization","containers"],
    "ci/cd": ["continuous integration","continuous deployment","jenkins","github actions","gitlab ci"],
    "machine learning": ["ml","artificial intelligence","ai"],
    "natural language processing": ["nlp"],
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _extract_years(text: str) -> int:
    best = 0
    for pat in EXP_PATTERNS:
        for m in pat.finditer(text):
            y = int(m.group(1))
            if y > best and y < 50:
                best = y
    return best


def _extract_skills(text: str) -> list[str]:
    lower = text.lower()
    found: set[str] = set()
    for skill in ALL_SKILLS:
        escaped = re.escape(skill)
        if re.search(rf"(?<![a-z]){escaped}(?![a-z])", lower, re.I):
            found.add(skill)
    for w in re.findall(r"\b[A-Z][a-zA-Z0-9.+#]{2,}\b", text):
        lw = w.lower()
        if lw not in NON_SKILLS and lw not in found:
            if re.search(r"[0-9.+#]", w) or (w == w.upper() and 2 <= len(w) <= 6) or re.match(r"^[A-Z][a-z]+[A-Z]", w):
                found.add(lw)
    return list(found)


def _fuzzy_match_skills(resume_text: str, required: list[str]) -> tuple[list[str], list[str]]:
    lower = resume_text.lower()
    matched, missing = [], []
    for skill in required:
        skill_lower = skill.lower()
        variants = [skill_lower] + SKILL_SYNONYMS.get(skill_lower, [])
        if any(v in lower for v in variants):
            matched.append(skill)
        else:
            missing.append(skill)
    return matched, missing


def _score_education(text: str) -> dict:
    lower = text.lower()
    for keywords, score, label in EDUCATION_LEVELS:
        if any(kw in lower for kw in keywords):
            return {"score": score, "label": label}
    return {"score": 0, "label": "Not detected"}


def _score_experience(text: str, required_years: int) -> dict:
    detected = _extract_years(text)
    required = required_years or 3
    if detected >= required:
        score = min(100, 100 + round(((detected - required) / required) * 20))
    elif detected > 0:
        score = round((detected / required) * 100)
    else:
        score = 0
    return {"score": min(100, score), "detectedYears": detected, "requiredYears": required}


def _tfidf_similarity(req_text: str, resume_text: str) -> int:
    def tokenize(t):
        return re.findall(r"\b\w+\b", t.lower())

    req_tokens = tokenize(req_text)
    res_tokens = tokenize(resume_text)
    all_terms = set(req_tokens)
    if not all_terms:
        return 0

    def tf(tokens, term):
        return tokens.count(term) / len(tokens) if tokens else 0

    def idf(term, docs):
        containing = sum(1 for d in docs if term in d)
        return math.log((1 + len(docs)) / (1 + containing)) + 1

    docs = [set(req_tokens), set(res_tokens)]
    weights = {t: tf(req_tokens, t) * idf(t, docs) for t in all_terms}
    total_weight = sum(weights.values())
    if total_weight == 0:
        return 0
    res_lower = resume_text.lower()
    weighted_match = sum(w for t, w in weights.items() if t in res_lower)
    return min(100, round((weighted_match / total_weight) * 100))


def _get_grade(score: int) -> dict:
    if score >= 85:
        return {"label": "Excellent", "color": "emerald"}
    if score >= 70:
        return {"label": "Good", "color": "blue"}
    if score >= 55:
        return {"label": "Fair", "color": "yellow"}
    if score >= 40:
        return {"label": "Below Average", "color": "orange"}
    return {"label": "Poor", "color": "red"}


# ── NLP matching ──────────────────────────────────────────────────────────────

async def _match_resumes_nlp(req_text: str, resumes: list[dict], prefs: dict) -> list[dict]:
    if not is_ai_extraction_enabled():
        raise RuntimeError("OpenAI API key is required. Please configure OPENAI_API_KEY.")

    skills_w = prefs.get("skillsWeight", 40)
    exp_w    = prefs.get("experienceWeight", 25)
    edu_w    = prefs.get("educationWeight", 20)
    ovr_w    = prefs.get("overallWeight", 15)
    total_w  = skills_w + exp_w + edu_w + ovr_w

    required_skills = _extract_skills(req_text)
    req_years = _extract_years(req_text) or prefs.get("minExperienceYears", 3) or 3

    prelims = []
    for r in resumes:
        matched, missing = _fuzzy_match_skills(r["text"], required_skills)
        skill_score = round((len(matched) / len(required_skills)) * 100) if required_skills else 50
        exp = _score_experience(r["text"], req_years)
        edu = _score_education(r["text"])
        tfidf = _tfidf_similarity(req_text, r["text"])
        prelims.append({
            "breakdown": {
                "skills": {"score": min(100, skill_score), "matched": matched, "missing": missing, "total": len(required_skills)},
                "experience": exp,
                "education": edu,
                "tfidf": {"score": tfidf},
            },
            "skillScore": skill_score,
            "expScore": exp["score"],
            "eduScore": edu["score"],
            "tfidfScore": tfidf,
        })

    breakdowns = [p["breakdown"] for p in prelims]
    ai_info = await extract_candidate_info_batch(resumes, req_text, breakdowns)

    results = []
    for i, r in enumerate(resumes):
        p = prelims[i]
        ai = ai_info[i]
        weighted = (
            p["skillScore"] * skills_w +
            p["expScore"]   * exp_w +
            p["eduScore"]   * edu_w +
            p["tfidfScore"] * ovr_w
        ) / total_w
        final_score = round(min(100, weighted))
        results.append({
            "name":      ai.get("name") or r["name"],
            "title":     ai.get("title", ""),
            "location":  ai.get("location", ""),
            "email":     ai.get("email", ""),
            "phone":     ai.get("phone", ""),
            "fileName":  r["fileName"],
            "finalScore": final_score,
            "breakdown": p["breakdown"],
            "grade":     _get_grade(final_score),
            "strengths": ai.get("strengths", []),
            "weaknesses": ai.get("weaknesses", []),
            "summary":   ai.get("summary", ""),
        })

    return sorted(results, key=lambda x: x["finalScore"], reverse=True)


# ── Hybrid matching ───────────────────────────────────────────────────────────

async def match_resumes_hybrid(
    req_text: str,
    resumes: list[dict],
    prefs: dict,
    job_embedding: list[float] | None = None,
) -> list[dict]:
    nlp_results = await _match_resumes_nlp(req_text, resumes, prefs)

    if not job_embedding:
        return [{**r, "scoredBy": "nlp"} for r in nlp_results]

    try:
        texts = [build_resume_embedding_text(r) for r in resumes]
        resume_embeddings = await embed_batch(texts)
    except Exception as e:
        print(f"Embedding failed, using NLP only: {e}")
        return [{**r, "scoredBy": "nlp"} for r in nlp_results]

    SEMANTIC_WEIGHT = 0.25
    hybrid = []
    for result in nlp_results:
        idx = next((i for i, r in enumerate(resumes) if r["fileName"] == result["fileName"]), None)
        if idx is None or not resume_embeddings[idx]:
            hybrid.append({**result, "scoredBy": "nlp"})
            continue
        sim = cosine_similarity(job_embedding, resume_embeddings[idx])
        sem_score = similarity_to_score(sim)
        blended = round(result["finalScore"] * (1 - SEMANTIC_WEIGHT) + sem_score * SEMANTIC_WEIGHT)
        blended = min(100, blended)
        hybrid.append({
            **result,
            "finalScore": blended,
            "breakdown": {
                **result["breakdown"],
                "semantic": {"score": sem_score, "similarity": round(sim, 3), "weight": SEMANTIC_WEIGHT},
            },
            "grade": _get_grade(blended),
            "scoredBy": "hybrid",
        })

    return sorted(hybrid, key=lambda x: x["finalScore"], reverse=True)
