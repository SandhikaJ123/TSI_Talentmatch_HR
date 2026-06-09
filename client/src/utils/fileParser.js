/**
 * Extracts plain text from uploaded files (PDF, DOCX, TXT).
 */

export async function extractTextFromFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();

  if (ext === 'txt') {
    return await readAsText(file);
  }

  if (ext === 'docx') {
    return await extractFromDocx(file);
  }

  if (ext === 'pdf') {
    return await extractFromPdf(file);
  }

  throw new Error(`Unsupported file type: .${ext}`);
}

function readAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Failed to read text file'));
    reader.readAsText(file);
  });
}

async function extractFromDocx(file) {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

async function extractFromPdf(file) {
  // Dynamically import pdfjs to avoid SSR issues
  const pdfjsLib = await import('pdfjs-dist');

  // Set worker source using CDN to avoid bundling issues
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(' ');
    fullText += pageText + '\n';
  }

  return fullText;
}
