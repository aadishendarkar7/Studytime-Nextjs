'use client';

/** Extract plain text from a PDF in the browser with PDF.js. */
export async function pdfToText(file: File) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    pages.push(content.items.map((x) => ('str' in x ? x.str + (x.hasEOL ? '\n' : ' ') : '')).join(''));
  }
  return pages.join('\n');
}
