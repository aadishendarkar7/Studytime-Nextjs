import type { CalEvent, StudyBlock } from '@/lib/stores/extras';
import { findSlot, startOfDay, type Interval, type Proposal, type Window } from './plan';

const MIN = 60_000;
const DAY = 86_400_000;
const EXAM_WORDS = /\b(exam|midterm|final|quiz|test)\b/i;
const NOT_CLASS = /\b(office hours?|shift|work|practice|meeting|dinner|lunch|gym|appointment|due|deadline)\b/i;

export interface ClassInfo { name: string; meetings: Interval[]; perWeek: number }

/** "MATH240 Lecture" and "MATH240 Discussion" both belong to MATH240 when a course code is there. */
export function courseName(title: string) {
  const code = /\b([A-Z]{2,5})\s?(\d{3}[A-Z]?)\b/.exec(title);
  return code ? `${code[1]}${code[2]}` : title.replace(/\s*\b(lecture|lec|discussion|dis|lab|recitation|section|seminar)\b.*$/i, '').trim() || title.trim();
}

/**
 * Classes are timed events that repeat: the same course at least twice in
 * the next two weeks, between 30 minutes and 4 hours long. Exams, shifts and
 * office hours are left out.
 */
export function detectClasses(events: CalEvent[], now: number): ClassInfo[] {
  const soon = events.filter((e) => !e.allDay && e.start > now - DAY && e.start < now + 14 * DAY && e.end - e.start >= 30 * MIN && e.end - e.start <= 4 * 60 * MIN && !EXAM_WORDS.test(e.title) && !NOT_CLASS.test(e.title));
  const by = new Map<string, Interval[]>();
  for (const e of soon) {
    const k = courseName(e.title);
    by.set(k, [...(by.get(k) ?? []), { start: e.start, end: e.end }]);
  }
  return [...by.entries()]
    .filter(([, m]) => m.length >= 2)
    .map(([name, m]) => {
      const sorted = m.sort((a, b) => a.start - b.start);
      return { name, meetings: sorted.filter((x) => x.start >= now - DAY && x.start < now + 7 * DAY), perWeek: Math.max(1, Math.round(sorted.length / 2)) };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * A week of study built around your classes:
 * - a short review the same day as each class, soon after it ends, while it is fresh
 * - two longer blocks per course on days you do not have that class
 */
export function routinePlan(input: { classes: ClassInfo[]; busy: Interval[]; planned: (Interval & { title?: string })[]; win: Window; maxPerDay: number; blockMinutes: number; now: number; reviewMinutes?: number; deepPerCourse?: number }): Proposal[] {
  const out: Proposal[] = [];
  const review = input.reviewMinutes ?? 25;
  const taken = () => [...input.busy, ...input.planned, ...out];
  const load = (day: number) => [...input.planned, ...out].filter((b) => startOfDay(b.start) === day).reduce((n, b) => n + (b.end - b.start) / MIN, 0);
  const earliest = input.now + 15 * MIN;
  const has = (day: number, title: string) => [...input.planned, ...out].some((b) => startOfDay(b.start) === day && b.title === title);

  for (const c of input.classes) {
    for (const m of c.meetings) {
      if (m.end < input.now) continue;
      const day = startOfDay(m.start);
      const title = `Review: ${c.name}`;
      if (has(day, title) || load(day) + review > input.maxPerDay) continue;
      const slot = findSlot(day, review, input.win, taken(), Math.max(earliest, m.end), m.end + 4 * 60 * MIN) ?? findSlot(day, review, input.win, taken(), Math.max(earliest, m.end), Infinity);
      if (slot) out.push({ ...slot, title, subject: c.name, source: 'routine' });
    }
  }

  const days = Array.from({ length: 7 }, (_, i) => startOfDay(input.now + i * DAY));
  for (const c of input.classes) {
    const classDays = new Set(c.meetings.map((m) => startOfDay(m.start)));
    const free = days.filter((d) => !classDays.has(d));
    const pool = free.length ? free : days;
    let placed = 0;
    const want = input.deepPerCourse ?? 2;
    // Spread: try every other day first, starting from different offsets per course.
    const order = [...pool.filter((_, i) => i % 2 === 0), ...pool.filter((_, i) => i % 2 === 1)];
    for (const day of order) {
      if (placed >= want) break;
      if (load(day) + input.blockMinutes > input.maxPerDay) continue;
      const slot = findSlot(day, input.blockMinutes, input.win, taken(), earliest, Infinity);
      if (!slot) continue;
      out.push({ ...slot, title: `Deep work: ${c.name}`, subject: c.name, source: 'routine' });
      placed++;
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/** Free stretches of at least `minMinutes` left today inside your study window. */
export function freeGaps(input: { now: number; win: Window; busy: Interval[]; minMinutes?: number }): Interval[] {
  const day = startOfDay(input.now);
  const at = (m: number) => { const d = new Date(day); d.setHours(0, m, 0, 0); return d.getTime(); };
  const from = Math.max(input.now, at(input.win.dayStart));
  const to = at(input.win.dayEnd);
  const min = (input.minMinutes ?? 30) * MIN;
  const busy = input.busy.filter((b) => b.end > from && b.start < to).sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  let cursor = Math.ceil(from / (5 * MIN)) * 5 * MIN;
  for (const b of busy) {
    if (b.start - cursor >= min) out.push({ start: cursor, end: b.start });
    cursor = Math.max(cursor, b.end);
  }
  if (to - cursor >= min) out.push({ start: cursor, end: to });
  return out;
}

/** Blocks from the last three days that ended without being marked done. */
export const missedBlocks = (blocks: StudyBlock[], now: number) => blocks.filter((b) => !b.done && b.end < now && b.end > now - 3 * DAY && b.source !== 'manual');

/** Moves missed blocks to the next free slots, one per day where possible, within a week. */
export function catchUp(input: { missed: StudyBlock[]; busy: Interval[]; planned: Interval[]; win: Window; maxPerDay: number; now: number }): { id: string; start: number; end: number }[] {
  const out: { id: string; start: number; end: number }[] = [];
  const load = (day: number) => [...input.planned, ...out].filter((b) => startOfDay(b.start) === day).reduce((n, b) => n + (b.end - b.start) / MIN, 0);
  for (const b of input.missed) {
    const minutes = Math.round((b.end - b.start) / MIN);
    for (let i = 0; i < 7; i++) {
      const day = startOfDay(input.now + i * DAY);
      if (load(day) + minutes > input.maxPerDay) continue;
      const slot = findSlot(day, minutes, input.win, [...input.busy, ...input.planned, ...out], input.now + 15 * MIN, Infinity);
      if (slot) {
        out.push({ id: b.id, ...slot });
        break;
      }
    }
  }
  return out;
}
