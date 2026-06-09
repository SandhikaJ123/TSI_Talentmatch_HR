# Application Flow

End-to-end request flow through the Python backend.

---

## Journey 1 — Saving a Job Posting

```
Frontend → POST /api/jobs
```

1. **main.py** receives the request, CORS middleware validates origin, rate limiter checks request count
2. **routes/jobs.py** `create_job()` validates title + description, inserts the job row into SQLite immediately (no embedding yet), responds `201` to the frontend right away with `vectorizing: true`
3. A **BackgroundTask** then calls `embed_text()` from **embedding_service.py** — this sends the job title, skills, responsibilities, and description to OpenAI `text-embedding-3-small` and gets back a 1536-dimension float vector
4. The vector is serialised to a binary blob via `vector_to_bytes()` and stored in the `jobs.embedding` column in SQLite — this is used later to boost resume matching accuracy

---

## Journey 2 — Matching Resumes (the main flow)

```
Frontend → POST /api/match  (multipart: resumes[] + job context + preferences)
```

### Step 1 — Input gathering (`routes/match.py`)
- Reads the job description from either: uploaded file, pasted text, or a saved job's `description` column if a `jobId` is provided
- Reads each resume file into memory
- If a saved job exists with a stored embedding, loads the float vector from the `jobs.embedding` blob — this enables the semantic scoring path

### Step 2 — File parsing (`services/file_parser.py`)
- Each resume file buffer is passed to `extract_text()`
- PDF → `pdfplumber` extracts text page by page
- DOCX → `python-docx` concatenates paragraph text
- TXT → raw UTF-8 decode
- Any files that fail are collected into `parseErrors` and skipped

### Step 3 — NLP scoring (`services/hybrid_matcher.py` → `_match_resumes_nlp`)
Runs entirely offline, no API calls yet:

- **Skill extraction** — scans the job description against a 200+ skill taxonomy (languages, frontend, backend, cloud, data, etc.) to build the `required_skills` list
- **Skill matching** — for each resume, checks each required skill including synonyms (`js` → `javascript`, `k8s` → `kubernetes`, etc.) and produces `matched` / `missing` lists
- **Experience scoring** — regex extracts years mentioned (e.g. "5+ years experience") from both the JD (required) and resume (detected), scores proportionally
- **Education scoring** — keyword detection for PhD / Master's / Bachelor's etc., each mapped to a numeric score
- **TF-IDF similarity** — term frequency weighting of the JD's top terms against each resume for an overall relevance score
- Each resume gets a preliminary `breakdown` dict with all four sub-scores

### Step 4 — AI enrichment (`services/ai_extractor.py`)
- All resumes' breakdowns are ready, now GPT-4o-mini is called in **parallel batches of 3** (to respect rate limits)
- Each call receives: the resume text, the job description, and the NLP breakdown as context
- GPT returns structured JSON: candidate name, title, location, email, phone, 3-5 evidence-based strengths, 2-4 specific weaknesses, and a 2-3 sentence summary
- Results are merged back onto each resume's NLP result

### Step 5 — Weighted final score

```
finalScore = (skillScore × 40 + expScore × 25 + eduScore × 20 + tfidfScore × 15) / 100
```

Weights come from the frontend preferences (defaults shown above). Score maps to a grade label (Excellent / Good / Fair / Below Average / Poor).

### Step 6 — Semantic blending (`hybrid_matcher.py` → `match_resumes_hybrid`)
Only runs if the job had a stored embedding (from Journey 1):
- `embed_batch()` generates embeddings for all resumes in one OpenAI API call
- `cosine_similarity()` computes how semantically close each resume is to the job
- Scores are blended: **75% NLP + 25% semantic** → new `finalScore`
- The `breakdown.semantic` field is added with the raw similarity value
- Results re-sorted by blended score

### Step 7 — Persist to SQLite (`routes/match.py`)
- A **session** row is inserted (groups this entire match run)
- Each candidate row is inserted with all scores, breakdown JSON, AI-extracted fields, and the resume embedding blob for future use
- `conn.commit()` writes everything atomically

### Step 8 — Response

```json
{
  "sessionId": "...",
  "scoredBy": "hybrid | nlp",
  "semanticEnabled": true,
  "results": [{ "name": "...", "finalScore": 87, "grade": "...", "breakdown": {}, "strengths": [], "weaknesses": [] }]
}
```

---

## Journey 3 — AI Insights (on-demand, post-match)

```
Frontend → POST /api/ai-insights/explain-candidate
         → POST /api/ai-insights/compare-candidates
         → POST /api/ai-insights/explain-score
```

These are independent from matching. They read already-saved candidate rows from SQLite and make a fresh GPT-4o call with a rich prompt. No re-scoring happens — they purely narrate and explain the stored scores in human language.

---

## Data Flow Diagram

```
Browser
  │
  ├─ POST /api/jobs ──► jobs.py ──► job_parser.py (NLP/AI) ──► SQLite jobs
  │                              └─ embedding_service.py ──► OpenAI ──► SQLite jobs.embedding
  │
  ├─ POST /api/match
  │     │
  │     ├─ file_parser.py ──────────────────── extract text from PDF/DOCX/TXT
  │     │
  │     ├─ hybrid_matcher.py
  │     │     ├─ NLP scoring (offline) ──────── skills + exp + edu + tfidf
  │     │     ├─ ai_extractor.py ─────────────► GPT-4o-mini (batches of 3)
  │     │     └─ embedding_service.py ────────► OpenAI embeddings + cosine blend
  │     │
  │     └─ SQLite ─── sessions + candidates rows saved
  │
  ├─ GET  /api/candidates ──► candidates.py ──► SQLite read
  ├─ GET  /api/analytics  ──► analytics.py  ──► SQLite aggregations
  └─ POST /api/ai-insights ─► ai_insights.py ─► SQLite read + GPT-4o call
```
