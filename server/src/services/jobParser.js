/**
 * Job description parser.
 * Extracts structured fields from raw job description text using NLP + regex.
 * Optionally uses OpenAI for richer extraction.
 * 
 * TODO: Convert to Python for better NLP capabilities (spaCy, NLTK)
 * TODO: Add validation to ensure input is a job description (not a resume)
 * TODO: Improve skill extraction accuracy with ML models
 */

import natural from 'natural';
import nlp from 'compromise';
import OpenAI from 'openai';

const { TfIdf, WordTokenizer } = natural;
const tokenizer = new WordTokenizer();

// ─── Skill taxonomy (same as nlpMatcher) ─────────────────────────────────────

const SKILL_GROUPS = {
  languages: ['javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'ruby', 'go', 'golang', 'rust', 'swift', 'kotlin', 'scala', 'php', 'r', 'matlab', 'perl', 'bash', 'shell', 'powershell'],
  frontend:  ['react', 'angular', 'vue', 'svelte', 'next.js', 'nextjs', 'nuxt', 'html', 'css', 'sass', 'tailwind', 'bootstrap', 'webpack', 'vite', 'redux', 'graphql'],
  backend:   ['node', 'nodejs', 'express', 'fastapi', 'django', 'flask', 'spring', 'rails', 'laravel', 'nestjs', 'grpc', 'rest', 'microservices'],
  databases: ['sql', 'mysql', 'postgresql', 'postgres', 'mongodb', 'redis', 'elasticsearch', 'dynamodb', 'cassandra', 'oracle', 'sqlite', 'firebase'],
  cloud:     ['aws', 'azure', 'gcp', 'google cloud', 'docker', 'kubernetes', 'terraform', 'ansible', 'jenkins', 'ci/cd', 'devops', 'linux'],
  data:      ['machine learning', 'deep learning', 'nlp', 'tensorflow', 'pytorch', 'pandas', 'numpy', 'spark', 'hadoop', 'tableau', 'power bi'],
  practices: ['agile', 'scrum', 'kanban', 'tdd', 'git', 'jira', 'confluence', 'design patterns', 'microservices'],
  tools:     ['figma', 'sketch', 'salesforce', 'sap', 'excel', 'powerpoint'],
};
const ALL_SKILLS = Object.values(SKILL_GROUPS).flat();

const DEPARTMENTS = ['Engineering', 'Product', 'Design', 'Marketing', 'Sales', 'HR', 'Finance', 'Operations', 'Data', 'DevOps', 'QA', 'Security', 'Legal', 'Support'];
const JOB_TYPES   = ['Full-time', 'Part-time', 'Contract', 'Internship', 'Freelance', 'Remote'];

const EDUCATION_LEVELS = [
  { keywords: ['phd', 'ph.d', 'doctorate'],                                                label: "PhD / Doctorate",  score: 5 },
  { keywords: ['master', 'mba', 'msc', 'm.sc', 'ms ', 'm.s.'],                            label: "Master's",         score: 4 },
  { keywords: ['bachelor', 'bsc', 'b.sc', 'bs ', 'b.s.', 'b.e.', 'be ', 'undergraduate'], label: "Bachelor's",       score: 3 },
  { keywords: ['associate'],                                                                label: 'Associate',        score: 2 },
  { keywords: ['diploma'],                                                                  label: 'Diploma',          score: 1 },
  { keywords: ['certification', 'certified'],                                              label: 'Certification',    score: 1 },
];

const EXP_PATTERNS = [
  /(\d+)\+?\s*(?:to\s*\d+\s*)?years?\s+(?:of\s+)?(?:professional\s+)?(?:work\s+)?experience/gi,
  /experience\s*(?:of\s*)?(\d+)\+?\s*years?/gi,
  /(\d+)\+?\s*years?\s+(?:in|of|with)\s+\w/gi,
  /minimum\s+(?:of\s+)?(\d+)\s+years?/gi,
  /at\s+least\s+(\d+)\s+years?/gi,
];

// ─── NLP-based extraction ─────────────────────────────────────────────────────

function extractSkills(text) {
  const lower = text.toLowerCase();
  const found = new Set();
  
  // Extract known skills from taxonomy
  for (const skill of ALL_SKILLS) {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`(?<![a-z])${escaped}(?![a-z])`, 'i').test(lower)) {
      found.add(skill);
    }
  }
  
  // Expanded stop words list to filter out common non-skill words
  const stopWords = new Set([
    // Articles, conjunctions, prepositions
    'The', 'And', 'For', 'With', 'This', 'That', 'From', 'Have', 'Will', 'Must', 'Should', 'Can', 'May',
    'Are', 'You', 'Our', 'Your', 'We', 'Be', 'Is', 'In', 'To', 'Of', 'At', 'As', 'An', 'Or', 'Not', 'But',
    'If', 'On', 'It', 'Do', 'No', 'So', 'Up', 'By', 'Us', 'My', 'He', 'She', 'They', 'Who', 'How', 'Why',
    'What', 'When', 'Where', 'Has', 'Had', 'Been', 'Being', 'Does', 'Did', 'Done', 'Would', 'Could',
    
    // Common job description words
    'Work', 'Team', 'Company', 'Project', 'Experience', 'Years', 'Role', 'Position', 'Job', 'Candidate',
    'Resume', 'Skills', 'Education', 'Degree', 'University', 'College', 'School', 'Responsibilities',
    'Requirements', 'Qualifications', 'Preferred', 'Required', 'Nice', 'Bonus', 'Plus', 'Ability',
    'Strong', 'Excellent', 'Good', 'Great', 'Solid', 'Proven', 'Demonstrated', 'Understanding', 'Knowledge',
    'Familiarity', 'Proficiency', 'Expertise', 'Competency', 'Capability', 'Skilled', 'Experienced',
    
    // Job levels and types
    'Senior', 'Junior', 'Lead', 'Manager', 'Engineer', 'Developer', 'Designer', 'Analyst', 'Architect',
    'Full', 'Part', 'Time', 'Remote', 'Hybrid', 'Onsite', 'Contract', 'Permanent', 'Temporary', 'Intern',
    'Entry', 'Mid', 'Level', 'Staff', 'Principal', 'Associate', 'Assistant', 'Coordinator', 'Specialist',
    
    // Action verbs
    'Develop', 'Build', 'Create', 'Design', 'Implement', 'Maintain', 'Support', 'Manage', 'Lead',
    'Collaborate', 'Communicate', 'Ensure', 'Provide', 'Deliver', 'Contribute', 'Participate', 'Assist',
    'Troubleshoot', 'Debug', 'Test', 'Deploy', 'Monitor', 'Optimize', 'Improve', 'Enhance', 'Integrate',
    
    // Location and logistics
    'Location', 'Office', 'Based', 'City', 'State', 'Country', 'Local', 'International', 'Global',
    
    // Misc common words
    'Including', 'Such', 'Other', 'Various', 'Multiple', 'Several', 'Many', 'Some', 'All', 'Any', 'Each',
    'Every', 'Both', 'Either', 'Neither', 'More', 'Most', 'Less', 'Least', 'Only', 'Just', 'Also', 'Even',
    'Well', 'Very', 'Too', 'Much', 'Few', 'Little', 'Large', 'Small', 'New', 'Old', 'High', 'Low',
    'Stay', 'Effectively', 'Efficiently', 'Successfully', 'Quickly', 'Rapidly', 'Fast', 'Slow',
  ]);
  
  // Extract capitalized words (likely to be tools/frameworks)
  const caps = text.match(/\b[A-Z][a-zA-Z0-9.+#]{2,}\b/g) || [];
  for (const w of caps) {
    if (!stopWords.has(w)) {
      const lw = w.toLowerCase();
      // Only add if it looks like a technical term
      const hasSpecialChars = /[0-9.+#]/.test(w);
      const isAcronym = w === w.toUpperCase() && w.length >= 2 && w.length <= 6;
      const isTechnicalPattern = /^[A-Z][a-z]+[A-Z]/.test(w); // CamelCase
      
      if (hasSpecialChars || isAcronym || isTechnicalPattern) {
        found.add(lw);
      }
    }
  }
  
  return [...found];
}

function extractExperience(text) {
  let maxYears = 0;
  for (const pattern of EXP_PATTERNS) {
    for (const m of [...text.matchAll(pattern)]) {
      const y = parseInt(m[1], 10);
      if (y > maxYears && y < 50) maxYears = y;
    }
  }
  return maxYears;
}

function extractEducation(text) {
  const lower = text.toLowerCase();
  for (const level of EDUCATION_LEVELS) {
    if (level.keywords.some((kw) => lower.includes(kw))) return level.label;
  }
  return null;
}

function extractTitle(text) {
  // Try first non-empty line that looks like a title (short, no period)
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 5)) {
    if (line.length > 3 && line.length < 100 && !line.endsWith('.') && !line.startsWith('-')) {
      return line.replace(/^(job title|position|role)[:\s]*/i, '').trim();
    }
  }
  return '';
}

