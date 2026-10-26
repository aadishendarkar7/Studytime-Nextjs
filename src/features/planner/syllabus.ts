import type { ReminderType } from '@/lib/types';

export interface ImportCandidate {
  title: string;
  type: ReminderType;
  dueAt: number;
  selected: boolean;
}

const MONTHS = 'january february march april may june july august september october november december'.split(' ');
const DATE_PATTERN = /(\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?\b|\b\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?\b)/i;
const WORK = /(assignment|homework|hw\b|exam|quiz|test|project|paper|essay|lab|report|presentation|problem set|pset|midterm|final|reading|discussion|due)/i;

export function parseDue(raw: string, defaultYear = new Date().getFullYear()) {
  const match = raw.match(DATE_PATTERN);
  if (!match) return null;
  const token = match[0];
  let year = defaultYear;
  let month: number;
  let day: number;
  if (/[a-z]/i.test(token)) {
    const bits = token.replace(/[,.]/g, '').replace(/(\d)(st|nd|rd|th)/i, '$1').split(/\s+/);
    month = MONTHS.findIndex((m) => m.startsWith(bits[0].toLowerCase().slice(0, 3))) + 1;
    day = Number(bits[1]);
    if (bits[2]) year = Number(bits[2]);
  } else {
    const bits = token.split(/[/.-]/).map(Number);
    [month, day] = bits;
    if (bits[2]) year = bits[2] < 100 ? 2000 + bits[2] : bits[2];
  }
  const date = new Date(year, month - 1, day, 23, 59);
  if (!month || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return { date, token };
}

export const guessType = (title: string): ReminderType =>
  /paper|essay|project|report|presentation|lab\b/i.test(title) ? 'assignment'
  : /exam|quiz|test|midterm|final/i.test(title) ? 'exam'
  : /homework|hw\b|problem set|pset|reading/i.test(title) ? 'homework'
  : 'assignment';

/** Find lines in syllabus text that look like dated assignments or exams. */
export function scanSyllabus(text: string, defaultYear?: number): ImportCandidate[] {
  const lines = text.replace(/\r/g, '\n').split(/\n+/).map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const out: ImportCandidate[] = [];
  for (const line of lines) {
    if (line.length > 350) continue;
    const found = parseDue(line, defaultYear);
    if (!found) continue;
    let title = line
      .replace(found.token, '')
      .replace(/^[\s:|–—-]+|[\s:|–—-]+$/g, '')
      .replace(/\b(due date|due|deadline|on)\b\s*$/i, '')
      .trim();
    if (!title || !WORK.test(title)) continue;
    title = title.slice(0, 80);
    out.push({ title, type: guessType(title), dueAt: found.date.getTime(), selected: true });
  }
  return out.slice(0, 100);
}
