const pdfParse = require('pdf-parse');

function isPdfBuffer(buffer, mimeType = '', filename = '') {
  const mime = String(mimeType || '').toLowerCase();
  const name = String(filename || '').toLowerCase();
  return mime.includes('pdf') || name.endsWith('.pdf') || buffer.slice(0, 5).toString() === '%PDF-';
}

async function extractPlanText(buffer, mimeType = '', filename = '') {
  if (isPdfBuffer(buffer, mimeType, filename)) {
    const data = await pdfParse(buffer);
    return String(data.text || '');
  }
  return buffer.toString('utf8');
}

module.exports = { extractPlanText };
