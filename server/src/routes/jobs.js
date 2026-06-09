import { Router } from 'express';
import multer from 'multer';
import { v4 as uuid } from 'uuid';
import db from '../db.js';
import { extractText } from '../services/fileParser.js';
import { parseJobNLP, parseJobAI } from '../services/jobParser.js';
import {
  embedText,
  vectorToBuffer,
  bufferToVector,
  buildJobEmbeddingText,
} from '../services/embeddingService.js';

const router = Router();

const MAX_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = '.' + file.originalname.split('.').pop().toLowerCase();
    ['.pdf', '.docx', '.doc', '.txt'].includes(ext) ? cb(null, true) : cb(new Error(`Unsupported: ${ext}`));
  },
});

// ─── Helper ───────────────────────────────────────────────────────────────────
function parseJob(row) {
  if (!row) return null;
  return {
    ...row,
    required_skills:     JSON.parse(row.required_skills     || '[]'),
    nice_to_have_skills: JSON.parse(row.nice_to_have_skills || '[]'),
    responsibilities:    JSON.parse(row.responsibilities    || '[]'),
    // Never send the raw embedding blob to the client
    embedding:           undefined,
    is_vectorized:       !!row.embedding,
  };
}

// ─── POST /api/jobs/parse  — analyse doc, return structured preview (no save) ─
router.post(
  '/parse',
  upload.single('file'),
  async (req, res) => {
    try {
      let rawText = req.body.text || '';

      if (!rawText && req.file) {
        rawText = await extractText(req.file.buffer, req.file.originalname);
      }

      if (!rawText?.trim() || rawText.trim().length < 30) {
        return res.status(400).json({ error: 'Please provide a job description (text or file, min 30 chars).' });
      }

      const useAI = req.body.useAI !== 'false' && !!process.env.OPENAI_API_KEY;
      const parsed = useAI ? await parseJobAI(rawText) : parseJobNLP(rawText);

      res.json({ parsed });
    } catch (err) {
      console.error('Parse error:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

// ─── GET /api/jobs ────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const { status } = req.query;
  const rows = status
    ? db.prepare('SELECT * FROM jobs WHERE status = ? ORDER BY created_at DESC').all(status)
    : db.prepare('SELECT * FROM jobs ORDER BY created_at DESC').all();
  res.json({ jobs: rows.map(parseJob) });
});

// ─── GET /api/jobs/:id ────────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Job not found' });
  res.json({ job: parseJob(row) });
});

// ─── POST /api/jobs  — save a confirmed/reviewed job posting ─────────────────
router.post('/', async (req, res) => {
  const {
    title, department, location, type, description,
    minExperience, educationLevel,
    requiredSkills, niceToHaveSkills, responsibilities,
    salary, summary, parsedBy,
  } = req.body;

  if (!title?.trim() || !description?.trim()) {
    return res.status(400).json({ error: 'title and description are required' });
  }

  const id = uuid();

  // ── 1. Insert the job first (without embedding) ───────────────────────────
  db.prepare(`
    INSERT INTO jobs (
      id, title, department, location, type, description, status,
      min_experience, education_level, required_skills, nice_to_have_skills,
      responsibilities, salary, summary, parsed_by
    ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    title.trim(),
    department || 'Engineering',
    location   || '',
    type       || 'Full-time',
    description.trim(),
    minExperience   || 0,
    educationLevel  || '',
    JSON.stringify(requiredSkills     || []),
    JSON.stringify(niceToHaveSkills   || []),
    JSON.stringify(responsibilities   || []),
    salary    || '',
    summary   || '',
    parsedBy  || 'nlp',
  );

  const savedJob = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);

  // ── 2. Generate and store embedding asynchronously ────────────────────────
  // We respond immediately so the UI isn't blocked, then vectorize in background
  res.status(201).json({ job: parseJob(savedJob), vectorizing: true });

  // Background vectorization
  try {
    const embeddingText = buildJobEmbeddingText(savedJob);
    const vector = await embedText(embeddingText);
    const blob   = vectorToBuffer(vector);

    db.prepare(`
      UPDATE jobs
      SET embedding = ?, embedding_model = 'text-embedding-3-small', embedding_at = datetime('now')
      WHERE id = ?
    `).run(blob, id);

    console.log(`✓ Vectorized job "${title}" (${id}) — ${vector.length} dims`);
  } catch (err) {
    console.error(`✗ Embedding failed for job "${title}" (${id}):`, err.message);
    // Job is still saved and usable — matching falls back to NLP scoring
  }
});

// ─── PUT /api/jobs/:id ────────────────────────────────────────────────────────
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM jobs WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Job not found' });

  const {
    title, department, location, type, description, status,
    minExperience, educationLevel,
    requiredSkills, niceToHaveSkills, responsibilities,
    salary, summary,
  } = req.body;

  db.prepare(`
    UPDATE jobs SET
      title=?, department=?, location=?, type=?, description=?, status=?,
      min_experience=?, education_level=?, required_skills=?, nice_to_have_skills=?,
      responsibilities=?, salary=?, summary=?, updated_at=datetime('now')
    WHERE id=?
  `).run(
    title, department, location, type, description, status || 'active',
    minExperience || 0, educationLevel || '',
    JSON.stringify(requiredSkills     || []),
    JSON.stringify(niceToHaveSkills   || []),
    JSON.stringify(responsibilities   || []),
    salary || '', summary || '',
    req.params.id,
  );

  res.json({ job: parseJob(db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id)) });
});

// ─── PATCH /api/jobs/:id/status ───────────────────────────────────────────────
router.patch('/:id/status', (req, res) => {
  const { status } = req.body;
  const allowed = ['active', 'closed', 'draft'];
  if (!allowed.includes(status)) return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });

  db.prepare("UPDATE jobs SET status=?, updated_at=datetime('now') WHERE id=?").run(status, req.params.id);
  res.json({ success: true });
});

// ─── GET /api/jobs/:id/embedding ─ check vectorization status ────────────────
router.get('/:id/embedding', (req, res) => {
  const row = db.prepare('SELECT id, title, embedding, embedding_model, embedding_at FROM jobs WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Job not found' });
  res.json({
    jobId:          row.id,
    title:          row.title,
    isVectorized:   !!row.embedding,
    embeddingModel: row.embedding_model || null,
    embeddingAt:    row.embedding_at    || null,
    dims:           row.embedding ? row.embedding.length / 4 : 0, // float32 = 4 bytes
  });
});

// ─── POST /api/jobs/:id/vectorize ─ (re)generate embedding on demand ─────────
router.post('/:id/vectorize', async (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  try {
    const embeddingText = buildJobEmbeddingText(job);
    const vector = await embedText(embeddingText);
    const blob   = vectorToBuffer(vector);

    db.prepare(`
      UPDATE jobs
      SET embedding = ?, embedding_model = 'text-embedding-3-small', embedding_at = datetime('now')
      WHERE id = ?
    `).run(blob, job.id);

    console.log(`✓ Re-vectorized job "${job.title}" — ${vector.length} dims`);
    res.json({ success: true, dims: vector.length, model: 'text-embedding-3-small' });
  } catch (err) {
    console.error('Vectorize error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/jobs/:id ─────────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM jobs WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Job not found' });
  res.json({ success: true });
});

export default router;
