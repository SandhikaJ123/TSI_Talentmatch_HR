/**
 * Resume matching engine.
 * Scores each resume against the job requirements using weighted criteria.
 */

// Common tech skills for keyword extraction
const TECH_SKILLS = [
  'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'ruby', 'go', 'rust', 'swift',
  'react', 'angular', 'vue', 'node', 'express', 'django', 'flask', 'spring', 'rails',
  'sql', 'mysql', 'postgresql', 'mongodb', 'redis', 'elasticsearch', 'dynamodb',
  'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'jenkins', 'ci/cd',
  'git', 'linux', 'rest', 'graphql', 'microservices', 'agile', 'scrum',
  'machine learning', 'deep learning', 'nlp', 'tensorflow', 'pytorch', 'pandas', 'numpy',
  'html', 'css', 'sass', 'webpack', 'vite', 'next.js', 'nuxt', 'tailwind',
  'figma', 'photoshop', 'ux', 'ui', 'product management', 'data analysis',
  'excel', 'tableau', 'power bi', 'r', 'scala', 'hadoop', 'spark',
  'php', 'laravel', 'wordpress', 'shopify', 'salesforce', 'sap',
];

const DEGREE_KEYWORDS = {
  phd: 5,
  doctorate: 5,
  'master': 4,
  'mba': 4,
  'ms ': 4,
  'msc': 4,
  'bachelor': 3,
  'bs ': 3,
  'bsc': 3,
  'b.s': 3,
  'b.e': 3,
  'associate': 2,
  'diploma': 1,
  'certification': 1,
  'certified': 1,
};

const EXPERIENCE_PATTERNS = [
  /(\d+)\+?\s*years?\s*(of\s*)?(experience|exp)/gi,
  /experience[:\s]+(\d+)\+?\s*years?/gi,
];

/**
 * Tokenize text into lowercase words/phrases.
 */
function tokenize(text) {
  return text.toLowerCase().replace(/[^\w\s.+#]/g, ' ').split(/\s+/).filter(Boolean);
}

/**
 * Extract keywords from requirements text.
 */
function extractRequirementKeywords(requirementsText) {
  const lower = requirementsText.toLowerCase();
  const found = new Set();

  // Extract tech skills mentioned
  for (const skill of TECH_SKILLS) {
    if (lower.includes(skill)) {
      found.add(skill);
    }
  }

  // Extract any capitalized words (likely proper nouns / tools)
  const words = requirementsText.match(/\b[A-Z][a-zA-Z0-9.+#]{2,}\b/g) || [];
  for (const w of words) {
    found.add(w.toLowerCase());
  }

  // Extract quoted phrases
  const quoted = requirementsText.match(/"([^"]+)"/g) || [];
  for (const q of quoted) {
    found.add(q.replace(/"/g, '').toLowerCase());
  }

  return [...found];
}

/**
 * Score keyword/skills match between resume and requirements.
 */
function scoreKeywords(resumeText, keywords) {
  if (!keywords.length) return 0;
  const lower = resumeText.toLowerCase();
  let matched = 0;
  const matchedList = [];

  for (const kw of keywords) {
    if (lower.includes(kw)) {
      matched++;
      matchedList.push(kw);
    }
  }

  return {
    score: Math.min(100, Math.round((matched / keywords.length) * 100)),
    matched: matchedList,
    total: keywords.length,
  };
}

/**
 * Score education level.
 */
function scoreEducation(resumeText) {
  const lower = resumeText.toLowerCase();
  let maxScore = 0;
  let level = 'Not detected';

  for (const [keyword, score] of Object.entries(DEGREE_KEYWORDS)) {
    if (lower.includes(keyword) && score > maxScore) {
      maxScore = score;
      level = keyword.trim();
    }
  }

  return {
    score: Math.round((maxScore / 5) * 100),
    level: level.charAt(0).toUpperCase() + level.slice(1),
  };
}

/**
 * Extract years of experience from text.
 */
function extractYearsOfExperience(text) {
  let maxYears = 0;
  for (const pattern of EXPERIENCE_PATTERNS) {
    const matches = [...text.matchAll(pattern)];
    for (const m of matches) {
      const years = parseInt(m[1], 10);
      if (years > maxYears && years < 50) maxYears = years;
    }
  }
  return maxYears;
}

/**
 * Score experience match.
 */
function scoreExperience(resumeText, requirementsText, preferredYears) {
  const resumeYears = extractYearsOfExperience(resumeText);
  const reqYears = preferredYears || extractYearsOfExperience(requirementsText) || 3;

  let score = 0;
  if (resumeYears >= reqYears) {
    score = 100;
  } else if (resumeYears > 0) {
    score = Math.round((resumeYears / reqYears) * 100);
  }

  return {
    score,
    resumeYears,
    requiredYears: reqYears,
  };
}

/**
 * Score overall text similarity using TF-IDF-like approach.
 */
function scoreTextSimilarity(resumeText, requirementsText) {
  const reqTokens = new Set(tokenize(requirementsText).filter((t) => t.length > 3));
  const resumeTokens = new Set(tokenize(resumeText).filter((t) => t.length > 3));

  let overlap = 0;
  for (const token of reqTokens) {
    if (resumeTokens.has(token)) overlap++;
  }

  const score = reqTokens.size > 0 ? Math.round((overlap / reqTokens.size) * 100) : 0;
  return Math.min(100, score);
}

/**
 * Main matching function.
 * @param {string} requirementsText - Job requirements text
 * @param {Array<{name: string, text: string}>} resumes - Array of resume objects
 * @param {Object} preferences - Weighting preferences
 * @returns {Array} Ranked results
 */
export function matchResumes(requirementsText, resumes, preferences) {
  const {
    skillsWeight = 40,
    experienceWeight = 25,
    educationWeight = 20,
    overallWeight = 15,
    minExperienceYears = 0,
  } = preferences;

  const totalWeight = skillsWeight + experienceWeight + educationWeight + overallWeight;
  const keywords = extractRequirementKeywords(requirementsText);

  const results = resumes.map((resume) => {
    const skillsResult = scoreKeywords(resume.text, keywords);
    const experienceResult = scoreExperience(resume.text, requirementsText, minExperienceYears);
    const educationResult = scoreEducation(resume.text);
    const similarityScore = scoreTextSimilarity(resume.text, requirementsText);

    const weightedScore =
      (skillsResult.score * skillsWeight +
        experienceResult.score * experienceWeight +
        educationResult.score * educationWeight +
        similarityScore * overallWeight) /
      totalWeight;

    const finalScore = Math.round(weightedScore);

    return {
      name: resume.name,
      fileName: resume.fileName,
      finalScore,
      breakdown: {
        skills: { score: skillsResult.score, matched: skillsResult.matched, total: skillsResult.total },
        experience: { score: experienceResult.score, years: experienceResult.resumeYears, required: experienceResult.requiredYears },
        education: { score: educationResult.score, level: educationResult.level },
        overall: { score: similarityScore },
      },
      grade: getGrade(finalScore),
    };
  });

  // Sort by score descending
  return results.sort((a, b) => b.finalScore - a.finalScore);
}

function getGrade(score) {
  if (score >= 85) return { label: 'Excellent', color: 'emerald' };
  if (score >= 70) return { label: 'Good', color: 'blue' };
  if (score >= 55) return { label: 'Fair', color: 'yellow' };
  if (score >= 40) return { label: 'Below Average', color: 'orange' };
  return { label: 'Poor', color: 'red' };
}
