/**
 * Hybrid Resume Matcher - Best of both worlds
 * 
 * Combines:
 * 1. Semantic similarity via embeddings (deterministic, cached)
 * 2. Rule-based scoring for skills, experience, education
 * 3. Advanced NLP for entity extraction
 * 
 * Benefits:
 * - 100% deterministic (same input = same output)
 * - No LLM randomness
 * - Much cheaper than GPT scoring
 * - Fast and reliable
 * - Explainable results
 * 
 * TODO: Convert this module to Python for better NLP capabilities
 * TODO: Use spaCy for entity extraction instead of compromise
 * TODO: Use scikit-learn for more sophisticated matching algorithms
 * TODO: Add document validation before matching (resume vs JD detection)
 */

import natural from 'natural';
import nlp from 'compromise';
import {
  embedBatch,
  cosineSimilarity,
  similarityToScore,
  buildResumeEmbeddingText,
} from './embeddingService.js';
import { extractCandidateInfoBatch, isAIExtractionEnabled } from './aiExtractor.js';

const { TfIdf, JaroWinklerDistance, PorterStemmer, WordTokenizer } = natural;
const tokenizer = new WordTokenizer();

// ─── Skill taxonomy ──────────────────────────────────────────────────────────

const SKILL_GROUPS = {
  languages: ['javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'ruby', 'go', 'golang', 'rust', 'swift', 'kotlin', 'scala', 'php', 'r', 'matlab', 'perl', 'bash', 'shell', 'powershell', 'sql', 'html', 'css', 'dart', 'elixir', 'haskell', 'lua', 'objective-c', 'vb.net', 'assembly'],
  frontend:  ['react', 'angular', 'vue', 'svelte', 'nextjs', 'next.js', 'nuxt', 'sass', 'scss', 'tailwind', 'bootstrap', 'webpack', 'vite', 'redux', 'mobx', 'graphql', 'apollo', 'jquery', 'backbone', 'ember', 'polymer', 'material-ui', 'chakra-ui', 'ant design', 'styled-components'],
  backend:   ['node', 'nodejs', 'express', 'fastapi', 'django', 'flask', 'spring', 'spring boot', 'rails', 'laravel', 'asp.net', 'nestjs', 'koa', 'hapi', 'grpc', 'rest', 'restful', 'soap', 'microservices', 'graphql', 'fastify', 'gin', 'echo', 'fiber'],
  databases: ['sql', 'mysql', 'postgresql', 'postgres', 'mongodb', 'redis', 'elasticsearch', 'dynamodb', 'cassandra', 'oracle', 'sqlite', 'neo4j', 'firebase', 'supabase', 'prisma', 'sequelize', 'typeorm', 'mongoose', 'mariadb', 'couchdb', 'influxdb', 'timescaledb'],
  cloud:     ['aws', 'azure', 'gcp', 'google cloud', 'docker', 'kubernetes', 'k8s', 'terraform', 'ansible', 'jenkins', 'github actions', 'gitlab ci', 'circleci', 'travis ci', 'ci/cd', 'devops', 'linux', 'nginx', 'apache', 'cloudflare', 'heroku', 'vercel', 'netlify', 'digitalocean'],
  data:      ['machine learning', 'deep learning', 'nlp', 'natural language processing', 'computer vision', 'tensorflow', 'pytorch', 'keras', 'scikit-learn', 'pandas', 'numpy', 'spark', 'hadoop', 'airflow', 'dbt', 'tableau', 'power bi', 'looker', 'jupyter', 'matplotlib', 'seaborn', 'opencv'],
  mobile:    ['react native', 'flutter', 'swift', 'kotlin', 'android', 'ios', 'xamarin', 'ionic', 'cordova', 'expo'],
  practices: ['agile', 'scrum', 'kanban', 'tdd', 'test-driven development', 'bdd', 'solid', 'design patterns', 'microservices', 'event-driven', 'ddd', 'domain-driven design', 'clean architecture', 'git', 'jira', 'confluence', 'unit testing', 'integration testing', 'e2e testing'],
  tools:     ['figma', 'sketch', 'photoshop', 'illustrator', 'xd', 'salesforce', 'sap', 'hubspot', 'zendesk', 'excel', 'powerpoint', 'word', 'slack', 'teams', 'notion', 'trello', 'asana', 'postman', 'insomnia', 'vscode', 'intellij', 'eclipse', 'vim', 'emacs'],
  testing:   ['jest', 'mocha', 'chai', 'jasmine', 'pytest', 'junit', 'testng', 'selenium', 'cypress', 'playwright', 'puppeteer', 'cucumber', 'rspec', 'karma'],
  security:  ['oauth', 'jwt', 'saml', 'ssl', 'tls', 'encryption', 'authentication', 'authorization', 'penetration testing', 'security audit', 'owasp', 'cors', 'csrf', 'xss'],
};

const ALL_SKILLS = Object.values(SKILL_GROUPS).flat();

// Common non-skill words to filter out
const NON_SKILLS = new Set([
  'the', 'and', 'for', 'with', 'this', 'that', 'from', 'have', 'will', 'must', 'should', 'can', 'may',
  'are', 'you', 'our', 'your', 'we', 'be', 'is', 'in', 'to', 'of', 'at', 'as', 'an', 'or', 'not', 'but',
  'if', 'on', 'it', 'do', 'no', 'so', 'up', 'by', 'us', 'my', 'he', 'she', 'they', 'who', 'how', 'why',
  'what', 'when', 'where', 'has', 'had', 'been', 'being', 'does', 'did', 'done', 'would', 'could',
  'work', 'team', 'company', 'project', 'experience', 'years', 'role', 'position', 'job', 'candidate',
  'resume', 'cv', 'skills', 'education', 'degree', 'university', 'college', 'school', 'responsibilities',
  'requirements', 'qualifications', 'preferred', 'required', 'nice', 'bonus', 'plus', 'must', 'ability',
  'strong', 'excellent', 'good', 'great', 'solid', 'proven', 'demonstrated', 'understanding', 'knowledge',
  'senior', 'junior', 'lead', 'manager', 'engineer', 'developer', 'designer', 'analyst', 'architect',
  'develop', 'build', 'create', 'design', 'implement', 'maintain', 'support', 'manage', 'lead', 'work',
]);

// ─── Education scoring ────────────────────────────────────────────────────────

const EDUCATION_LEVELS = [
  { keywords: ['phd', 'ph.d', 'doctorate', 'doctoral'],                                    score: 100, label: 'PhD / Doctorate' },
  { keywords: ['master', 'mba', 'msc', 'm.sc', 'ms ', 'm.s.', 'meng', 'm.eng'],           score: 85,  label: "Master's" },
  { keywords: ['bachelor', 'bsc', 'b.sc', 'bs ', 'b.s.', 'beng', 'b.eng', 'b.e.', 'be '], score: 70,  label: "Bachelor's" },
  { keywords: ['associate', 'a.s.', 'a.a.'],                                               score: 50,  label: 'Associate' },
  { keywords: ['diploma', 'higher national'],                                               score: 35,  label: 'Diploma' },
  { keywords: ['certification', 'certified', 'certificate'],                               score: 25,  label: 'Certification' },
];

// ─── Experience extraction ────────────────────────────────────────────────────

const EXP_PATTERNS = [
  /(\d+)\+?\s*(?:to\s*\d+\s*)?years?\s+(?:of\s+)?(?:professional\s+)?(?:work\s+)?experience/gi,
  /experience\s*(?:of\s*)?(\d+)\+?\s*years?/gi,
  /(\d+)\+?\s*years?\s+(?:in|of|with)\s+\w/gi,
  /minimum\s+(?:of\s+)?(\d+)\s+years?/gi,
];

// ─── Helper functions ─────────────────────────────────────────────────────────

function extractYearsOfExperience(text) {
  let maxYears = 0;
  for (const pattern of EXP_PATTERNS) {
    const matches = [...text.matchAll(pattern)];
    for (const m of matches) {
      const y = parseInt(m[1], 10);
      if (y > maxYears && y < 50) maxYears = y;
    }
  }
  return maxYears;
}

function extractSkillsFromText(text) {
  const lower = text.toLowerCase();
  const found = new Set();

  for (const skill of ALL_SKILLS) {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?<![a-z])${escaped}(?![a-z])`, 'i');
    if (regex.test(lower)) found.add(skill);
  }

  const capWords = text.match(/\b[A-Z][a-zA-Z0-9.+#]{2,}\b/g) || [];
  for (const w of capWords) {
    const lw = w.toLowerCase();
    if (!NON_SKILLS.has(lw) && !found.has(lw)) {
      const hasSpecialChars = /[0-9.+#]/.test(w);
      const isAcronym = w === w.toUpperCase() && w.length >= 2 && w.length <= 6;
      const isTechnicalPattern = /^[A-Z][a-z]+[A-Z]/.test(w);
      
      if (hasSpecialChars || isAcronym || isTechnicalPattern) {
        found.add(lw);
      }
    }
  }

  return [...found];
}

function fuzzyMatchSkills(resumeText, requiredSkills) {
  const resumeLower = resumeText.toLowerCase();
  const matched = [];
  const missing = [];

  for (const skill of requiredSkills) {
    if (resumeLower.includes(skill)) {
      matched.push(skill);
      continue;
    }

    const resumeTokens = tokenizer.tokenize(resumeLower) || [];
    const skillTokens = tokenizer.tokenize(skill) || [];
    const skillStem = skillTokens.map((t) => PorterStemmer.stem(t)).join(' ');

    let bestScore = 0;
    for (const token of resumeTokens) {
      const tokenStem = PorterStemmer.stem(token);
      const score = JaroWinklerDistance(skillStem, tokenStem);
      if (score > bestScore) bestScore = score;
    }

    if (bestScore > 0.92) {
      matched.push(skill);
    } else {
      missing.push(skill);
    }
  }

  return { matched, missing };
}

function scoreEducation(resumeText) {
  const lower = resumeText.toLowerCase();
  for (const level of EDUCATION_LEVELS) {
    if (level.keywords.some((kw) => lower.includes(kw))) {
      return { score: level.score, label: level.label };
    }
  }
  return { score: 0, label: 'Not detected' };
}

function scoreExperience(resumeText, requiredYears) {
  const resumeYears = extractYearsOfExperience(resumeText);
  const required = requiredYears || 3;

  let score = 0;
  if (resumeYears >= required) {
    score = Math.min(100, 100 + Math.round(((resumeYears - required) / required) * 20));
  } else if (resumeYears > 0) {
    score = Math.round((resumeYears / required) * 100);
  }

  return { score: Math.min(100, score), detectedYears: resumeYears, requiredYears: required };
}

function computeTfIdfSimilarity(requirementsText, resumeText) {
  const tfidf = new TfIdf();
  tfidf.addDocument(requirementsText);
  tfidf.addDocument(resumeText);

  const reqTerms = [];
  tfidf.listTerms(0).slice(0, 50).forEach((item) => {
    reqTerms.push({ term: item.term, tfidf: item.tfidf });
  });

  if (reqTerms.length === 0) return 0;

  const resumeLower = resumeText.toLowerCase();
  let weightedMatch = 0;
  let totalWeight = 0;

  for (const { term, tfidf: weight } of reqTerms) {
    totalWeight += weight;
    if (resumeLower.includes(term)) {
      weightedMatch += weight;
    }
  }

  return totalWeight > 0 ? Math.min(100, Math.round((weightedMatch / totalWeight) * 100)) : 0;
}

function extractCandidateName(text) {
  if (!text) return null;
  
  // Get first 20 lines for better coverage
  const lines = text.split('\n').slice(0, 20).map(l => l.trim()).filter(Boolean);
  
  // Common US states, cities, and locations to exclude
  const LOCATIONS = new Set([
    // US States
    'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado', 'connecticut', 'delaware',
    'florida', 'georgia', 'hawaii', 'idaho', 'illinois', 'indiana', 'iowa', 'kansas', 'kentucky',
    'louisiana', 'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota', 'mississippi',
    'missouri', 'montana', 'nebraska', 'nevada', 'new hampshire', 'new jersey', 'new mexico',
    'new york', 'north carolina', 'north dakota', 'ohio', 'oklahoma', 'oregon', 'pennsylvania',
    'rhode island', 'south carolina', 'south dakota', 'tennessee', 'texas', 'utah', 'vermont',
    'virginia', 'washington', 'west virginia', 'wisconsin', 'wyoming',
    // Major cities
    'los angeles', 'san francisco', 'san diego', 'san jose', 'san antonio', 'new york',
    'las vegas', 'salt lake', 'santa clara', 'santa barbara', 'fort worth', 'el paso',
    'new orleans', 'saint louis', 'st louis', 'saint paul', 'st paul',
    // Common location words
    'united states', 'usa', 'remote', 'hybrid', 'onsite'
  ]);
  
  // Multiple name patterns to try
  const patterns = [
    // Pattern 1: Full name at start of line (2-4 words, each capitalized)
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})$/,
    
    // Pattern 2: Name with middle initial (e.g., "John A. Smith")
    /^([A-Z][a-z]+\s+[A-Z]\.?\s+[A-Z][a-z]+)$/,
    
    // Pattern 3: Name anywhere in line (more flexible)
    /\b([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/,
  ];
  
  // Keywords to skip (expanded list)
  const skipKeywords = /resume|curriculum|vitae|cv|contact|email|phone|address|objective|summary|experience|education|skills|profile|about|professional|work|employment|projects|certifications?|languages?|references|portfolio|linkedin|github|website|location|city|state|country|university|college|degree|bachelor|master|phd|senior|junior|developer|engineer|manager|designer|analyst|consultant/i;
  
  // First pass: Try first 5 lines only (names are usually at the top)
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i];
    
    // Skip very long lines (likely paragraphs)
    if (line.length > 60) continue;
    
    // Skip lines with common resume keywords
    if (skipKeywords.test(line)) continue;
    
    // Skip lines with numbers, emails, phones, URLs
    if (/\d{3,}|@|http|www\.|\.com|\.net|\.org|\(\d{3}\)/i.test(line)) continue;
    
    // Try each pattern
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        const name = match[1].trim();
        const nameLower = name.toLowerCase();
        
        // Skip if it's a known location
        if (LOCATIONS.has(nameLower)) continue;
        
        // Validate: name should be 2-4 words, each 2+ chars
        const words = name.split(/\s+/);
        if (words.length >= 2 && words.length <= 4) {
          const allWordsValid = words.every(w => w.length >= 2 && /^[A-Z][a-z]+\.?$/.test(w));
          if (allWordsValid) {
            return name;
          }
        }
      }
    }
  }
  
  // Second pass: Try remaining lines if nothing found in first 5
  for (let i = 5; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.length > 60) continue;
    if (skipKeywords.test(line)) continue;
    if (/\d{3,}|@|http|www\.|\.com|\.net|\.org|\(\d{3}\)/i.test(line)) continue;
    
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        const name = match[1].trim();
        const nameLower = name.toLowerCase();
        
        if (LOCATIONS.has(nameLower)) continue;
        
        const words = name.split(/\s+/);
        if (words.length >= 2 && words.length <= 4) {
          const allWordsValid = words.every(w => w.length >= 2 && /^[A-Z][a-z]+\.?$/.test(w));
          if (allWordsValid) {
            return name;
          }
        }
      }
    }
  }
  
  return null;
}

/**
 * Extract candidate title/role from resume
 */
function extractCandidateTitle(text) {
  if (!text) return null;
  
  const lines = text.split('\n').slice(0, 25).map(l => l.trim()).filter(Boolean);
  
  // Common title patterns
  const titlePatterns = [
    // Pattern 1: "Senior MERN Stack Developer" (role with level)
    /^((?:Senior|Junior|Lead|Principal|Staff|Mid-level|Entry-level)\s+.{5,50}(?:Developer|Engineer|Designer|Manager|Analyst|Architect|Consultant|Specialist))$/i,
    
    // Pattern 2: "Full Stack Developer" (role without level)
    /^(.{5,50}(?:Developer|Engineer|Designer|Manager|Analyst|Architect|Consultant|Specialist|Programmer|Administrator))$/i,
    
    // Pattern 3: After name, look for role
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,5}(?:Developer|Engineer|Designer|Manager|Analyst|Architect))$/,
  ];
  
  // Skip these keywords
  const skipKeywords = /resume|curriculum|vitae|contact|email|phone|address|objective|summary|experience|education|skills|profile|about|professional summary|work history|employment|projects|certifications?|languages?|references|portfolio|linkedin|github|website|location|university|college|degree|bachelor|master|phd/i;
  
  for (const line of lines) {
    if (line.length > 80 || line.length < 10) continue;
    if (skipKeywords.test(line)) continue;
    if (/\d{3,}|@|http|www\.|\.com|\(\d{3}\)/i.test(line)) continue;
    
    for (const pattern of titlePatterns) {
      const match = line.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
  }
  
  return null;
}

function generateSummary(result) {
  const { finalScore, breakdown, name } = result;
  const lines = [];

  if (finalScore >= 85) {
    lines.push(`${name} is an excellent match with a ${finalScore}% score.`);
  } else if (finalScore >= 70) {
    lines.push(`${name} is a good match with a ${finalScore}% score.`);
  } else if (finalScore >= 55) {
    lines.push(`${name} is a fair match with a ${finalScore}% score.`);
  } else {
    lines.push(`${name} is a weak match with a ${finalScore}% score.`);
  }

  if (breakdown.skills.matched.length > 0) {
    const top = breakdown.skills.matched.slice(0, 5).join(', ');
    lines.push(`Key matching skills: ${top}.`);
  }

  if (breakdown.skills.missing.length > 0) {
    const missing = breakdown.skills.missing.slice(0, 3).join(', ');
    lines.push(`Missing skills: ${missing}.`);
  }

  if (breakdown.experience.detectedYears > 0) {
    lines.push(`Detected ${breakdown.experience.detectedYears} years of experience (${breakdown.experience.requiredYears} required).`);
  }

  lines.push(`Education: ${breakdown.education.label}.`);

  return lines.join(' ');
}

/**
 * Rule-based matching (NLP logic)
 */
async function matchResumesNLP(requirementsText, resumes, preferences) {
  const {
    skillsWeight      = 40,
    experienceWeight  = 25,
    educationWeight   = 20,
    overallWeight     = 15,
    minExperienceYears = 0,
  } = preferences;

  // Check if AI is enabled - REQUIRED, no fallback
  if (!isAIExtractionEnabled()) {
    throw new Error('OpenAI API key is required for candidate analysis. Please configure OPENAI_API_KEY in your .env file.');
  }

  const totalWeight = skillsWeight + experienceWeight + educationWeight + overallWeight;
  const requiredSkills = extractSkillsFromText(requirementsText);
  const reqYears = extractYearsOfExperience(requirementsText) || minExperienceYears || 3;

  // First, calculate all breakdowns (needed for AI analysis)
  const preliminaryResults = resumes.map((resume) => {
    const { matched, missing } = fuzzyMatchSkills(resume.text, requiredSkills);
    const skillScore = requiredSkills.length > 0
      ? Math.round((matched.length / requiredSkills.length) * 100)
      : 50;

    const expResult = scoreExperience(resume.text, reqYears);
    const eduResult = scoreEducation(resume.text);
    const tfidfScore = computeTfIdfSimilarity(requirementsText, resume.text);

    return {
      breakdown: {
        skills: {
          score: Math.min(100, skillScore),
          matched,
          missing,
          total: requiredSkills.length,
        },
        experience: {
          score: expResult.score,
          detectedYears: expResult.detectedYears,
          requiredYears: expResult.requiredYears,
        },
        education: {
          score: eduResult.score,
          level: eduResult.label,
        },
        tfidf: {
          score: tfidfScore,
        },
      },
      skillScore,
      expResult,
      eduResult,
      tfidfScore,
    };
  });

  // AI extraction with analysis - REQUIRED
  console.log('🤖 Using AI to extract candidate information and analyze strengths/weaknesses...');
  const breakdowns = preliminaryResults.map(r => r.breakdown);
  const aiExtractedInfo = await extractCandidateInfoBatch(resumes, requirementsText, breakdowns);
  console.log(`✓ AI analyzed ${aiExtractedInfo.length} candidates`);

  // Build final results
  const results = resumes.map((resume, index) => {
    const prelim = preliminaryResults[index];
    const aiInfo = aiExtractedInfo[index];
    
    // Use AI-extracted info (no fallback)
    const candidateName = aiInfo?.name || resume.name;
    const candidateTitle = aiInfo?.title || '';
    const candidateLocation = aiInfo?.location || '';
    const candidateEmail = aiInfo?.email || '';
    const candidatePhone = aiInfo?.phone || '';
    const strengths = aiInfo?.strengths || [];
    const weaknesses = aiInfo?.weaknesses || [];
    const summary = aiInfo?.summary || '';

    const weightedScore = (
      prelim.skillScore      * skillsWeight +
      prelim.expResult.score * experienceWeight +
      prelim.eduResult.score * educationWeight +
      prelim.tfidfScore      * overallWeight
    ) / totalWeight;

    const finalScore = Math.round(Math.min(100, weightedScore));
    const grade = getGrade(finalScore);
    
    const result = { 
      name: candidateName,
      title: candidateTitle,
      location: candidateLocation,
      email: candidateEmail,
      phone: candidatePhone,
      fileName: resume.fileName, 
      finalScore,
      breakdown: prelim.breakdown,
      grade,
      strengths,
      weaknesses,
      summary,
    };

    return result;
  });

  return results.sort((a, b) => b.finalScore - a.finalScore);
}

/**
 * Enhanced hybrid matching with semantic understanding
 * 
 * @param {string} requirementsText - Job description
 * @param {Array} resumes - Array of resume objects
 * @param {Object} preferences - Scoring weights
 * @param {Float32Array} jobEmbedding - Pre-computed job embedding (optional)
 * @returns {Promise<Array>} Ranked results
 */
export async function matchResumesHybrid(requirementsText, resumes, preferences, jobEmbedding = null) {
  // 1. Get base NLP scores (deterministic) - now async with AI extraction
  const nlpResults = await matchResumesNLP(requirementsText, resumes, preferences);

  // 2. If no embeddings available, return NLP results
  if (!jobEmbedding) {
    return nlpResults.map(r => ({ ...r, scoredBy: 'nlp' }));
  }

  // 3. Generate resume embeddings (deterministic, can be cached)
  let resumeEmbeddings;
  try {
    const texts = resumes.map(buildResumeEmbeddingText);
    resumeEmbeddings = await embedBatch(texts);
  } catch (err) {
    console.error('Embedding failed, using NLP only:', err.message);
    return nlpResults.map(r => ({ ...r, scoredBy: 'nlp' }));
  }

  // 4. Blend NLP scores with semantic similarity
  const SEMANTIC_WEIGHT = 0.25; // 25% semantic, 75% rule-based
  
  const hybridResults = nlpResults.map((result, i) => {
    const resumeIdx = resumes.findIndex(r => r.fileName === result.fileName);
    const resumeEmbedding = resumeEmbeddings[resumeIdx];

    if (!resumeEmbedding) return { ...result, scoredBy: 'nlp' };

    // Calculate semantic similarity
    const similarity = cosineSimilarity(jobEmbedding, resumeEmbedding);
    const semanticScore = similarityToScore(similarity);

    // Blend scores: 75% rule-based + 25% semantic
    const blendedScore = Math.round(
      result.finalScore * (1 - SEMANTIC_WEIGHT) + 
      semanticScore * SEMANTIC_WEIGHT
    );

    return {
      ...result,
      finalScore: Math.min(100, blendedScore),
      breakdown: {
        ...result.breakdown,
        semantic: {
          score: semanticScore,
          similarity: Math.round(similarity * 1000) / 1000,
          weight: SEMANTIC_WEIGHT,
        },
      },
      grade: getGrade(Math.min(100, blendedScore)),
      scoredBy: 'hybrid',
    };
  });

  // Re-sort after blending
  return hybridResults.sort((a, b) => b.finalScore - a.finalScore);
}

/**
 * Advanced skill scoring with synonyms and variations
 * Only extracts real technical skills, not random keywords
 */
export function scoreSkillsAdvanced(resumeText, requiredSkills) {
  const SKILL_SYNONYMS = {
    'javascript': ['js', 'ecmascript', 'es6', 'es2015', 'es2020'],
    'typescript': ['ts'],
    'react': ['reactjs', 'react.js'],
    'node': ['nodejs', 'node.js'],
    'postgresql': ['postgres', 'psql'],
    'mongodb': ['mongo'],
    'kubernetes': ['k8s'],
    'docker': ['containerization', 'containers'],
    'ci/cd': ['continuous integration', 'continuous deployment', 'jenkins', 'github actions', 'gitlab ci'],
    'machine learning': ['ml', 'artificial intelligence', 'ai'],
    'natural language processing': ['nlp'],
  };

  const resumeLower = resumeText.toLowerCase();
  const matched = [];
  const missing = [];
  const skillScores = {};

  for (const skill of requiredSkills) {
    const skillLower = skill.toLowerCase();
    const synonyms = SKILL_SYNONYMS[skillLower] || [];
    const allVariants = [skillLower, ...synonyms];

    // Check for exact or synonym match
    let found = false;
    let matchStrength = 0;

    for (const variant of allVariants) {
      if (resumeLower.includes(variant)) {
        found = true;
        // Calculate match strength based on frequency
        const regex = new RegExp(variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        const matches = resumeLower.match(regex);
        matchStrength = Math.min(100, (matches?.length || 1) * 20);
        break;
      }
    }

    if (found) {
      matched.push(skill);
      skillScores[skill] = matchStrength;
    } else {
      missing.push(skill);
      skillScores[skill] = 0;
    }
  }

  const avgMatchStrength = matched.length > 0
    ? Math.round(matched.reduce((sum, s) => sum + skillScores[s], 0) / matched.length)
    : 0;

  const coverageScore = requiredSkills.length > 0
    ? Math.round((matched.length / requiredSkills.length) * 100)
    : 50;

  // Final skill score: 70% coverage + 30% depth
  const finalScore = Math.round(coverageScore * 0.7 + avgMatchStrength * 0.3);

  return {
    score: Math.min(100, finalScore),
    matched,
    missing,
    skillScores,
    coverage: coverageScore,
    depth: avgMatchStrength,
  };
}

/**
 * Detect certifications and add bonus points
 */
export function detectCertifications(resumeText) {
  const CERTIFICATIONS = [
    { name: 'AWS Certified', bonus: 10, keywords: ['aws certified', 'aws certification'] },
    { name: 'Azure Certified', bonus: 10, keywords: ['azure certified', 'microsoft certified'] },
    { name: 'GCP Certified', bonus: 10, keywords: ['gcp certified', 'google cloud certified'] },
    { name: 'PMP', bonus: 8, keywords: ['pmp', 'project management professional'] },
    { name: 'Scrum Master', bonus: 5, keywords: ['csm', 'certified scrum master', 'psm'] },
    { name: 'CISSP', bonus: 10, keywords: ['cissp', 'certified information systems security'] },
    { name: 'CKA', bonus: 8, keywords: ['cka', 'certified kubernetes administrator'] },
  ];

  const resumeLower = resumeText.toLowerCase();
  const found = [];
  let totalBonus = 0;

  for (const cert of CERTIFICATIONS) {
    if (cert.keywords.some(kw => resumeLower.includes(kw))) {
      found.push(cert.name);
      totalBonus += cert.bonus;
    }
  }

  return { certifications: found, bonusPoints: Math.min(15, totalBonus) };
}

function getGrade(score) {
  if (score >= 85) return { label: 'Excellent',     color: 'emerald' };
  if (score >= 70) return { label: 'Good',          color: 'blue' };
  if (score >= 55) return { label: 'Fair',          color: 'yellow' };
  if (score >= 40) return { label: 'Below Average', color: 'orange' };
  return              { label: 'Poor',          color: 'red' };
}
