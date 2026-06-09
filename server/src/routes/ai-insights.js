/**
 * AI-powered candidate insights and explanations
 * Provides detailed reasoning about scores, comparisons, and recommendations
 */

import { Router } from 'express';
import OpenAI from 'openai';
import db from '../db.js';

const router = Router();

let openaiClient = null;

function getClient() {
  if (!openaiClient && process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

function isAIEnabled() {
  return !!process.env.OPENAI_API_KEY;
}

/**
 * POST /api/ai-insights/explain-candidate
 * Generate detailed explanation for a candidate's score
 */
router.post('/explain-candidate', async (req, res) => {
  try {
    if (!isAIEnabled()) {
      return res.status(503).json({ 
        error: 'AI features not available. Please configure OPENAI_API_KEY.' 
      });
    }

    const { candidateId } = req.body;
    
    if (!candidateId) {
      return res.status(400).json({ error: 'candidateId is required' });
    }

    // Fetch candidate data
    const candidate = db.prepare(`
      SELECT c.*, s.job_title, j.description as job_description
      FROM candidates c
      JOIN sessions s ON c.session_id = s.id
      LEFT JOIN jobs j ON s.job_id = j.id
      WHERE c.id = ?
    `).get(candidateId);

    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const breakdown = JSON.parse(candidate.breakdown || '{}');
    
    const client = getClient();
    const prompt = `You are an expert HR analyst. Provide a detailed, professional explanation of this candidate's resume evaluation.

CANDIDATE: ${candidate.name}
JOB POSITION: ${candidate.job_title}

SCORES:
- Final Score: ${candidate.final_score}%
- Skills: ${breakdown.skills?.score || 0}%
- Experience: ${breakdown.experience?.score || 0}%
- Education: ${breakdown.education?.score || 0}%
- Overall Fit: ${breakdown.tfidf?.score || 0}%

MATCHED SKILLS: ${breakdown.skills?.matched?.join(', ') || 'None'}
MISSING SKILLS: ${breakdown.skills?.missing?.join(', ') || 'None'}
EXPERIENCE: ${breakdown.experience?.detectedYears || 0} years detected
EDUCATION: ${breakdown.education?.level || 'Not specified'}

${candidate.job_description ? `JOB REQUIREMENTS:\n${candidate.job_description.slice(0, 1500)}` : ''}

Provide a comprehensive analysis in JSON format:
{
  "overallAssessment": "<2-3 sentences explaining the overall score and fit>",
  "scoreBreakdown": {
    "skills": "<Why this skills score? What's strong/weak?>",
    "experience": "<Why this experience score? Is it sufficient?>",
    "education": "<Why this education score? Does it meet requirements?>",
    "overallFit": "<Why this overall fit score? Cultural/role alignment?>"
  },
  "keyStrengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "keyWeaknesses": ["<weakness 1>", "<weakness 2>"],
  "missingCriticalSkills": ["<skill 1>", "<skill 2>"],
  "developmentAreas": ["<area 1>", "<area 2>"],
  "recommendation": "<Should we proceed? Interview? Reject? Why?>",
  "interviewFocus": ["<topic 1 to probe>", "<topic 2 to probe>"],
  "hiringRisk": "<low|medium|high>",
  "riskFactors": ["<risk 1>", "<risk 2>"]
}`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    });

    const insights = JSON.parse(response.choices[0].message.content);

    res.json({
      candidateId,
      candidateName: candidate.name,
      finalScore: candidate.final_score,
      insights,
      generatedAt: new Date().toISOString(),
    });

  } catch (err) {
    console.error('AI insights error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate insights' });
  }
});

/**
 * POST /api/ai-insights/compare-candidates
 * Compare multiple candidates and explain who is better and why
 */
