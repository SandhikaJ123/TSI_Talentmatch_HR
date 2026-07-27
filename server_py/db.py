"""
db.py — PostgreSQL initialisation and shared connection.

Drop-in replacement for the old SQLite version. It keeps the same public
API (`db()` returns a shared connection, and `conn.execute(sql, params)`
returns a cursor you can call .fetchone()/.fetchall()/.rowcount on), so the
route handlers do NOT need to change.

A small wrapper translates the two SQLite-isms used across the routes:
    ?               ->  %s            (parameter placeholders)
    datetime('now') ->  now()         (current timestamp)

Reads DATABASE_URL from .env, connects to PostgreSQL, and runs the full
CREATE TABLE / CREATE INDEX schema on startup (IF NOT EXISTS, so it is safe
to run every time).
"""

import os
from dotenv import load_dotenv

import psycopg
from psycopg.rows import dict_row

load_dotenv(override=True)

# e.g. postgresql://myuser:mypassword@localhost:5432/resume_matcher
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/resume_matcher",
)


# ── SQLite-compatibility wrapper ──────────────────────────────────────────────
class _ConnWrapper:
    """Wraps a psycopg connection so route code written for sqlite3 keeps
    working unchanged: it accepts `?` placeholders and `datetime('now')`,
    and lets you chain `.execute(...).fetchone()`."""

    def __init__(self, conn: psycopg.Connection):
        self._conn = conn

    def execute(self, sql: str, params=()):
        sql = sql.replace("?", "%s").replace("datetime('now')", "now()")
        cur = self._conn.cursor()
        try:
            cur.execute(sql, params)
        except Exception:
            self._conn.rollback()
            raise
        return cur

    # delegate commit(), rollback(), close(), cursor(), etc. to the real conn
    def __getattr__(self, name):
        return getattr(self._conn, name)


# ── Schema ────────────────────────────────────────────────────────────────────
# Notes vs the old SQLite schema:
#   BLOB              -> BYTEA
#   TEXT DEFAULT (datetime('now'))  -> TIMESTAMPTZ DEFAULT now()
#   the columns that were previously added via ALTER TABLE migrations
#   (primary_techstack, interview_questions, interview_focus_areas,
#   top_interview_questions) are now part of the base CREATE TABLE, so no
#   migration step is needed.
_SCHEMA = """
CREATE TABLE IF NOT EXISTS jobs (
    id                  TEXT PRIMARY KEY,
    title               TEXT NOT NULL,
    department          TEXT,
    location            TEXT,
    type                TEXT DEFAULT 'Full-time',
    description         TEXT NOT NULL,
    status              TEXT DEFAULT 'active',
    min_experience      INTEGER DEFAULT 0,
    education_level     TEXT,
    required_skills     TEXT DEFAULT '[]',
    nice_to_have_skills TEXT DEFAULT '[]',
    responsibilities    TEXT DEFAULT '[]',
    salary              TEXT DEFAULT '',
    summary             TEXT DEFAULT '',
    parsed_by           TEXT DEFAULT 'nlp',
    embedding           BYTEA,
    embedding_model     TEXT,
    embedding_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
    id           TEXT PRIMARY KEY,
    job_id       TEXT REFERENCES jobs(id) ON DELETE SET NULL,
    job_title    TEXT,
    preferences  TEXT NOT NULL,
    result_count INTEGER DEFAULT 0,
    created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS candidates (
    id                     TEXT PRIMARY KEY,
    session_id             TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    name                   TEXT NOT NULL,
    file_name              TEXT NOT NULL,
    file_size              INTEGER,
    raw_text               TEXT,
    final_score            INTEGER NOT NULL,
    grade_label            TEXT,
    grade_color            TEXT,
    breakdown              TEXT NOT NULL,
    title                  TEXT,
    location               TEXT,
    email                  TEXT,
    phone                  TEXT,
    strengths              TEXT DEFAULT '[]',
    weaknesses             TEXT DEFAULT '[]',
    summary                TEXT,
    primary_techstack      TEXT,
    interview_questions    TEXT DEFAULT '[]',
    interview_focus_areas  TEXT DEFAULT '[]',
    top_interview_questions TEXT DEFAULT '[]',
    embedding              BYTEA,
    embedding_model        TEXT,
    status                 TEXT DEFAULT 'new',
    notes                  TEXT,
    created_at             TIMESTAMPTZ DEFAULT now(),
    updated_at             TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidates_session ON candidates(session_id);
CREATE INDEX IF NOT EXISTS idx_candidates_status  ON candidates(status);
CREATE INDEX IF NOT EXISTS idx_sessions_job       ON sessions(job_id);

-- Safe to run every time: adds the column if this DB was created before
-- top_interview_questions existed in the base schema above.
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS top_interview_questions TEXT DEFAULT '[]';
"""


# ── Initialise once at import time ────────────────────────────────────────────
# Run the schema on its own autocommit connection so tables exist before the
# shared connection starts serving requests.
with psycopg.connect(DATABASE_URL, autocommit=True) as _setup:
    _setup.execute(_SCHEMA)

# Shared connection used by all route handlers (mirrors the old single-conn
# design). dict_row makes rows accessible by column name, like sqlite3.Row.
_db = _ConnWrapper(psycopg.connect(DATABASE_URL, row_factory=dict_row))


def db() -> _ConnWrapper:
    """Return the shared connection (single-process dev server)."""
    return _db