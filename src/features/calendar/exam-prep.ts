import { findSlot, startOfDay, type Interval, type Proposal, type Window } from './plan';

const MIN = 60_000;
const DAY = 86_400_000;

export type Confidence = 'new' | 'shaky' | 'solid';
export interface Topic { id: string; name: string; conf: Confidence; minutes: number }
export interface ExamPrep { topics: Topic[]; setId?: string }
export interface ExamInfo { key: string; title: string; at: number; reminderId?: string }

const EXAM_WORDS = /\b(exam|midterm|final|quiz|test)\b/i;

/** Exams from your deadlines and from connected calendars, without duplicates, soonest first. */
export function upcomingExams(input: { reminders: { id: string; title: string; type: string; dueAt: number; done: boolean }[]; events: { uid: string; title: string; start: number }[]; now: number }): ExamInfo[] {
  const out: ExamInfo[] = input.reminders.filter((r) => !r.done && r.type === 'exam' && r.dueAt > input.now).map((r) => ({ key: r.id, title: r.title, at: r.dueAt, reminderId: r.id }));
  const seen = new Set(out.map((e) => `${e.title.toLowerCase()}|${startOfDay(e.at)}`));
  for (const e of input.events) {
    if (e.start <= input.now || !EXAM_WORDS.test(e.title)) continue;
    const k = `${e.title.toLowerCase()}|${startOfDay(e.start)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ key: `cal:${e.uid}`, title: e.title, at: e.start });
  }
  return out.sort((a, b) => a.at - b.at);
}

/** The sessions each topic needs: new topics get learn and practice, shaky ones practice, solid ones only the final review. */
export function sessionsFor(topics: Topic[]) {
  const out: { title: string; topic: string; minutes: number }[] = [];
  for (const t of topics) {
    if (t.conf === 'new') out.push({ title: `Learn: ${t.name}`, topic: t.name, minutes: t.minutes });
    if (t.conf !== 'solid') out.push({ title: `Practice: ${t.name}`, topic: t.name, minutes: Math.max(25, Math.round((t.minutes * 0.6) / 5) * 5) });
  }
  return out;
}

/**
 * A plan that finishes before the exam: topic sessions spread evenly from today,
 * in order, then a practice exam two days before and a light review the day before.
 */
export function examPlan(input: { exam: ExamInfo; topics: Topic[]; now: number; win: Window; busy: Interval[]; planned: Interval[]; maxPerDay: number }): { proposals: Proposal[]; missing: number } {
  const out: Proposal[] = [];
  const taken = () => [...input.busy, ...input.planned, ...out];
  const load = (day: number) => [...input.planned, ...out].filter((b) => startOfDay(b.start) === day).reduce((n, b) => n + (b.end - b.start) / MIN, 0);
  const earliest = input.now + 15 * MIN;
  const examDay = startOfDay(input.exam.at);
  const firstDay = startOfDay(earliest);
  const days: number[] = [];
  for (let d = firstDay; d < examDay; d = startOfDay(d + DAY + DAY / 2)) days.push(d);
  if (!days.length) return { proposals: [], missing: sessionsFor(input.topics).length };
  const base = { subject: input.exam.title, reminderId: input.exam.key, source: 'exam' as const };
  const place = (day: number, minutes: number, title: string, notAfter = input.exam.at - 60 * MIN) => {
    if (load(day) + minutes > input.maxPerDay) return false;
    const slot = findSlot(day, minutes, input.win, taken(), earliest, notAfter);
    if (!slot) return false;
    out.push({ ...slot, ...base, title });
    return true;
  };

  // Reserve the last two days for the practice exam and the final review when there is room.
  const finalDay = days[days.length - 1];
  const practiceDay = days.length >= 3 ? days[days.length - 2] : null;
  const topicDays = days.length >= 4 ? days.slice(0, -2) : days.length >= 2 ? days.slice(0, -1) : days;
  const sessions = sessionsFor(input.topics);
  let missing = 0;
  sessions.forEach((s, i) => {
    const target = Math.min(topicDays.length - 1, Math.floor((i * topicDays.length) / Math.max(1, sessions.length)));
    const tries = [...topicDays.slice(target), ...topicDays.slice(0, target).reverse()];
    if (!tries.some((d) => place(d, s.minutes, s.title))) missing++;
  });
  if (practiceDay !== null && input.topics.length && !place(practiceDay, 60, `Practice exam: ${input.exam.title}`)) place(finalDay, 60, `Practice exam: ${input.exam.title}`);
  if (input.topics.length) place(finalDay, 30, `Light review: ${input.exam.title}`);
  out.sort((a, b) => a.start - b.start);
  return { proposals: out, missing };
}

/** 0 to 100: how ready you are, from topic confidence and the prep blocks you finished. */
export function readiness(topics: Topic[], blocks: { reminderId?: string; done: boolean; source: string }[], key: string) {
  if (!topics.length) return null;
  const conf = topics.reduce((n, t) => n + (t.conf === 'solid' ? 1 : t.conf === 'shaky' ? 0.5 : 0), 0) / topics.length;
  const mine = blocks.filter((b) => b.reminderId === key && b.source === 'exam');
  const done = mine.length ? mine.filter((b) => b.done).length / mine.length : conf;
  return Math.round((conf * 0.6 + done * 0.4) * 100);
}