router.post('/compare-candidates', async (req, res) => {
  try {
    if (!isAIEnabled()) {
      return res.status(503).json({ 
        error: 'AI features not available. Please configure OPENAI_API_KEY.' 
      });
    }

    const { candidateIds } = req.body;
    
    if (!candidateIds || !Array.isArray(candidateIds) || candidateIds.length < 2) {
      return res.status(400).json({ error: 'At least 2 candidateIds are required' });
    }

    if (candidateIds.length > 5) {
      return res.status(400).json({ error: 'Maximum 5 candidates can be compared at once' });
    }

    // Fetch all candidates
    const placeholders = candidateIds.map(() => '?').join(',');
    const candidates = db.prepare(`
      SELECT c.*, s.job_title, j.description as job_description
      FROM candidates c
      JOIN sessions s ON c.session_id = s.id
      LEFT JOIN jobs j ON s.job_id = j.id
      WHERE c.id IN (${placeholders})
    `).all(...candidateIds);

    if (candidates.length < 2) {
      return res.status(404).json({ error: 'Not enough candidates found' });
    }

    // Build comparison data
    const candidateData = candidates.map(c => {
      const breakdown = JSON.parse(c.breakdown || '{}');
      return {
        name: c.name,
        finalScore: c.final_score,
        grade: c.grade_label,
        skills: {
          score: breakdown.skills?.score || 0,
          matched: breakdown.skills?.matched || [],
          missing: breakdown.skills?.missing || [],
        },
        experience: {
          score: breakdown.experience?.score || 0,
          years: breakdown.experience?.detectedYears || 0,
        },
        education: {
          score: breakdown.education?.score || 0,
          level: breakdown.education?.level || 'Not specified',
        },
      };
    });

    const jobTitle = candidates[0].job_title;
    const jobDescription = candidates[0].job_description?.slice(0, 1000) || '';

    const client = getClient();
    const prompt = `You are an expert HR analyst comparing candidates for a position. Provide a detailed comparison and recommendation.

JOB POSITION: ${jobTitle}
${jobDescription ? `JOB REQUIREMENTS: ${jobDescription}` : ''}

CANDIDATES:
${candidateData.map((c, i) => `
${i + 1}. ${c.name}
   - Final Score: ${c.finalScore}% (${c.grade})
   - Skills: ${c.skills.score}% | Matched: ${c.skills.matched.join(', ') || 'None'} | Missing: ${c.skills.missing.join(', ') || 'None'}
   - Experience: ${c.experience.score}% (${c.experience.years} years)
   - Education: ${c.education.score}% (${c.education.level})
`).join('\n')}

Provide a comprehensive comparison in JSON format:
{
  "summary": "<2-3 sentences comparing all candidates>",
  "topCandidate": "<name of the best candidate>",
  "topCandidateReason": "<Why is this candidate the best choice?>",
  "ranking": [
    {
      "name": "<candidate name>",
      "rank": 1,
      "reasoning": "<Why this rank?>"
    }
  ],
  "comparisonMatrix": {
    "skills": "<Who has better skills and why?>",
    "experience": "<Who has better experience and why?>",
    "education": "<Who has better education and why?>",
    "overallFit": "<Who fits better overall and why?>"
  },
  "uniqueStrengths": {
    "<candidate name>": ["<unique strength 1>", "<unique strength 2>"],
    "<candidate name>": ["<unique strength 1>", "<unique strength 2>"]
  },
  "recommendation": "<Final hiring recommendation with reasoning>",
  "alternativeScenarios": "<When would you choose a different candidate?>"
}`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const comparison = JSON.parse(response.choices[0].message.content);

    res.json({
      jobTitle,
      candidateCount: candidates.length,
      candidates: candidateData,
      comparison,
      generatedAt: new Date().toISOString(),
    });

  } catch (err) {
    console.error('AI comparison error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate comparison' });
  }
});

/**
 * POST /api/ai-insights/explain-score
 * Quick explanation of why a specific score was given
 */
router.post('/explain-score', async (req, res) => {
  try {
    if (!isAIEnabled()) {
      return res.status(503).json({ 
        error: 'AI features not available. Please configure OPENAI_API_KEY.' 
      });
    }

    const { candidateId, scoreType } = req.body;
    
    if (!candidateId || !scoreType) {
      return res.status(400).json({ error: 'candidateId and scoreType are required' });
    }

    const validScoreTypes = ['skills', 'experience', 'education', 'overall', 'final'];
    if (!validScoreTypes.includes(scoreType)) {
      return res.status(400).json({ 
        error: `Invalid scoreType. Must be one of: ${validScoreTypes.join(', ')}` 
      });
    }

    // Fetch candidate data
    const candidate = db.prepare(`
      SELECT c.*, s.job_title
      FROM candidates c
      JOIN sessions s ON c.session_id = s.id
      WHERE c.id = ?
    `).get(candidateId);

    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const breakdown = JSON.parse(candidate.breakdown || '{}');
    
    let scoreValue, scoreDetails;
    switch (scoreType) {
      case 'skills':
        scoreValue = breakdown.skills?.score || 0;
        scoreDetails = `Matched: ${breakdown.skills?.matched?.join(', ') || 'None'}, Missing: ${breakdown.skills?.missing?.join(', ') || 'None'}`;
        break;
      case 'experience':
        scoreValue = breakdown.experience?.score || 0;
        scoreDetails = `${breakdown.experience?.detectedYears || 0} years detected`;
        break;
      case 'education':
        scoreValue = breakdown.education?.score || 0;
        scoreDetails = breakdown.education?.level || 'Not specified';
        break;
      case 'overall':
        scoreValue = breakdown.tfidf?.score || 0;
        scoreDetails = 'Overall fit and relevance';
        break;
      case 'final':
        scoreValue = candidate.final_score;
        scoreDetails = `Weighted average of all scores`;
        break;
    }

    const client = getClient();
    const prompt = `Explain in 2-3 clear sentences why this candidate received a ${scoreValue}% score for ${scoreType}.

Candidate: ${candidate.name}
Position: ${candidate.job_title}
Score Type: ${scoreType}
Score: ${scoreValue}%
Details: ${scoreDetails}

Provide a brief, professional explanation that a hiring manager would understand.`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 200,
    });

    const explanation = response.choices[0].message.content.trim();

    res.json({
      candidateId,
      candidateName: candidate.name,
      scoreType,
      scoreValue,
      explanation,
      generatedAt: new Date().toISOString(),
    });

  } catch (err) {
    console.error('Score explanation error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate explanation' });
  }
});

export default router;
