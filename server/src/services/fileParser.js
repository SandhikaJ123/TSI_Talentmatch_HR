/**
 * Server-side file parsing service.
 * Extracts clean text from PDF, DOCX, and TXT files.
 * 
 * TODO: Convert to Python for better document parsing (PyPDF2, python-docx, pdfplumber)
 * TODO: Add document type detection after text extraction
 * TODO: Improve text extraction quality and formatting preservation
 */

import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import mammoth from 'mammoth';

/**
 * Extract text from a file buffer based on its mimetype/extension.
 * @param {Buffer} buffer
 * @param {string} originalName
 * @returns {Promise<string>}
 * 
 * TODO: Add validation to check if extracted text is a resume or job description
 * TODO: Return document type along with text: { text, documentType: 'resume' | 'job_description' | 'unknown' }
 */
export async function extractText(buffer, originalName) {
  const ext = originalName.split('.').pop().toLowerCase();

  switch (ext) {
    case 'pdf':
      return extractFromPdf(buffer);
    case 'docx':
    case 'doc':
      return extractFromDocx(buffer);
    case 'txt':
      return buffer.toString('utf-8');
    default:
      throw new Error(`Unsupported file type: .${ext}. Supported: PDF, DOCX, TXT`);
  }
}

async function extractFromPdf(buffer) {
  try {
    const data = await pdfParse(buffer);
    const text = data.text
      .replace(/\s{3,}/g, '\n')   // collapse excessive whitespace
      .replace(/\n{3,}/g, '\n\n') // collapse excessive newlines
      .trim();

    if (!text || text.length < 20) {
      throw new Error('PDF appears to be scanned/image-based. Please use a text-based PDF.');
    }
    return text;
  } catch (err) {
    if (err.message.includes('scanned')) throw err;
    throw new Error(`Failed to parse PDF: ${err.message}`);
  }
}

async function extractFromDocx(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value.trim();
    if (!text || text.length < 20) {
      throw new Error('DOCX file appears to be empty or unreadable.');
    }
    return text;
  } catch (err) {
    throw new Error(`Failed to parse DOCX: ${err.message}`);
  }
}
