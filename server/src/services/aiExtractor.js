/**
 * AI-powered candidate information extraction using OpenAI.
 * Extracts name, title, location, email, phone from resume text.
 * Also generates strengths and weaknesses analysis.
 * 
 * TODO: Convert this module to Python for better NLP library access (spaCy, NLTK, transformers)
 * TODO: Add document type validation function to detect resume vs job description
 */

import OpenAI from 'openai';

let _client = null;
function getClient() {
  if (!_client && process.env.OPENAI_API_KEY) {
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _client;
}

/**
 * Check if AI extraction is available
 */
export function isAIExtractionEnabled() {
  return !!process.env.OPENAI_API_KEY;
}

// TODO: Add document type validation function
// TODO: Implement validateDocumentType(text) to return 'resume' | 'job_description' | 'unknown'
// TODO: Check for resume indicators: contact info, work experience, education, skills sections
// TODO: Check for JD indicators: requirements, responsibilities, "we are looking for", company description

/**
 * Extract candidate information AND analyze strengths/weaknesses using AI
 * @param {string} resumeText - Full resume text
 * @param {string} jobRequirements - Job description/requirements
 * @param {Object} breakdown - Scoring breakdown from NLP matcher
 * @returns {Promise<Object>} { name, title, location, email, phone, strengths, weaknesses, summary }
 */
export async function extractCandidateInfoWithAnalysis(resumeText, jobRequirements, breakdown) {
  const client = getClient();
  
  if (!client) {
    throw new Error('OpenAI API key not configured');
  }

  // Take first 3000 characters of resume and 2000 of job requirements
  const resumeHeader = resumeText.slice(0, 3000);
  const jobHeader = jobRequirements.slice(0, 2000);

  const prompt = `You are an expert HR recruiter. Analyze this candidate's resume against the job requirements and provide a comprehensive assessment.

JOB REQUIREMENTS:
${jobHeader}

CANDIDATE'S RESUME:
${resumeHeader}

SCORING BREAKDOWN (for context):
- Skills Match: ${breakdown.skills.score}% (${breakdown.skills.matched.length}/${breakdown.skills.total} skills matched)
- Experience: ${breakdown.experience.score}% (${breakdown.experience.detectedYears} years detected, ${breakdown.experience.requiredYears} required)
- Education: ${breakdown.education.score}% (${breakdown.education.level})
- Matched Skills: ${breakdown.skills.matched.slice(0, 10).join(', ')}
- Missing Skills: ${breakdown.skills.missing.slice(0, 10).join(', ')}

Return ONLY valid JSON with these exact fields:

{
  "name": "Candidate's full name (e.g., 'John Smith')",
  "title": "Current/desired job title (e.g., 'Senior Full Stack Developer')",
  "location": "City, State (e.g., 'San Francisco, CA') or empty string",
  "email": "Email address or empty string",
  "phone": "Phone number or empty string",
  "strengths": [
    "3-5 specific strengths that make this candidate a good fit",
    "ONLY mention skills, experience, or qualifications that are EXPLICITLY stated in the resume",
    "ONLY mention strengths that are RELEVANT to the job requirements",
    "Be specific with evidence from resume: 'Has 5 years React experience as shown in work history' not 'Good at React'"
  ],
  "weaknesses": [
    "2-4 specific gaps or areas for improvement",
    "ONLY mention skills or requirements from the job posting that are NOT found in the resume",
    "Do NOT mention skills that are irrelevant to the job requirements",
    "Be specific: 'Job requires AWS but no cloud experience mentioned in resume' not 'Lacks cloud skills'"
  ],
  "summary": "2-3 sentence professional assessment of overall fit for this role"
}

CRITICAL RULES FOR NAME:
- Extract the person's FULL NAME from the resume (usually at the very top)
- DO NOT use location names (New York, San Francisco, etc.) as the name
- DO NOT use company names or job titles as the name
- The name should be 2-4 words like "John Smith" or "Mary Jane Watson"

CRITICAL RULES FOR STRENGTHS:
- ONLY list strengths that are EXPLICITLY mentioned or demonstrated in the resume
- ONLY list strengths that are RELEVANT to the job requirements
- Reference actual skills, technologies, years of experience, or achievements from the resume
- Use the matched skills list as your primary source
- Be specific with evidence: "5+ years Python development at Company X" not "Good programmer"
- DO NOT infer or assume skills not mentioned in the resume
- DO NOT mention generic soft skills unless explicitly demonstrated with examples

CRITICAL RULES FOR WEAKNESSES:
- ONLY list gaps where the job requirements mention a skill/qualification that is NOT in the resume
- Use the missing skills list as your primary source
- DO NOT mention skills that are not required by the job
- DO NOT compare to other candidates or industry standards
- Be specific: "Job requires Docker/Kubernetes but no container experience mentioned" not "Weak DevOps skills"
- If the resume covers most requirements, it's okay to have fewer weaknesses (even 1-2)
- DO NOT hallucinate missing skills - only mention what the job explicitly requires

CRITICAL RULES FOR SUMMARY:
- Write 2-3 sentences maximum
- Include overall match assessment based on the scoring breakdown
- Mention key strengths from the resume that match job requirements
- Mention main gaps where job requirements are not met by resume
- Be professional, balanced, and evidence-based`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini', // Faster and cheaper than gpt-4o
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2, // Lower temperature for more factual, less creative responses
      max_tokens: 500,
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(response.choices[0].message.content);
    
    // Validate and clean the result
    return {
      name: result.name?.trim() || '',
      title: result.title?.trim() || '',
      location: result.location?.trim() || '',
      email: result.email?.trim() || '',
      phone: result.phone?.trim() || '',
      strengths: Array.isArray(result.strengths) ? result.strengths : [],
      weaknesses: Array.isArray(result.weaknesses) ? result.weaknesses : [],
      summary: result.summary?.trim() || '',
    };
  } catch (error) {
    console.error('AI extraction failed:', error.message);
    // Return empty values on error
    return {
      name: '',
      title: '',
      location: '',
      email: '',
      phone: '',
      strengths: [],
      weaknesses: [],
      summary: '',
    };
  }
}

/**
 * Batch extract candidate info with analysis for multiple resumes
 * @param {Array<{text: string, name: string, fileName: string}>} resumes
 * @param {string} jobRequirements - Job description
 * @param {Array<Object>} breakdowns - Array of scoring breakdowns for each resume
 * @returns {Promise<Array>} Array of extracted info with analysis
 */
export async function extractCandidateInfoBatch(resumes, jobRequirements, breakdowns) {
  // Process in parallel with a limit to avoid rate limits
  const BATCH_SIZE = 3; // Reduced batch size since we're doing more work per request
  const results = [];

  for (let i = 0; i < resumes.length; i += BATCH_SIZE) {
    const batch = resumes.slice(i, i + BATCH_SIZE);
    const batchBreakdowns = breakdowns.slice(i, i + BATCH_SIZE);
    
    const batchResults = await Promise.all(
      batch.map(async (resume, idx) => {
        try {
          return await extractCandidateInfoWithAnalysis(
            resume.text, 
            jobRequirements, 
            batchBreakdowns[idx]
          );
        } catch (err) {
          console.error(`Extraction failed for ${resume.fileName}:`, err.message);
          return {
            name: resume.name, // Fallback to filename
            title: '',
            location: '',
            email: '',
            phone: '',
            strengths: [],
            weaknesses: [],
            summary: '',
          };
        }
      })
    );
    results.push(...batchResults);
  }

  return results;
}

export default {
  isAIExtractionEnabled,
  extractCandidateInfoWithAnalysis,
  extractCandidateInfoBatch,
};
