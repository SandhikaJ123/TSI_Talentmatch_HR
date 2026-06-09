# TODO List

## High Priority

### 1. Document Validation - Resume vs Job Description
**Status:** Pending  
**Priority:** High  
**Description:**  
Add validation to distinguish between resumes and job descriptions when files are uploaded. Currently, the system accepts any document type and attempts to match it, which can lead to incorrect results.

**Requirements:**
- Validate uploaded files to confirm they are actual resumes (not job descriptions or other documents)
- Check for resume-specific indicators:
  - Contact information (email, phone)
  - Work experience section
  - Education section
  - Skills section
  - Professional summary/objective
- Reject files that appear to be job descriptions instead of resumes
- Provide clear error messages when validation fails
- Add similar validation for job description uploads

**Implementation Notes:**
- Use AI/NLP to analyze document structure and content
- Check for keywords like "Requirements", "Responsibilities", "We are looking for" (JD indicators)
- Check for keywords like "Experience", "Education", "Skills", "Contact" (Resume indicators)
- Consider document length and format patterns

**Files to Modify:**
- `server/src/routes/match.js` - Add validation before processing
- `server/src/services/aiExtractor.js` - Add document type detection function
- `client/src/views/MatcherView.jsx` - Show validation errors to user

---

### 2. Convert to Python for Better Tool Access
**Status:** Pending  
**Priority:** Medium  
**Description:**  
Convert the backend matching engine to Python to leverage better NLP libraries and tools for resume parsing and analysis.

**Benefits:**
- Access to powerful Python libraries:
  - spaCy for advanced NLP
  - scikit-learn for ML-based matching
  - PyPDF2, python-docx for better document parsing
  - NLTK for text processing
  - Transformers for advanced AI models
- Better integration with data science tools
- More robust text extraction and analysis
- Easier to add custom ML models

**Scope:**
- Convert matching logic from Node.js to Python
- Maintain REST API compatibility
- Keep the React frontend unchanged
- Improve text extraction quality
- Add more sophisticated matching algorithms

**Considerations:**
- Decide on Python framework (Flask, FastAPI, Django)
- Plan migration strategy (gradual vs complete rewrite)
- Ensure performance is maintained or improved
- Update deployment process
- Update documentation

**Files to Convert:**
- `server/src/services/hybridMatcher.js` → Python
- `server/src/services/nlpMatcher.js` → Python
- `server/src/services/textExtractor.js` → Python
- `server/src/services/aiExtractor.js` → Python
- `server/src/routes/match.js` → Python API endpoint

---

## Medium Priority

### 3. Improve Strengths and Weaknesses Analysis
**Status:** In Progress  
**Priority:** Medium  
**Description:**  
Ensure strengths and weaknesses are based only on what's explicitly in the resume and job requirements, without hallucination or irrelevant comparisons.

**Completed:**
- ✅ Updated AI prompt to prevent hallucination
- ✅ Added explicit rules to only use resume content
- ✅ Added explicit rules to only compare against job requirements
- ✅ Lowered temperature for more factual responses

**Remaining:**
- Test with various resume types
- Add validation to ensure output quality
- Consider adding confidence scores

---

## Low Priority

### 4. Enhanced Error Handling
**Status:** Pending  
**Priority:** Low  
**Description:**  
Improve error messages and handling throughout the application.

**Tasks:**
- Add more descriptive error messages for file parsing failures
- Implement retry logic for API calls
- Add logging for debugging
- Create user-friendly error pages

---

## Future Enhancements

### 5. Batch Processing
- Add ability to process multiple job descriptions at once
- Implement queue system for large batches
- Add progress tracking for batch operations

### 6. Advanced Matching Features
- Add semantic similarity using embeddings
- Implement ranking algorithms beyond simple scoring
- Add customizable matching criteria
- Support for different industries/job types

### 7. Reporting and Analytics
- Generate detailed match reports
- Add export to multiple formats (PDF, Excel)
- Create comparison views for multiple candidates
- Add historical tracking and trends

---

## Notes
- Keep this file updated as tasks are completed or priorities change
- Add estimated time and assignee when tasks are picked up
- Link to related issues or PRs when available
