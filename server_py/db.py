"""
db.py — Database initialisation and shared connection.

Reads DB_PATH from .env, creates the SQLite file and parent directories if
they don't exist, runs the full CREATE TABLE / CREATE INDEX schema, and
applies incremental ALTER TABLE migrations so the file can be upgraded from
older schema versions without data loss.  Exports a single `db()` function
that returns the shared connection used by all route handlers.
"""

import sqlite3
import json
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(override=True)

DB_PATH = os.getenv("DB_PATH", "./data/resume_matcher.db")
_resolved = Path(__file__).parent / DB_PATH
_resolved.parent.mkdir(parents=True, exist_ok=True)


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(str(_resolved), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


# ── Schema ────────────────────────────────────────────────────────────────────
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
    embedding           BLOB,
    embedding_model     TEXT,
    embedding_at        TEXT,
    created_at          TEXT DEFAULT (datetime('now')),
    updated_at          TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
    id           TEXT PRIMARY KEY,
    job_id       TEXT REFERENCES jobs(id) ON DELETE SET NULL,
    job_title    TEXT,
    preferences  TEXT NOT NULL,
    result_count INTEGER DEFAULT 0,
    created_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS candidates (
    id              TEXT PRIMARY KEY,
    session_id      TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    file_name       TEXT NOT NULL,
    file_size       INTEGER,
    raw_text        TEXT,
    final_score     INTEGER NOT NULL,
    grade_label     TEXT,
    grade_color     TEXT,
    breakdown       TEXT NOT NULL,
    title           TEXT,
    location        TEXT,
    email           TEXT,
    phone           TEXT,
    strengths       TEXT DEFAULT '[]',
    weaknesses      TEXT DEFAULT '[]',
    summary         TEXT,
    embedding       BLOB,
    embedding_model TEXT,
    status          TEXT DEFAULT 'new',
    notes           TEXT,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_candidates_session ON candidates(session_id);
CREATE INDEX IF NOT EXISTS idx_candidates_status  ON candidates(status);
CREATE INDEX IF NOT EXISTS idx_sessions_job       ON sessions(job_id);
"""


def _migrate(conn: sqlite3.Connection):
    job_cols = {r["name"] for r in conn.execute("PRAGMA table_info(jobs)").fetchall()}
    cand_cols = {r["name"] for r in conn.execute("PRAGMA table_info(candidates)").fetchall()}

    job_migrations = {
        "embedding": "ALTER TABLE jobs ADD COLUMN embedding BLOB",
        "embedding_model": "ALTER TABLE jobs ADD COLUMN embedding_model TEXT",
        "embedding_at": "ALTER TABLE jobs ADD COLUMN embedding_at TEXT",
        "min_experience": "ALTER TABLE jobs ADD COLUMN min_experience INTEGER DEFAULT 0",
        "education_level": "ALTER TABLE jobs ADD COLUMN education_level TEXT",
        "required_skills": "ALTER TABLE jobs ADD COLUMN required_skills TEXT DEFAULT '[]'",
        "nice_to_have_skills": "ALTER TABLE jobs ADD COLUMN nice_to_have_skills TEXT DEFAULT '[]'",
        "responsibilities": "ALTER TABLE jobs ADD COLUMN responsibilities TEXT DEFAULT '[]'",
        "salary": "ALTER TABLE jobs ADD COLUMN salary TEXT DEFAULT ''",
        "summary": "ALTER TABLE jobs ADD COLUMN summary TEXT DEFAULT ''",
        "parsed_by": "ALTER TABLE jobs ADD COLUMN parsed_by TEXT DEFAULT 'nlp'",
    }
    cand_migrations = {
        "embedding": "ALTER TABLE candidates ADD COLUMN embedding BLOB",
        "embedding_model": "ALTER TABLE candidates ADD COLUMN embedding_model TEXT",
        "title": "ALTER TABLE candidates ADD COLUMN title TEXT",
        "location": "ALTER TABLE candidates ADD COLUMN location TEXT",
        "email": "ALTER TABLE candidates ADD COLUMN email TEXT",
        "phone": "ALTER TABLE candidates ADD COLUMN phone TEXT",
        "strengths": "ALTER TABLE candidates ADD COLUMN strengths TEXT DEFAULT '[]'",
        "weaknesses": "ALTER TABLE candidates ADD COLUMN weaknesses TEXT DEFAULT '[]'",
        "summary": "ALTER TABLE candidates ADD COLUMN summary TEXT",
    }
    for col, sql in job_migrations.items():
        if col not in job_cols:
            conn.execute(sql)
    for col, sql in cand_migrations.items():
        if col not in cand_cols:
            conn.execute(sql)
    conn.commit()


# Initialise once at import time
_db = get_conn()
_db.executescript(_SCHEMA)
_migrate(_db)


def db() -> sqlite3.Connection:
    """Return the shared connection (single-process dev server)."""
    return _db
