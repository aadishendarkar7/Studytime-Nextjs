'use client';
import type { AiPart } from './providers';

export interface Attachment {
  kind: 'image' | 'pdf' | 'text';
  name: string;
  mediaType?: string;
  data?: string; // base64
  text?: string;
  preview?: string; // data URL for images
}

const toBase64 = (buffer: ArrayBuffer) => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};

/** Downscale photos to keep uploads small (max 1600px, JPEG). */
function shrinkImage(file: File): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
      resolve({ kind: 'image', name: file.name || 'photo.jpg', mediaType: 'image/jpeg', data: dataUrl.split(',')[1], preview: dataUrl });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`${file.name || 'This image'} could not be opened. Use a JPG or PNG.`));
    };
    img.src = url;
  });
}

export async function extractDocxText(file: File) {
  const mod = await import('mammoth');
  const mammoth = mod.default ?? mod;
  return (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
}

export async function readAttachment(file: File): Promise<Attachment> {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (file.type.startsWith('image/')) return shrinkImage(file);
  if (ext === 'pdf' || file.type === 'application/pdf') {
    if (file.size > 15 * 1024 * 1024) throw new Error(`${file.name} is over 15 MB. Split it into smaller files.`);
    return { kind: 'pdf', name: file.name, mediaType: 'application/pdf', data: toBase64(await file.arrayBuffer()) };
  }
  if (ext === 'docx') return { kind: 'text', name: file.name, text: (await extractDocxText(file)).slice(0, 150_000) };
  if (['txt', 'md', 'csv', 'rtf'].includes(ext) || file.type.startsWith('text/')) return { kind: 'text', name: file.name, text: (await file.text()).slice(0, 150_000) };
  throw new Error(`${file.name}: use an image, PDF, Word (.docx), or text file.`);
}

export const toParts = (files: Attachment[]): AiPart[] =>
  files.map((f) =>
    f.kind === 'image'
      ? { type: 'image', mediaType: f.mediaType!, data: f.data! }
      : f.kind === 'pdf'
        ? { type: 'pdf', data: f.data!, name: f.name }
        : { type: 'text', text: `Contents of ${f.name}:\n\n${f.text}` },
  );
