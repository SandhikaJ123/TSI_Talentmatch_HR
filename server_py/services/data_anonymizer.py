"""
services/data_anonymizer.py — PII scrubbing before sending data to OpenAI.

Detects and masks sensitive information using regex patterns:
- Emails, phone numbers, SSNs, street addresses, salary figures, URLs
- Optional company name redaction
- Strips lines containing confidential/proprietary keywords

Two convenience wrappers:
- anonymize_resume()           — keeps salary expectations, skips confidential filter
- anonymize_job_description()  — masks salary ranges, removes confidential lines
"""

import re

PATTERNS = {
    "email":   re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"),
    "phone":   re.compile(r"(\+?\d{1,3}[.\-\s]?)?\(?\d{3}\)?[.\-\s]?\d{3}[.\-\s]?\d{4}\b"),
    "ssn":     re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
    "address": re.compile(r"\b\d{1,5}\s+(?:[A-Z][a-z]+\s+){1,3}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct)\b", re.I),
    "salary":  re.compile(r"\$\s*\d{1,3}(?:,\d{3})*(?:\s*-\s*\$?\s*\d{1,3}(?:,\d{3})*)?(?:\s*(?:per|/)\s*(?:year|yr|month|hour|hr))?", re.I),
    "url":     re.compile(r"https?://(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b[-a-zA-Z0-9()@:%_+.~#?&/=]*", re.I),
}

SENSITIVE_KEYWORDS = ["confidential","proprietary","internal only","do not share","nda required","trade secret"]


def anonymize_text(text: str, **opts) -> dict:
    if not text:
        return {"anonymizedText": "", "removedItems": [], "warnings": []}

    mask_emails  = opts.get("maskEmails", True)
    mask_phones  = opts.get("maskPhones", True)
    mask_urls    = opts.get("maskUrls", True)
    mask_ssn     = opts.get("maskSSN", True)
    mask_addr    = opts.get("maskAddresses", True)
    mask_salary  = opts.get("maskSalaries", True)
    company      = opts.get("companyName")
    remove_conf  = opts.get("removeConfidential", True)

    result = text
    removed = []
    warnings = []

    def _mask(pat_key, label, enabled):
        nonlocal result
        if not enabled:
            return
        for i, m in enumerate(PATTERNS[pat_key].finditer(text), 1):
            masked = f"[{label}_{i}]"
            result = result.replace(m.group(0), masked)
            removed.append({"type": pat_key, "original": m.group(0), "masked": masked})

    _mask("email",   "EMAIL",   mask_emails)
    _mask("phone",   "PHONE",   mask_phones)
    _mask("ssn",     "SSN",     mask_ssn)
    _mask("address", "ADDRESS", mask_addr)
    _mask("salary",  "SALARY",  mask_salary)

    if mask_urls:
        for i, m in enumerate(PATTERNS["url"].finditer(text), 1):
            try:
                from urllib.parse import urlparse
                domain = urlparse(m.group(0)).netloc
                masked = f"[URL_{i}: {domain}]"
            except Exception:
                masked = f"[URL_{i}]"
            result = result.replace(m.group(0), masked)
            removed.append({"type": "url", "original": m.group(0), "masked": masked})

    if company:
        pat = re.compile(rf"\b{re.escape(company)}\b", re.I)
        if pat.search(text):
            result = pat.sub("[COMPANY_NAME]", result)
            removed.append({"type": "company", "original": company, "masked": "[COMPANY_NAME]"})

    lower = text.lower()
    for kw in SENSITIVE_KEYWORDS:
        if kw in lower:
            warnings.append(f'Contains potentially confidential keyword: "{kw}"')

    if remove_conf:
        lines = result.split("\n")
        filtered = [l for l in lines if not any(kw in l.lower() for kw in SENSITIVE_KEYWORDS)]
        if len(filtered) < len(lines):
            warnings.append(f"Removed {len(lines) - len(filtered)} lines with sensitive keywords")
            result = "\n".join(filtered)

    return {
        "anonymizedText": result.strip(),
        "removedItems": removed,
        "warnings": warnings,
        "isAnonymized": bool(removed or warnings),
    }


def anonymize_resume(text: str, **opts) -> dict:
    return anonymize_text(text, maskEmails=True, maskPhones=True, maskUrls=True,
                          maskSalaries=False, maskAddresses=True, maskSSN=True,
                          removeConfidential=False, **opts)


def anonymize_job_description(text: str, company_name: str = None, **opts) -> dict:
    return anonymize_text(text, maskEmails=True, maskPhones=True, maskUrls=True,
                          maskSalaries=True, maskAddresses=True, maskSSN=False,
                          companyName=company_name, removeConfidential=True, **opts)
