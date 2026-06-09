import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || './data/resume_matcher.db';
const resolvedPath = path.resolve(__dirname, '..', dbPath);

fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

const db = new Database(resolvedPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema ───────────────────────────────────────────────────────────────────

db.exec(`
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
    -- Vector embedding (Float32 BLOB, 1536 dims = 6144 bytes)
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
    id            TEXT PRIMARY KEY,
    session_id    TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    file_name     TEXT NOT NULL,
    file_size     INTEGER,
    raw_text      TEXT,
    final_score   INTEGER NOT NULL,
    grade_label   TEXT,
    grade_color   TEXT,
    breakdown     TEXT NOT NULL,
    -- AI-extracted candidate information
    title         TEXT,
    location      TEXT,
    email         TEXT,
    phone         TEXT,
    strengths     TEXT DEFAULT '[]',
    weaknesses    TEXT DEFAULT '[]',
    summary       TEXT,
    -- Vector embedding for the resume
    embedding     BLOB,
    embedding_model TEXT,
    status        TEXT DEFAULT 'new',
    notes         TEXT,
    created_at    TEXT DEFAULT (datetime('now')),
    updated_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_candidates_session ON candidates(session_id);
  CREATE INDEX IF NOT EXISTS idx_candidates_status  ON candidates(status);
  CREATE INDEX IF NOT EXISTS idx_sessions_job       ON sessions(job_id);
`);

// ─── Migrations: add columns if upgrading from older schema ──────────────────
// (safe to run on existing DBs — ALTER TABLE IF NOT EXISTS column is not in SQLite,
//  so we check the column list first)

const jobCols      = db.prepare("PRAGMA table_info(jobs)").all().map((c) => c.name);
const candidateCols = db.prepare("PRAGMA table_info(candidates)").all().map((c) => c.name);

if (!jobCols.includes('embedding'))       db.exec("ALTER TABLE jobs ADD COLUMN embedding BLOB");
if (!jobCols.includes('embedding_model')) db.exec("ALTER TABLE jobs ADD COLUMN embedding_model TEXT");
if (!jobCols.includes('embedding_at'))    db.exec("ALTER TABLE jobs ADD COLUMN embedding_at TEXT");
if (!jobCols.includes('min_experience'))  db.exec("ALTER TABLE jobs ADD COLUMN min_experience INTEGER DEFAULT 0");
if (!jobCols.includes('education_level')) db.exec("ALTER TABLE jobs ADD COLUMN education_level TEXT");
if (!jobCols.includes('required_skills')) db.exec("ALTER TABLE jobs ADD COLUMN required_skills TEXT DEFAULT '[]'");
if (!jobCols.includes('nice_to_have_skills')) db.exec("ALTER TABLE jobs ADD COLUMN nice_to_have_skills TEXT DEFAULT '[]'");
if (!jobCols.includes('responsibilities')) db.exec("ALTER TABLE jobs ADD COLUMN responsibilities TEXT DEFAULT '[]'");
if (!jobCols.includes('salary'))          db.exec("ALTER TABLE jobs ADD COLUMN salary TEXT DEFAULT ''");
if (!jobCols.includes('summary'))         db.exec("ALTER TABLE jobs ADD COLUMN summary TEXT DEFAULT ''");
if (!jobCols.includes('parsed_by'))       db.exec("ALTER TABLE jobs ADD COLUMN parsed_by TEXT DEFAULT 'nlp'");

if (!candidateCols.includes('embedding'))       db.exec("ALTER TABLE candidates ADD COLUMN embedding BLOB");
if (!candidateCols.includes('embedding_model')) db.exec("ALTER TABLE candidates ADD COLUMN embedding_model TEXT");
if (!candidateCols.includes('title'))           db.exec("ALTER TABLE candidates ADD COLUMN title TEXT");
if (!candidateCols.includes('location'))        db.exec("ALTER TABLE candidates ADD COLUMN location TEXT");
if (!candidateCols.includes('email'))           db.exec("ALTER TABLE candidates ADD COLUMN email TEXT");
if (!candidateCols.includes('phone'))           db.exec("ALTER TABLE candidates ADD COLUMN phone TEXT");
if (!candidateCols.includes('strengths'))       db.exec("ALTER TABLE candidates ADD COLUMN strengths TEXT DEFAULT '[]'");
if (!candidateCols.includes('weaknesses'))      db.exec("ALTER TABLE candidates ADD COLUMN weaknesses TEXT DEFAULT '[]'");
if (!candidateCols.includes('summary'))         db.exec("ALTER TABLE candidates ADD COLUMN summary TEXT");

export default db;
