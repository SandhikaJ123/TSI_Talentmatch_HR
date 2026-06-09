import { Router } from 'express';
import multer from 'multer';
import { v4 as uuid } from 'uuid';
import db from '../db.js';
import { extractText } from '../services/fileParser.js';
import { matchResumesHybrid } from '../services/hybridMatcher.js';
import {
  embedBatch,
  vectorToBuffer,
  bufferToVector,
  buildResumeEmbeddingText,
} from '../services/embeddingService.js';

// Check if OpenAI API key is configured
function isAIEnabled() {
  return !!process.env.OPENAI_API_KEY;
}

const router = Router();

const MAX_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = '.' + file.originalname.split('.').pop().toLowerCase();
    ['.pdf', '.docx', '.doc', '.txt'].includes(ext) ? cb(null, true) : cb(new Error(`File type not allowed: ${ext}`));
  },
});

/**
 * POST /api/match
 *
 * Multipart form fields:
 *   - requirements (file) OR requirementsText (string)
 *   - resumes[]  (files, up to 50)
 *   - jobId      (optional — if provided, uses stored job embedding)
 *   - jobTitle   (optional)
 *   - preferences (JSON string)
 */
router.post(
  '/',
  upload.fields([
    { name: 'requirements', maxCount: 1 },
    { name: 'resumes',      maxCount: 50 },
  ]),
  async (req, res) => {
    try {
      // ── 1. Requirements text ───────────────────────────────────────────────
      let requirementsText = req.body.requirementsText || '';

      if (!requirementsText && req.files?.requirements?.[0]) {
        const f = req.files.requirements[0];
        requirementsText = await extractText(f.buffer, f.originalname);
      }

      // If a jobId is provided, load the stored description as fallback
      const jobId = req.body.jobId || null;
      let jobRow  = null;
      if (jobId) {
        jobRow = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
        if (jobRow && !requirementsText) {
          requirementsText = jobRow.description;
        }
      }

      if (!requirementsText?.trim()) {
        return res.status(400).json({ error: 'Job requirements are required (text or file).' });
      }

      // ── 2. Parse resumes ───────────────────────────────────────────────────
      // TODO: Add validation to check if uploaded file is actually a resume vs job description
      // TODO: Implement document type detection (resume indicators: contact info, experience, education vs JD indicators: requirements, responsibilities)
      // TODO: Reject non-resume files with clear error messages
      const resumeFiles = req.files?.resumes || [];
      if (resumeFiles.length === 0) {
        return res.status(400).json({ error: 'At least one resume file is required.' });
      }

      const parseErrors = [];
      const parsedResumes = (
        await Promise.all(
          resumeFiles.map(async (file) => {
            try {
              const text = await extractText(file.buffer, file.originalname);
              // TODO: Validate that extracted text looks like a resume (check for resume-specific sections)
              const name = file.originalname.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
              return { name, fileName: file.originalname, fileSize: file.size, text };
            } catch (err) {
              parseErrors.push({ file: file.originalname, error: err.message });
              return null;
            }
          })
        )
      ).filter(Boolean);

      if (parsedResumes.length === 0) {
        return res.status(400).json({ error: 'Could not parse any resume files.', details: parseErrors });
      }

      // ── 3. Preferences ─────────────────────────────────────────────────────
      let preferences = {};
      try { preferences = req.body.preferences ? JSON.parse(req.body.preferences) : {}; }
      catch { return res.status(400).json({ error: 'Invalid preferences JSON.' }); }

      const prefs = {
        skillsWeight:       Number(preferences.skillsWeight      ?? 40),
        experienceWeight:   Number(preferences.experienceWeight   ?? 25),
        educationWeight:    Number(preferences.educationWeight    ?? 20),
        overallWeight:      Number(preferences.overallWeight      ?? 15),
      };

      // ── 4. Get job embedding for semantic matching ────────────────────────
      let jobVector = null;
      if (jobRow?.embedding) {
        jobVector = bufferToVector(jobRow.embedding);
        console.log(`Using stored job embedding (${jobVector.length} dims) for "${jobRow.title}"`);
      }

      // ── 5. Run Hybrid matching ────────────────────────────────────────────
      console.log('Using Hybrid matcher (Rule-based + Embeddings)');
      
      let results;
      let scoringMethod = 'hybrid';

      try {
        results = await matchResumesHybrid(
          requirementsText,
          parsedResumes,
          prefs,
          jobVector
        );
      } catch (err) {
        console.error('Hybrid matching error:', err);
        return res.status(500).json({ error: 'Matching failed: ' + err.message });
      }

      // ── 6. Store resume embeddings for future use ─────────────────────────
      let resumeEmbeddings = null;
      if (isAIEnabled()) {
        try {
          const texts = parsedResumes.map(buildResumeEmbeddingText);
          resumeEmbeddings = await embedBatch(texts);
          console.log(`✓ Resume embeddings generated for storage`);
        } catch (err) {
          console.error('Resume embedding failed:', err.message);
        }
      }

      // ── 7. Persist session + candidates ───────────────────────────────────
      const sessionId = uuid();
      const jobTitle  = req.body.jobTitle || jobRow?.title || 'Untitled Session';

      // Only use jobId if the job actually exists in the database
      const validJobId = jobRow ? jobId : null;

      db.prepare(`
        INSERT INTO sessions (id, job_id, job_title, preferences, result_count)
        VALUES (?, ?, ?, ?, ?)
      `).run(sessionId, validJobId, jobTitle, JSON.stringify(prefs), results.length);

      const insertCandidate = db.prepare(`
        INSERT INTO candidates
          (id, session_id, name, file_name, file_size, raw_text,
           final_score, grade_label, grade_color, breakdown, 
           title, location, email, phone, strengths, weaknesses, summary,
           embedding, embedding_model)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      db.transaction((candidates) => {
        candidates.forEach((c, i) => {
          const resumeIdx = parsedResumes.findIndex((r) => r.fileName === c.fileName);
          const resume    = parsedResumes[resumeIdx];
          const vec       = resumeEmbeddings?.[resumeIdx];

          insertCandidate.run(
            uuid(), sessionId, c.name, c.fileName,
            resume?.fileSize || 0,
            resume?.text?.slice(0, 5000) || '',
            c.finalScore, c.grade.label, c.grade.color,
            JSON.stringify(c.breakdown),
            c.title || null,
            c.location || null,
            c.email || null,
            c.phone || null,
            JSON.stringify(c.strengths || []),
            JSON.stringify(c.weaknesses || []),
            c.summary || null,
            vec ? vectorToBuffer(vec) : null,
            vec ? 'text-embedding-3-small' : null,
          );
        });
      })(results);

      // ── 8. Respond ─────────────────────────────────────────────────────────
      res.json({
        sessionId,
        jobTitle,
        scoredBy:        scoringMethod,
        semanticEnabled: !!jobVector,
        totalParsed:     parsedResumes.length,
        parseErrors,
        results,
      });

    } catch (err) {
      console.error('Match error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  }
);

function getGrade(score) {
  if (score >= 85) return { label: 'Excellent',     color: 'emerald' };
  if (score >= 70) return { label: 'Good',          color: 'blue' };
  if (score >= 55) return { label: 'Fair',          color: 'yellow' };
  if (score >= 40) return { label: 'Below Average', color: 'orange' };
  return              { label: 'Poor',          color: 'red' };
}

export default router;
