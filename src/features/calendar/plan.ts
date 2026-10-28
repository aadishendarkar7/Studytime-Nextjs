import type { PlanPrefs, StudyBlock } from '@/lib/stores/extras';
import type { Reminder } from '@/lib/types';

export interface Interval { start: number; end: number }
export interface Proposal { title: string; subject: string; start: number; end: number; reminderId?: string; source: StudyBlock['source']; href?: string }

const MIN = 60_000;
const DAY = 86_400_000;
const BUFFER = 10 * MIN;

/** "21:30" to minutes after midnight. Empty or invalid gives null. */
export function clockMinutes(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  return h < 24 && mi < 60 ? h * 60 + mi : null;
}

export const startOfDay = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Local time on the day of `dayMs` at `minutes` after midnight (handles daylight saving). */
const at = (dayMs: number, minutes: number) => {
  const d = new Date(dayMs);
  d.setHours(0, minutes, 0, 0);
  return d.getTime();
};

const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

/** How many study blocks a deadline gets by default. */
export const BLOCKS_FOR: Record<Reminder['type'], number> = { exam: 4, assignment: 3, homework: 1 };

export interface Window { dayStart: number; dayEnd: number }

/** The study window for a day: preferences, cut off at the wind-down time if it is earlier. */
export function studyWindow(prefs: PlanPrefs, windDown: string): Window {
  const dayStart = clockMinutes(prefs.dayStart) ?? 9 * 60;
  let dayEnd = clockMinutes(prefs.dayEnd) ?? 22 * 60;
  const wd = clockMinutes(windDown);
  if (wd !== null && wd > dayStart) dayEnd = Math.min(dayEnd, wd);
  return { dayStart, dayEnd: Math.max(dayEnd, dayStart + 60) };
}

/** Earliest free slot of `minutes` on a day, or null. */
export function findSlot(dayMs: number, minutes: number, win: Window, busy: Interval[], notBefore: number, notAfter: number): Interval | null {
  let cursor = Math.max(at(dayMs, win.dayStart), notBefore);
  // Round up to the next quarter hour so blocks start at tidy times.
  cursor = Math.ceil(cursor / (15 * MIN)) * 15 * MIN;
  const limit = Math.min(at(dayMs, win.dayEnd), notAfter);
  const sorted = busy.filter((b) => b.end > cursor && b.start < limit).sort((a, b) => a.start - b.start);
  while (cursor + minutes * MIN <= limit) {
    const slot = { start: cursor, end: cursor + minutes * MIN };
    const hit = sorted.find((b) => overlaps({ start: slot.start - BUFFER, end: slot.end + BUFFER }, b));
    if (!hit) return slot;
    cursor = Math.ceil((hit.end + BUFFER) / (15 * MIN)) * 15 * MIN;
  }
  return null;
}

const minutesOnDay = (dayMs: number, items: Interval[]) =>
  items.filter((b) => startOfDay(b.start) === dayMs).reduce((n, b) => n + (b.end - b.start) / MIN, 0);

/**
 * Places `count` sessions before `dueAt`, spread over different days and
 * working back from the day before the deadline. Returns as many as fit.
 */
export function planSessions(input: {
  title: string;
  subject: string;
  dueAt: number;
  count: number;
  minutes: number;
  now: number;
  win: Window;
  busy: Interval[];
  planned: Interval[];
  maxPerDay: number;
  reminderId?: string;
  source?: StudyBlock['source'];
  href?: string;
}): Proposal[] {
  const out: Proposal[] = [];
  const earliest = input.now + 15 * MIN;
  const lastDay = startOfDay(input.dueAt - 60 * MIN);
  const firstDay = startOfDay(earliest);
  const days: number[] = [];
  for (let d = lastDay; d >= firstDay && days.length < 21; d = startOfDay(d - DAY / 2)) days.push(d);
  if (!days.length) return out;
  const taken = () => [...input.busy, ...input.planned, ...out];

  // First pass: one per day, latest days first. Second pass: allow a second block per day.
  for (const perDay of [1, 2]) {
    for (const day of days) {
      if (out.length >= input.count) break;
      const mine = out.filter((p) => startOfDay(p.start) === day).length;
      if (mine >= perDay) continue;
      if (minutesOnDay(day, [...input.planned, ...out]) + input.minutes > input.maxPerDay) continue;
      const slot = findSlot(day, input.minutes, input.win, taken(), earliest, input.dueAt - 60 * MIN);
      if (slot) out.push({ ...slot, title: input.title, subject: input.subject, reminderId: input.reminderId, source: input.source ?? 'suggested', href: input.href });
    }
  }
  out.sort((a, b) => a.start - b.start);
  const n = out.length;
  return out.map((p, i) => ({ ...p, title: n > 1 ? `${p.title} (${i + 1} of ${n})` : p.title }));
}

