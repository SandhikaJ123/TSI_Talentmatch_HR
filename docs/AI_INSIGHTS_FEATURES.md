# AI-Powered Candidate Insights

This document describes the new AI-powered features added to the Resume Matcher application.

## Features Overview

### 1. **Individual Candidate AI Insights**
Get comprehensive AI-powered analysis for any candidate with detailed explanations of their scores and fit.

**Location:** Candidates View → Click on any candidate → Click "Get AI Insights" button

**What You Get:**
- **Overall Assessment**: 2-3 sentence summary of the candidate's fit
- **Score Breakdown Explanations**: Detailed reasoning for each score category
  - Skills Score: Why this score? What's strong/weak?
  - Experience Score: Is it sufficient for the role?
  - Education Score: Does it meet requirements?
  - Overall Fit: Cultural and role alignment
- **Key Strengths**: Top 3 strengths of the candidate
- **Areas of Concern**: Weaknesses or gaps identified
- **Missing Critical Skills**: Skills required but not found in resume
- **Development Areas**: Areas where candidate needs improvement
- **Recommendation**: Should you proceed? Interview? Reject? Why?
- **Interview Focus Areas**: Specific topics to probe during interview
- **Hiring Risk Assessment**: Low/Medium/High risk with risk factors

### 2. **Score Explanations**
Click the brain icon (🧠) next to any score category to get a quick AI explanation of why that specific score was given.

**Available for:**
- Skills Score
- Experience Score
- Education Score
- Overall Relevance Score

### 3. **Candidate Comparison**
Compare 2-5 candidates side-by-side with AI-powered analysis to determine who is the best fit.

**How to Use:**
1. Go to Candidates View
2. Check the boxes next to candidates you want to compare (2-5 candidates)
3. Click "Compare" button
4. View comprehensive AI comparison

**What You Get:**
- **Summary**: Overall comparison of all candidates
- **Top Recommendation**: Best candidate with detailed reasoning
- **Detailed Ranking**: Each candidate ranked with explanation
- **Category Comparison**: Who's better in skills, experience, education, and overall fit
- **Unique Strengths**: What makes each candidate special
- **Final Recommendation**: Hiring recommendation with reasoning
- **Alternative Scenarios**: When would you choose a different candidate?

## API Endpoints

### 1. Explain Candidate
```
POST /api/ai-insights/explain-candidate
Body: { candidateId: "uuid" }
```

### 2. Compare Candidates
```
POST /api/ai-insights/compare-candidates
Body: { candidateIds: ["uuid1", "uuid2", ...] }
```

### 3. Explain Score
```
POST /api/ai-insights/explain-score
Body: { candidateId: "uuid", scoreType: "skills|experience|education|overall|final" }
```

## Requirements

- **OpenAI API Key**: Must be configured in `.env` file
- **Model**: Uses GPT-4o for best results
- **Temperature**: Set to 0.3 for consistent, professional responses

## Configuration

Add to your `.env` file:
```
OPENAI_API_KEY=your_api_key_here
```

## Benefits

1. **Better Decision Making**: Understand WHY a candidate scored the way they did
2. **Interview Preparation**: Know exactly what to ask in interviews
3. **Risk Assessment**: Identify potential hiring risks before making offers
4. **Fair Comparison**: Objective AI analysis helps reduce bias
5. **Time Savings**: Quick insights instead of manual resume review
6. **Professional Reports**: Share AI insights with hiring managers

## Privacy & Security

- All data sent to OpenAI is anonymized (emails, phones, addresses removed)
- Company names and confidential information are redacted
- Anonymization can be disabled by setting `ENABLE_ANONYMIZATION=false` in `.env`

## Usage Tips

1. **Use AI Insights for Top Candidates**: Focus AI analysis on your top 5-10 candidates to save API costs
2. **Compare Similar Candidates**: Use comparison when you have 2-3 candidates with similar scores
3. **Review Interview Focus Areas**: Use these to prepare targeted interview questions
4. **Check Risk Factors**: Pay attention to hiring risk assessment before making offers
5. **Share with Team**: Export or screenshot AI insights to share with hiring managers

## Troubleshooting

**"AI features not available"**
- Check that OPENAI_API_KEY is set in `.env`
- Restart the server after adding the API key
- Verify API key is valid by checking server logs

**"Failed to generate insights"**
- Check server logs for OpenAI API errors
- Verify you have API credits remaining
- Check network connectivity

**Slow Response Times**
- AI insights take 3-10 seconds to generate
- Comparison of multiple candidates may take longer
- Consider caching results for frequently viewed candidates
