import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET /api/sessions
router.get('/', (req, res) => {
  const sessions = db.prepare(`
    SELECT s.*, COUNT(c.id) as candidate_count
    FROM sessions s
    LEFT JOIN candidates c ON c.session_id = s.id
    GROUP BY s.id
    ORDER BY s.created_at DESC
  `).all();

  res.json({ sessions: sessions.map(parseSession) });
});

// GET /api/sessions/:id  — full session with all candidates
router.get('/:id', (req, res) => {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const candidates = db.prepare(`
    SELECT * FROM candidates WHERE session_id = ? ORDER BY final_score DESC
  `).all(req.params.id);

  res.json({
    session: parseSession(session),
    candidates: candidates.map(parseCandidate),
  });
});

// DELETE /api/sessions/:id
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM sessions WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Session not found' });
  res.json({ success: true });
});

function parseSession(s) {
  return { ...s, preferences: JSON.parse(s.preferences || '{}') };
}

function parseCandidate(c) {
  return { ...c, breakdown: JSON.parse(c.breakdown || '{}') };
}

export default router;