/** Suggested blocks for every open deadline in the next `horizonDays` that does not already have enough. */
export function suggestBlocks(input: {
  reminders: Reminder[];
  blocks: StudyBlock[];
  busy: Interval[];
  prefs: PlanPrefs;
  windDown: string;
  now: number;
  horizonDays?: number;
}): Proposal[] {
  const win = studyWindow(input.prefs, input.windDown);
  const horizon = input.now + (input.horizonDays ?? 14) * DAY;
  const planned: Interval[] = input.blocks.filter((b) => b.end > input.now);
  const proposals: Proposal[] = [];
  const due = input.reminders.filter((r) => !r.done && r.dueAt > input.now + 2 * 60 * MIN && r.dueAt <= horizon).sort((a, b) => a.dueAt - b.dueAt);
  for (const r of due) {
    const have = input.blocks.filter((b) => b.reminderId === r.id && !b.done).length;
    const count = BLOCKS_FOR[r.type] - have;
    if (count <= 0) continue;
    const label = r.type === 'exam' ? `Prep: ${r.title}` : `Work on: ${r.title}`;
    proposals.push(...planSessions({ title: label, subject: r.title, dueAt: r.dueAt, count, minutes: input.prefs.blockMinutes, now: input.now, win, busy: input.busy, planned: [...planned, ...proposals], maxPerDay: input.prefs.maxPerDay, reminderId: r.id }));
  }
  return proposals.sort((a, b) => a.start - b.start);
}

/** Flashcard review before an exam, on days 6, 4, 2 and 1 before it where possible. */
export function reviewPlan(input: { setName: string; setId: string; examAt: number; now: number; busy: Interval[]; planned: Interval[]; prefs: PlanPrefs; windDown: string }): Proposal[] {
  const win = studyWindow(input.prefs, input.windDown);
  const out: Proposal[] = [];
  for (const before of [6, 4, 2, 1]) {
    const day = startOfDay(input.examAt - before * DAY);
    if (day < startOfDay(input.now)) continue;
    const slot = findSlot(day, 25, win, [...input.busy, ...input.planned, ...out], input.now + 15 * MIN, input.examAt - 60 * MIN);
    if (slot) out.push({ ...slot, title: `Review: ${input.setName}`, subject: input.setName, source: 'review', href: `/study?tool=practice&set=${encodeURIComponent(input.setId)}` });
  }
  return out;
}

const EXAM_WORDS = /\b(exam|midterm|final|quiz|test)\b/i;

export interface WeekLoad { weekStart: number; score: number; exams: number; items: { title: string; at: number; exam: boolean }[] }

/** Load per week for the next `weeks` weeks. Exams count 3, assignments 2, homework 1. */
export function weekLoads(input: { reminders: Reminder[]; events: { title: string; start: number }[]; now: number; weeks?: number }): WeekLoad[] {
  const monday = (ms: number) => {
    const d = new Date(startOfDay(ms));
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.getTime();
  };
  const first = monday(input.now);
  const weeks: WeekLoad[] = [];
  for (let i = 0; i < (input.weeks ?? 12); i++) {
    const d = new Date(first);
    d.setDate(d.getDate() + i * 7);
    weeks.push({ weekStart: d.getTime(), score: 0, exams: 0, items: [] });
  }
  const add = (title: string, when: number, weight: number, exam: boolean) => {
    const w = weeks.find((x) => when >= x.weekStart && when < x.weekStart + 7 * DAY + 3_600_000);
    if (!w) return;
    w.score += weight;
    if (exam) w.exams++;
    w.items.push({ title, at: when, exam });
  };
  const seen = new Set<string>();
  for (const r of input.reminders) {
    if (r.done) continue;
    seen.add(`${r.title.toLowerCase()}|${startOfDay(r.dueAt)}`);
    add(r.title, r.dueAt, r.type === 'exam' ? 3 : r.type === 'assignment' ? 2 : 1, r.type === 'exam');
  }
  for (const e of input.events) {
    if (!EXAM_WORDS.test(e.title) || seen.has(`${e.title.toLowerCase()}|${startOfDay(e.start)}`)) continue;
    add(e.title, e.start, 3, true);
  }
  return weeks;
}

/** A week is a crunch week with two or more exams, or a load of 7 or more. */
export const isCrunch = (w: WeekLoad) => w.exams >= 2 || w.score >= 7;
