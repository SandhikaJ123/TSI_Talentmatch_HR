/**
 * Embedding service using OpenAI text-embedding-3-small.
 *
 * Storage: vectors are serialized as Float32 binary BLOBs in SQLite.
 * A 1536-dim float32 vector = 6144 bytes (~6 KB) per document.
 *
 * Cosine similarity is computed in-process (no vector DB needed).
 */

import OpenAI from 'openai';

// text-embedding-3-small: 1536 dims, ~$0.00002 / 1K tokens
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMS  = 1536;

let _client = null;
function getClient() {
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _client;
}

// ─── Serialization ────────────────────────────────────────────────────────────

/**
 * Float32Array → Buffer (for SQLite BLOB storage)
 */
export function vectorToBuffer(vector) {
  const arr = new Float32Array(vector);
  return Buffer.from(arr.buffer);
}

/**
 * Buffer (SQLite BLOB) → Float32Array
 */
export function bufferToVector(buf) {
  if (!buf) return null;
  // better-sqlite3 returns a Buffer; ensure we have an ArrayBuffer
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Float32Array(ab);
}

// ─── Cosine similarity ────────────────────────────────────────────────────────

/**
 * Cosine similarity between two Float32Arrays.
 * Returns a value in [-1, 1]; higher = more similar.
 */
export function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Convert cosine similarity [-1,1] to a 0-100 score.
 * Typical semantic similarity for related docs is 0.6–0.9.
 */
export function similarityToScore(sim) {
  // Map [0, 1] → [0, 100], clamp negatives to 0
  return Math.round(Math.max(0, Math.min(100, sim * 100)));
}

// ─── Embedding generation ─────────────────────────────────────────────────────

/**
 * Generate an embedding for a single text string.
 * @param {string} text
 * @returns {Promise<Float32Array>}
 */
export async function embedText(text) {
  const client = getClient();
  // Truncate to ~8000 tokens worth of chars (model limit is 8191 tokens)
  const truncated = text.slice(0, 32000);

  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: truncated,
    encoding_format: 'float',
  });

  return new Float32Array(response.data[0].embedding);
}

/**
 * Generate embeddings for multiple texts in a single API call (more efficient).
 * @param {string[]} texts
 * @returns {Promise<Float32Array[]>}
 */
export async function embedBatch(texts) {
  const client = getClient();
  const truncated = texts.map((t) => t.slice(0, 32000));

  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: truncated,
    encoding_format: 'float',
  });

  // API returns embeddings in the same order as input
  return response.data
    .sort((a, b) => a.index - b.index)
    .map((d) => new Float32Array(d.embedding));
}

// ─── Job embedding text ───────────────────────────────────────────────────────

/**
 * Build the text to embed for a job posting.
 * Combines the most semantically rich fields.
 */
export function buildJobEmbeddingText(job) {
  const parts = [
    `Job Title: ${job.title}`,
    job.department ? `Department: ${job.department}` : '',
    job.type       ? `Type: ${job.type}` : '',
    job.summary    ? `Summary: ${job.summary}` : '',
  ];

  const reqSkills = Array.isArray(job.required_skills)
    ? job.required_skills
    : JSON.parse(job.required_skills || '[]');

  const niceSkills = Array.isArray(job.nice_to_have_skills)
    ? job.nice_to_have_skills
    : JSON.parse(job.nice_to_have_skills || '[]');

  const responsibilities = Array.isArray(job.responsibilities)
    ? job.responsibilities
    : JSON.parse(job.responsibilities || '[]');

  if (reqSkills.length)       parts.push(`Required Skills: ${reqSkills.join(', ')}`);
  if (niceSkills.length)      parts.push(`Nice to Have: ${niceSkills.join(', ')}`);
  if (responsibilities.length) parts.push(`Responsibilities: ${responsibilities.join('. ')}`);

  // Include full description last (lower weight by position)
  if (job.description) parts.push(`Full Description: ${job.description.slice(0, 4000)}`);

  return parts.filter(Boolean).join('\n');
}

/**
 * Build the text to embed for a resume.
 */
export function buildResumeEmbeddingText(resume) {
  // Use full text — the model handles long context well
  return resume.text?.slice(0, 32000) || resume.name;
}
