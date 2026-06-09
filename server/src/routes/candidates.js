import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET /api/candidates  — all candidates with optional filters
router.get('/', (req, res) => {
  const { status, sessionId, search, sortBy = 'final_score', order = 'DESC', limit = 100, offset = 0 } = req.query;

  let query = 'SELECT c.*, s.job_title FROM candidates c JOIN sessions s ON s.id = c.session_id WHERE 1=1';
  const params = [];

  if (status)    { query += ' AND c.status = ?';                    params.push(status); }
  if (sessionId) { query += ' AND c.session_id = ?';                params.push(sessionId); }
  if (search)    { query += ' AND (c.name LIKE ? OR s.job_title LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

  const validSort  = ['final_score', 'name', 'created_at', 'status'].includes(sortBy) ? sortBy : 'final_score';
  const validOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  query += ` ORDER BY c.${validSort} ${validOrder} LIMIT ? OFFSET ?`;
  params.push(parseInt(limit, 10), parseInt(offset, 10));

  const candidates = db.prepare(query).all(...params);
  const total = db.prepare(
    'SELECT COUNT(*) as count FROM candidates c JOIN sessions s ON s.id = c.session_id WHERE 1=1' +
    (status    ? ' AND c.status = ?' : '') +
    (sessionId ? ' AND c.session_id = ?' : '') +
    (search    ? ' AND (c.name LIKE ? OR s.job_title LIKE ?)' : '')
  ).get(...params.slice(0, -2));

  res.json({
    candidates: candidates.map(parseCandidate),
    total: total.count,
    limit: parseInt(limit, 10),
    offset: parseInt(offset, 10),
  });
});

// GET /api/candidates/:id
router.get('/:id', (req, res) => {
  const candidate = db.prepare(`
    SELECT c.*, s.job_title, s.preferences FROM candidates c
    JOIN sessions s ON s.id = c.session_id
    WHERE c.id = ?
  `).get(req.params.id);

  if (!candidate) return res.status(404).json({ error: 'Candidate not found' });
  res.json({ candidate: parseCandidate(candidate) });
});

// PATCH /api/candidates/:id  — update status or notes
router.patch('/:id', (req, res) => {
  const { status, notes } = req.body;
  const allowed = ['new', 'shortlisted', 'interview', 'offered', 'hired', 'rejected'];

  if (status && !allowed.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${allowed.join(', ')}` });
  }

  const existing = db.prepare('SELECT id FROM candidates WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Candidate not found' });

  const updates = [];
  const params  = [];
  if (status !== undefined) { updates.push('status = ?');     params.push(status); }
  if (notes  !== undefined) { updates.push('notes = ?');      params.push(notes); }
  updates.push("updated_at = datetime('now')");

  db.prepare(`UPDATE candidates SET ${updates.join(', ')} WHERE id = ?`).run(...params, req.params.id);

  const updated = db.prepare('SELECT * FROM candidates WHERE id = ?').get(req.params.id);
  res.json({ candidate: parseCandidate(updated) });
});

// GET /api/candidates/export/csv  — export all filtered candidates as CSV
router.get('/export/csv', (req, res) => {
  const { status, sessionId } = req.query;

  let query = 'SELECT c.*, s.job_title FROM candidates c JOIN sessions s ON s.id = c.session_id WHERE 1=1';
  const params = [];
  if (status)    { query += ' AND c.status = ?';     params.push(status); }
  if (sessionId) { query += ' AND c.session_id = ?'; params.push(sessionId); }
  query += ' ORDER BY c.final_score DESC';

  const candidates = db.prepare(query).all(...params).map(parseCandidate);

  const headers = ['Name', 'File', 'Job', 'Score', 'Grade', 'Status', 'Skills Score', 'Exp Score', 'Edu Score', 'Matched Skills', 'Missing Skills', 'Notes'];
  const rows = candidates.map((c) => [
    c.name, c.file_name, c.job_title, c.final_score, c.grade_label, c.status,
    c.breakdown?.skills?.score ?? '',
    c.breakdown?.experience?.score ?? '',
    c.breakdown?.education?.score ?? '',
    (c.breakdown?.skills?.matched || []).join('; '),
    (c.breakdown?.skills?.missing || []).join('; '),
    c.notes || '',
  ]);

  const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="candidates.csv"');
  res.send(csv);
});

function parseCandidate(c) {
  const parsed = { ...c };
  if (typeof parsed.breakdown === 'string') parsed.breakdown = JSON.parse(parsed.breakdown || '{}');
  if (typeof parsed.preferences === 'string') parsed.preferences = JSON.parse(parsed.preferences || '{}');
  if (typeof parsed.strengths === 'string') parsed.strengths = JSON.parse(parsed.strengths || '[]');
  if (typeof parsed.weaknesses === 'string') parsed.weaknesses = JSON.parse(parsed.weaknesses || '[]');
  return parsed;
}

export default router;
