import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET /api/analytics/summary
router.get('/summary', (req, res) => {
  const totalCandidates = db.prepare('SELECT COUNT(*) as count FROM candidates').get().count;
  const totalSessions   = db.prepare('SELECT COUNT(*) as count FROM sessions').get().count;
  const totalJobs       = db.prepare('SELECT COUNT(*) as count FROM jobs').get().count;
  const activeJobs      = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status='active'").get().count;
  const hired           = db.prepare("SELECT COUNT(*) as count FROM candidates WHERE status='hired'").get().count;

  const avgScore = db.prepare('SELECT AVG(final_score) as avg FROM candidates').get().avg || 0;

  const pipelineCounts = db.prepare(`
    SELECT status, COUNT(*) as count FROM candidates GROUP BY status
  `).all();

  const scoreDistribution = [
    { range: '85-100', count: db.prepare('SELECT COUNT(*) as c FROM candidates WHERE final_score >= 85').get().c },
    { range: '70-84',  count: db.prepare('SELECT COUNT(*) as c FROM candidates WHERE final_score >= 70 AND final_score < 85').get().c },
    { range: '55-69',  count: db.prepare('SELECT COUNT(*) as c FROM candidates WHERE final_score >= 55 AND final_score < 70').get().c },
    { range: '40-54',  count: db.prepare('SELECT COUNT(*) as c FROM candidates WHERE final_score >= 40 AND final_score < 55').get().c },
    { range: '0-39',   count: db.prepare('SELECT COUNT(*) as c FROM candidates WHERE final_score < 40').get().c },
  ];

  res.json({
    totalCandidates,
    totalSessions,
    totalJobs,
    activeJobs,
    hired,
    conversionRate: totalCandidates > 0 ? Math.round((hired / totalCandidates) * 100) : 0,
    avgScore: Math.round(avgScore),
    pipelineCounts: Object.fromEntries(pipelineCounts.map((r) => [r.status, r.count])),
    scoreDistribution,
  });
});

// GET /api/analytics/sessions-trend
router.get('/sessions-trend', (req, res) => {
  const trend = db.prepare(`
    SELECT
      date(created_at) as date,
      COUNT(*) as sessions,
      SUM(result_count) as candidates
    FROM sessions
    GROUP BY date(created_at)
    ORDER BY date ASC
    LIMIT 30
  `).all();
  res.json({ trend });
});

// GET /api/analytics/top-skills
router.get('/top-skills', (req, res) => {
  // Parse breakdown JSON and aggregate matched skills
  const candidates = db.prepare('SELECT breakdown FROM candidates').all();
  const skillFreq = {};

  for (const c of candidates) {
    try {
      const breakdown = JSON.parse(c.breakdown || '{}');
      for (const skill of breakdown.skills?.matched || []) {
        skillFreq[skill] = (skillFreq[skill] || 0) + 1;
      }
    } catch { /* skip malformed */ }
  }

  const topSkills = Object.entries(skillFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([skill, count]) => ({ skill, count }));

  res.json({ topSkills });
});

export default router;
