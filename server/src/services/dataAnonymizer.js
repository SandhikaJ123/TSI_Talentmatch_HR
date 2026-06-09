/**
 * Data Anonymization Service
 * Removes/masks sensitive information before sending to OpenAI
 */

// Common patterns to detect and anonymize
const PATTERNS = {
  // Email addresses
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
  
  // Phone numbers (various formats)
  phone: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  
  // URLs
  url: /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi,
  
  // Social Security Numbers (US)
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  
  // Addresses (basic pattern)
  address: /\b\d{1,5}\s+([A-Z][a-z]+\s+){1,3}(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Circle|Cir|Way)\b/gi,
  
  // Salary ranges
  salary: /\$\s*\d{1,3}(,\d{3})*(\s*-\s*\$?\s*\d{1,3}(,\d{3})*)?(\s*(per|\/)\s*(year|yr|annum|hour|hr|month|mo))?/gi,
  
  // Specific company names (will be populated dynamically)
  companyName: null,
};

// Sensitive keywords that might reveal company strategy
const SENSITIVE_KEYWORDS = [
  'confidential',
  'proprietary',
  'internal only',
  'do not share',
  'nda required',
  'trade secret',
  'patent pending',
  'unreleased',
  'stealth mode',
];

/**
 * Anonymize text by removing/masking sensitive information
 * @param {string} text - Original text
 * @param {Object} options - Anonymization options
 * @returns {Object} { anonymizedText, removedItems, warnings }
 */
export function anonymizeText(text, options = {}) {
  if (!text) return { anonymizedText: '', removedItems: [], warnings: [] };

  const {
    maskEmails = true,
    maskPhones = true,
    maskUrls = true,
    maskSalaries = true,
    maskAddresses = true,
    maskSSN = true,
    companyName = null,
    removeConfidential = true,
  } = options;

  let anonymized = text;
  const removedItems = [];
  const warnings = [];

  // 1. Mask emails
  if (maskEmails) {
    const emails = text.match(PATTERNS.email) || [];
    emails.forEach((email, i) => {
      const domain = email.split('@')[1];
      const masked = `[EMAIL_${i + 1}@${domain}]`;
      anonymized = anonymized.replace(email, masked);
      removedItems.push({ type: 'email', original: email, masked });
    });
  }

  // 2. Mask phone numbers
  if (maskPhones) {
    const phones = text.match(PATTERNS.phone) || [];
    phones.forEach((phone, i) => {
      const masked = `[PHONE_${i + 1}]`;
      anonymized = anonymized.replace(phone, masked);
      removedItems.push({ type: 'phone', original: phone, masked });
    });
  }

  // 3. Mask URLs (but keep domain for context)
  if (maskUrls) {
    const urls = text.match(PATTERNS.url) || [];
    urls.forEach((url, i) => {
      try {
        const domain = new URL(url).hostname;
        const masked = `[URL_${i + 1}: ${domain}]`;
        anonymized = anonymized.replace(url, masked);
        removedItems.push({ type: 'url', original: url, masked });
      } catch (e) {
        // Invalid URL, skip
      }
    });
  }

  // 4. Mask SSN
  if (maskSSN) {
    const ssns = text.match(PATTERNS.ssn) || [];
    ssns.forEach((ssn, i) => {
      const masked = `[SSN_${i + 1}]`;
      anonymized = anonymized.replace(ssn, masked);
      removedItems.push({ type: 'ssn', original: ssn, masked });
    });
  }

  // 5. Mask addresses
  if (maskAddresses) {
    const addresses = text.match(PATTERNS.address) || [];
    addresses.forEach((addr, i) => {
      const masked = `[ADDRESS_${i + 1}]`;
      anonymized = anonymized.replace(addr, masked);
      removedItems.push({ type: 'address', original: addr, masked });
    });
  }

  // 6. Mask salary information
  if (maskSalaries) {
    const salaries = text.match(PATTERNS.salary) || [];
    salaries.forEach((salary, i) => {
      const masked = `[SALARY_RANGE_${i + 1}]`;
      anonymized = anonymized.replace(salary, masked);
      removedItems.push({ type: 'salary', original: salary, masked });
    });
  }

  // 7. Mask specific company name
  if (companyName) {
    const companyRegex = new RegExp(`\\b${escapeRegex(companyName)}\\b`, 'gi');
    const matches = text.match(companyRegex) || [];
    if (matches.length > 0) {
      anonymized = anonymized.replace(companyRegex, '[COMPANY_NAME]');
      removedItems.push({ type: 'company', original: companyName, masked: '[COMPANY_NAME]' });
    }
  }

  // 8. Check for confidential keywords
  if (removeConfidential) {
    const lowerText = text.toLowerCase();
    SENSITIVE_KEYWORDS.forEach((keyword) => {
      if (lowerText.includes(keyword)) {
        warnings.push(`Contains potentially confidential keyword: "${keyword}"`);
      }
    });
  }

  // 9. Remove lines containing "confidential" or "internal"
  if (removeConfidential) {
    const lines = anonymized.split('\n');
    const filteredLines = lines.filter((line) => {
      const lower = line.toLowerCase();
      return !SENSITIVE_KEYWORDS.some((kw) => lower.includes(kw));
    });
    
    if (filteredLines.length < lines.length) {
      warnings.push(`Removed ${lines.length - filteredLines.length} lines containing sensitive keywords`);
      anonymized = filteredLines.join('\n');
    }
  }

  return {
    anonymizedText: anonymized.trim(),
    removedItems,
    warnings,
    isAnonymized: removedItems.length > 0 || warnings.length > 0,
  };
}

/**
 * Anonymize resume data before sending to OpenAI
 */
export function anonymizeResume(resumeText, options = {}) {
  return anonymizeText(resumeText, {
    maskEmails: true,
    maskPhones: true,
    maskUrls: true,
    maskSalaries: false, // Keep salary expectations in resumes
    maskAddresses: true,
    maskSSN: true,
    removeConfidential: false, // Resumes rarely have confidential info
    ...options,
  });
}

/**
 * Anonymize job description before sending to OpenAI
 */
export function anonymizeJobDescription(jobText, companyName, options = {}) {
  return anonymizeText(jobText, {
    maskEmails: true,
    maskPhones: true,
    maskUrls: true,
    maskSalaries: true, // Mask internal salary ranges
    maskAddresses: true,
    maskSSN: false,
    companyName,
    removeConfidential: true, // Remove confidential sections
    ...options,
  });
}

/**
 * Create a mapping to restore anonymized data (if needed)
 */
export function createRestoreMap(removedItems) {
  const map = {};
  removedItems.forEach((item) => {
    map[item.masked] = item.original;
  });
  return map;
}

/**
 * Restore anonymized text using the mapping
 */
export function restoreText(anonymizedText, restoreMap) {
  let restored = anonymizedText;
  Object.entries(restoreMap).forEach(([masked, original]) => {
    restored = restored.replace(new RegExp(escapeRegex(masked), 'g'), original);
  });
  return restored;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get anonymization statistics
 */
export function getAnonymizationStats(result) {
  const stats = {
    totalRemoved: result.removedItems.length,
    byType: {},
    warnings: result.warnings.length,
  };

  result.removedItems.forEach((item) => {
    stats.byType[item.type] = (stats.byType[item.type] || 0) + 1;
  });

  return stats;
}

export default {
  anonymizeText,
  anonymizeResume,
  anonymizeJobDescription,
  createRestoreMap,
  restoreText,
  getAnonymizationStats,
};