function extractDepartment(text) {
  const lower = text.toLowerCase();
  for (const dept of DEPARTMENTS) {
    if (lower.includes(dept.toLowerCase())) return dept;
  }
  return 'Engineering';
}

function extractJobType(text) {
  const lower = text.toLowerCase();
  for (const type of JOB_TYPES) {
    if (lower.includes(type.toLowerCase())) return type;
  }
  return 'Full-time';
}

function extractLocation(text) {
  const doc = nlp(text);
  const places = doc.places().out('array');
  // Filter out generic words
  const filtered = places.filter((p) => p.length > 2 && p.length < 50);
  return filtered[0] || '';
}

function extractNiceToHave(text) {
  const lower = text.toLowerCase();
  const niceSection = lower.match(/(?:nice[- ]to[- ]have|preferred|bonus|plus|advantageous)[:\s\n]+([\s\S]{0,500}?)(?:\n\n|\n[A-Z]|$)/i);
  if (!niceSection) return [];
  const sectionText = niceSection[1];
  return extractSkills(sectionText);
}

function extractResponsibilities(text) {
  // Extract bullet points that look like responsibilities
  const bullets = text.match(/^[\s]*[-•*]\s+(.+)$/gm) || [];
  return bullets
    .map((b) => b.replace(/^[\s]*[-•*]\s+/, '').trim())
    .filter((b) => b.length > 10 && b.length < 200)
    .slice(0, 10);
}

