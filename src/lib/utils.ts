import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { repairJsonBackslashes } from './math-text';

/** Join class names; later Tailwind utilities override earlier conflicting ones. */
export const cn = (...values: ClassValue[]) => twMerge(clsx(values));

export const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;

export const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const todayKey = () => dateKey(new Date());
export const dayBefore = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d - 1));
};
export const weekStart = (from = new Date()) => {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
};
export const localDateTimeValue = (ms: number) => {
  const d = new Date(ms);
  return `${dateKey(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const fmtClock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
export const fmtMinutes = (n: number) =>
  n >= 60 ? `${Math.floor(n / 60)}h${n % 60 ? ` ${n % 60}m` : ''}` : `${n} min`;
export const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
export const shortDate = (ms: number | string) =>
  new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export function shuffle<T>(values: readonly T[]): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Extract JSON from a model reply that may include fences or prose. */
export function parseJSONLoose<T = unknown>(text: string): T {
  const attempts: string[] = [text];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) attempts.push(fenced[1]);
  const starts = [text.indexOf('{'), text.indexOf('[')].filter((i) => i >= 0);
  if (starts.length) {
    const start = Math.min(...starts);
    const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
    if (end > start) attempts.push(text.slice(start, end + 1));
  }
  // LaTeX backslashes first (they can parse "fine" into control characters), then the raw text.
  for (const attempt of [...attempts.map(repairJsonBackslashes), ...attempts]) {
    try {
      return JSON.parse(attempt) as T;
    } catch {
      /* try next */
    }
  }
  throw new Error('The AI reply was not in the expected format. Try again.');
}
