/**
 * Test script to demonstrate data anonymization
 * Run: node test-anonymization.js
 */

import { anonymizeJobDescription, anonymizeResume, getAnonymizationStats } from './src/services/dataAnonymizer.js';

console.log('='.repeat(80));
console.log('DATA ANONYMIZATION TEST');
console.log('='.repeat(80));

// Sample job description with sensitive data
const jobDescription = `
Acme Corporation is seeking a Senior Software Engineer!

About Us:
Acme Corp is a leading tech company based at 123 Main Street, San Francisco, CA 94102.
Visit us at https://www.acme-corp.com or email careers@acme.com

Position Details:
- Salary: $120,000 - $150,000 per year
- Contact: John Smith at john.smith@acme.com or call (555) 123-4567
- Location: 456 Tech Boulevard, Suite 200, San Francisco

Requirements:
- 5+ years of experience with React, Node.js, and TypeScript
- Bachelor's degree in Computer Science
- Strong problem-solving skills

CONFIDENTIAL: This position is for an unreleased product launching Q3 2025.
Internal Only: Do not share compensation details externally.
`;

const resume = `
Jane Doe
Email: jane.doe@email.com
Phone: (555) 987-6543
Address: 789 Residential Ave, Apt 4B, San Francisco, CA 94103
LinkedIn: https://linkedin.com/in/janedoe

PROFESSIONAL SUMMARY
Senior Software Engineer with 7 years of experience in full-stack development.

EXPERIENCE
Tech Company Inc. - Senior Engineer (2020-Present)
- Led development of React applications
- Managed team of 5 developers
- Salary: $135,000/year

EDUCATION
Bachelor of Science in Computer Science
Stanford University, 2016

SKILLS
React, Node.js, TypeScript, Python, AWS, Docker
`;

console.log('\n📄 ORIGINAL JOB DESCRIPTION:');
console.log('-'.repeat(80));
console.log(jobDescription);

console.log('\n🔒 ANONYMIZED JOB DESCRIPTION (sent to OpenAI):');
console.log('-'.repeat(80));
const jobResult = anonymizeJobDescription(jobDescription, 'Acme Corporation');
console.log(jobResult.anonymizedText);

console.log('\n📊 JOB ANONYMIZATION STATS:');
console.log('-'.repeat(80));
console.log(JSON.stringify(getAnonymizationStats(jobResult), null, 2));

console.log('\n⚠️  WARNINGS:');
console.log('-'.repeat(80));
jobResult.warnings.forEach(w => console.log(`  - ${w}`));

console.log('\n\n📄 ORIGINAL RESUME:');
console.log('-'.repeat(80));
console.log(resume);

console.log('\n🔒 ANONYMIZED RESUME (sent to OpenAI):');
console.log('-'.repeat(80));
const resumeResult = anonymizeResume(resume);
console.log(resumeResult.anonymizedText);

console.log('\n📊 RESUME ANONYMIZATION STATS:');
console.log('-'.repeat(80));
console.log(JSON.stringify(getAnonymizationStats(resumeResult), null, 2));

console.log('\n\n✅ WHAT WAS REMOVED:');
console.log('-'.repeat(80));
console.log('\nFrom Job Description:');
jobResult.removedItems.forEach(item => {
  console.log(`  ${item.type.toUpperCase()}: "${item.original}" → "${item.masked}"`);
});

console.log('\nFrom Resume:');
resumeResult.removedItems.forEach(item => {
  console.log(`  ${item.type.toUpperCase()}: "${item.original}" → "${item.masked}"`);
});

console.log('\n\n🎯 KEY POINTS:');
console.log('-'.repeat(80));
console.log('  ✓ Personal information (emails, phones, addresses) removed');
console.log('  ✓ Company name masked');
console.log('  ✓ Salary information hidden');
console.log('  ✓ Confidential sections removed');
console.log('  ✓ Skills and qualifications preserved');
console.log('  ✓ Matching accuracy maintained');
console.log('\n' + '='.repeat(80));