function extractSalary(text) {
  const salaryMatch = text.match(/\$[\d,]+(?:\s*[-–]\s*\$[\d,]+)?(?:\s*(?:per\s+)?(?:year|yr|annual|month|hour|hr))?/i)
    || text.match(/[\d,]+k?\s*[-–]\s*[\d,]+k?\s*(?:USD|GBP|EUR)?/i);
  return salaryMatch ? salaryMatch[0].trim() : '';
}

/**
 * Parse a job description using NLP (no API key needed).
 */
export function parseJobNLP(text) {
  const skills        = extractSkills(text);
  const niceToHave    = extractNiceToHave(text);
  const requiredSkills = skills.filter((s) => !niceToHave.includes(s));

  return {
    title:            extractTitle(text),
    department:       extractDepartment(text),
    location:         extractLocation(text),
    type:             extractJobType(text),
    minExperience:    extractExperience(text),
    educationLevel:   extractEducation(text),
    requiredSkills,
    niceToHaveSkills: niceToHave,
    responsibilities: extractResponsibilities(text),
    salary:           extractSalary(text),
    rawText:          text,
    parsedBy:         'nlp',
  };
}

/**
 * Parse a job description using OpenAI for richer structured extraction.
 */
export async function parseJobAI(text) {
  if (!process.env.OPENAI_API_KEY) return parseJobNLP(text);

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model  = 'gpt-4o'; // Use GPT-4o (5.2) for best parsing quality

  const prompt = `You are an expert HR analyst. Extract structured information from this job description.

JOB DESCRIPTION:
${text.slice(0, 4000)}

IMPORTANT INSTRUCTIONS FOR SKILLS EXTRACTION:
- "requiredSkills" and "niceToHaveSkills" should ONLY include actual technical skills, tools, frameworks, programming languages, and technologies
- DO NOT include: job duties (e.g., "troubleshoot", "develop"), soft skills (e.g., "communication"), qualifications (e.g., "preferred", "required"), adjectives (e.g., "good", "strong", "understanding"), location terms, or common words
- Examples of VALID skills: "JavaScript", "React", "Python", "AWS", "Docker", "SQL", "Kubernetes", "TypeScript", "Node.js", "MongoDB"
- Examples of INVALID skills: "troubleshoot", "understanding", "preferred", "required", "full", "location", "why", "effectively", "stay", "proficiency", "familiarity", "good"
- Only include concrete, specific technical competencies that can be learned and demonstrated

Respond with ONLY valid JSON:
{
  "title": "<job title>",
  "department": "<one of: Engineering, Product, Design, Marketing, Sales, HR, Finance, Operations, Data, DevOps, QA, Security, Legal, Support, Other>",
  "location": "<city/remote/hybrid or empty string>",
  "type": "<one of: Full-time, Part-time, Contract, Internship, Freelance, Remote>",
  "minExperience": <number of years, 0 if not specified>,
  "educationLevel": "<Bachelor's | Master's | PhD / Doctorate | Associate | Diploma | Certification | null>",
  "requiredSkills": ["skill1", "skill2"],
  "niceToHaveSkills": ["skill1", "skill2"],
  "responsibilities": ["responsibility1", "responsibility2"],
  "salary": "<salary range or empty string>",
  "summary": "<2-3 sentence summary of the role>"
}`;

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,  // Set to 0 for maximum consistency
      max_tokens: 1000,
      seed: 12345,     // Fixed seed for reproducible results
      response_format: { type: 'json_object' },
    });

    const parsed = JSON.parse(response.choices[0].message.content);
    return { ...parsed, rawText: text, parsedBy: 'ai' };
  } catch (err) {
    console.error('AI job parse failed, falling back to NLP:', err.message);
    return parseJobNLP(text);
  }
}
