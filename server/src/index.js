import 'dotenv/config';
import { config } from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

// Force .env file to override system environment variables
config({ override: true });

import jobsRouter      from './routes/jobs.js';
import matchRouter     from './routes/match.js';
import sessionsRouter  from './routes/sessions.js';
import candidatesRouter from './routes/candidates.js';
import analyticsRouter from './routes/analytics.js';
import aiInsightsRouter from './routes/ai-insights.js';

// Check if OpenAI API key is configured
function isAIEnabled() {
  return !!process.env.OPENAI_API_KEY;
}

const app  = express();
const PORT = process.env.PORT || 3001;

// ─── Security & middleware ────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting — generous for dev, tighten for production
app.use('/api/match', rateLimit({ windowMs: 60_000, max: 20, message: { error: 'Too many requests' } }));
app.use('/api',       rateLimit({ windowMs: 60_000, max: 200 }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/jobs',        jobsRouter);
app.use('/api/match',       matchRouter);
app.use('/api/sessions',    sessionsRouter);
app.use('/api/candidates',  candidatesRouter);
app.use('/api/analytics',   analyticsRouter);
app.use('/api/ai-insights', aiInsightsRouter);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status:    'ok',
    version:   '1.0.0',
    aiEnabled: isAIEnabled(),
    engine:    'Hybrid Matcher (Rule-based + Embeddings)',
    timestamp: new Date().toISOString(),
  });
});

// ─── 404 & error handlers ─────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` }));

app.use((err, req, res, next) => {
  console.error(err);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: `File too large. Max size: ${process.env.MAX_FILE_SIZE_MB || 10}MB` });
  }
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Resume Matcher API running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
  console.log(`\n   Engine: Hybrid Matcher (Rule-based + Embeddings)`);
  
  if (isAIEnabled()) {
    console.log(`   AI Embeddings: ✅ Enabled`);
    console.log(`   AI Analysis: ✅ Enabled (candidate extraction + strengths/weaknesses)\n`);
  } else {
    console.log(`\n   ⚠️  WARNING: OpenAI API key not configured!`);
    console.log(`   ❌ AI Embeddings: Disabled`);
    console.log(`   ❌ AI Analysis: Disabled`);
    console.log(`\n   The system REQUIRES an OpenAI API key to function.`);
    console.log(`   Please add OPENAI_API_KEY to your .env file.\n`);
    console.log(`   Get your API key from: https://platform.openai.com/api-keys\n`);
  }
});
