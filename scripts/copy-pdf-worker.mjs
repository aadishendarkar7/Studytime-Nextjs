// Copies the PDF.js worker into /public so the syllabus reader can load it.
import fs from 'node:fs';
import path from 'node:path';

const src = path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs');
const dest = path.join(process.cwd(), 'public', 'pdf.worker.min.mjs');
try {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
} catch (error) {
  console.warn('Could not copy the PDF.js worker:', error.message);
}
