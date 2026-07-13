/**
 * API client — all calls to the Express backend.
 */

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  const data = await res.json().catch(() => ({ error: 'Invalid server response' }));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ─── Health ───────────────────────────────────────────────────────────────────
export const getHealth = () => request('/health');

// ─── Jobs ─────────────────────────────────────────────────────────────────────
export const getJobs       = (status) => request(`/jobs${status ? `?status=${status}` : ''}`);
export const getJob        = (id)     => request(`/jobs/${id}`);
export const createJob     = (body)   => request('/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export const updateJob     = (id, b)  => request(`/jobs/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
export const deleteJob     = (id)     => request(`/jobs/${id}`, { method: 'DELETE' });

/**
 * Parse a job description (file or text) — returns structured preview, does NOT save.
 */
export async function parseJobDescription({ file, text, useAI = true }) {
  const form = new FormData();
  if (file) form.append('file', file);
  if (text) form.append('text', text);
  form.append('useAI', String(useAI));
  return request('/jobs/parse', { method: 'POST', body: form });
}

export const updateJobStatus = (id, status) =>
  request(`/jobs/${id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });

export const getJobEmbedding  = (id) => request(`/jobs/${id}/embedding`);
export const vectorizeJob     = (id) => request(`/jobs/${id}/vectorize`, { method: 'POST' });

// ─── Match ────────────────────────────────────────────────────────────────────
/**
 * Submit a match job.
 * @param {Object} params
 * @param {File|null}  params.requirementsFile
 * @param {string}     params.requirementsText
 * @param {File[]}     params.resumeFiles
 * @param {string}     params.jobId
 * @param {string}     params.jobTitle
 * @param {Object}     params.preferences
 * @param {string}     params.matchMode - 'hybrid' | 'ai' | 'nlp'
 */
export async function submitMatch({ requirementsFile, requirementsText, resumeFiles, jobId, jobTitle, preferences, matchMode = 'hybrid' }) {
  const form = new FormData();

  if (requirementsFile) form.append('requirements', requirementsFile);
  if (requirementsText) form.append('requirementsText', requirementsText);

  for (const file of resumeFiles) form.append('resumes', file);

  if (jobId)    form.append('jobId', jobId);
  if (jobTitle) form.append('jobTitle', jobTitle);

  form.append('preferences', JSON.stringify(preferences));
  form.append('matchMode', matchMode);

  return request('/match', { method: 'POST', body: form });
}

// ─── Sessions ─────────────────────────────────────────────────────────────────
export const getSessions   = ()   => request('/sessions');
export const getSession    = (id) => request(`/sessions/${id}`);
export const deleteSession = (id) => request(`/sessions/${id}`, { method: 'DELETE' });

// ─── Candidates ───────────────────────────────────────────────────────────────
export const getCandidates = (params = {}) => {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '')).toString();
  return request(`/candidates${qs ? `?${qs}` : ''}`);
};
export const getCandidate       = (id)          => request(`/candidates/${id}`);
export const updateCandidateStatus = (id, status, notes) =>
  request(`/candidates/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, notes }) });
export const deleteCandidate = (id) => request(`/candidates/${id}`, { method: 'DELETE' });
export const exportCandidatesCSV = (params = {}) => {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
  window.open(`${BASE}/candidates/export/csv${qs ? `?${qs}` : ''}`, '_blank');
};

// ─── Analytics ────────────────────────────────────────────────────────────────
export const getAnalyticsSummary  = () => request('/analytics/summary');
export const getSessionsTrend     = () => request('/analytics/sessions-trend');
export const getTopSkills         = () => request('/analytics/top-skills');

// ─── Data ────────────────────────────────────────────────────────────────────
export const clearAllData = () => request('/data/clear-all', { method: 'DELETE' });

export const explainCandidate = (candidateId) =>
  request('/ai-insights/explain-candidate', { 
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' }, 
    body: JSON.stringify({ candidateId }) 
  });

export const compareCandidates = (candidateIds) =>
  request('/ai-insights/compare-candidates', { 
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' }, 
    body: JSON.stringify({ candidateIds }) 
  });

export const explainScore = (candidateId, scoreType) =>
  request('/ai-insights/explain-score', { 
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' }, 
    body: JSON.stringify({ candidateId, scoreType }) 
  });
