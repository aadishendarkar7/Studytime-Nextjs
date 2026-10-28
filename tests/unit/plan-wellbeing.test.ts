import { describe, expect, it } from 'vitest';
import { findSlot, isCrunch, planSessions, reviewPlan, startOfDay, studyWindow, suggestBlocks, weekLoads } from '@/features/calendar/plan';
import { patterns, strainCheck } from '@/features/wellbeing/logic';
import type { Reminder, Session } from '@/lib/types';

const prefs = { dayStart: '09:00', dayEnd: '22:00', blockMinutes: 50, maxPerDay: 180 };
const t = (y: number, m: number, d: number, h = 0, mi = 0) => new Date(y, m - 1, d, h, mi).getTime();
const reminder = (over: Partial<Reminder>): Reminder => ({ id: 'r1', title: 'STAT400 midterm', type: 'exam', dueAt: t(2026, 11, 6, 10), lead: 60, done: false, notifiedAt: null, ...over });

describe('study block planner', () => {
  const now = t(2026, 11, 2, 8); // Monday 8:00
  const win = studyWindow(prefs, '');

  it('skips busy time with a buffer', () => {
    const busy = [{ start: t(2026, 11, 2, 9), end: t(2026, 11, 2, 11) }];
    const slot = findSlot(startOfDay(now), 50, win, busy, now, Infinity)!;
    expect(new Date(slot.start).getHours()).toBe(11);
    expect(new Date(slot.start).getMinutes()).toBe(15);
  });

  it('wind-down time ends the study day early', () => {
    expect(studyWindow(prefs, '20:00').dayEnd).toBe(20 * 60);
    expect(studyWindow(prefs, '').dayEnd).toBe(22 * 60);
  });

  it('spreads exam prep over different days before the exam', () => {
    const out = suggestBlocks({ reminders: [reminder({})], blocks: [], busy: [], prefs, windDown: '', now });
    expect(out).toHaveLength(4);
    const days = new Set(out.map((p) => startOfDay(p.start)));
    expect(days.size).toBe(4);
    expect(out.every((p) => p.end <= t(2026, 11, 6, 9))).toBe(true);
    expect(out[0].title).toBe('Prep: STAT400 midterm (1 of 4)');
  });

  it('does not re-suggest blocks a deadline already has', () => {
    const blocks = [1, 2, 3, 4].map((i) => ({ id: String(i), title: 'x', subject: 'x', start: now + i * 3_600_000, end: now + i * 3_600_000 + 1, source: 'suggested' as const, reminderId: 'r1', done: false }));
    expect(suggestBlocks({ reminders: [reminder({})], blocks, busy: [], prefs, windDown: '', now })).toHaveLength(0);
  });

  it('respects the daily cap', () => {
    const out = planSessions({ title: 'A', subject: 'A', dueAt: t(2026, 11, 3, 12), count: 6, minutes: 60, now, win, busy: [], planned: [], maxPerDay: 120 });
    const perDay = new Map<number, number>();
    for (const p of out) perDay.set(startOfDay(p.start), (perDay.get(startOfDay(p.start)) ?? 0) + 60);
    expect([...perDay.values()].every((m) => m <= 120)).toBe(true);
  });

  it('plans flashcard review on the days before an exam', () => {
    const out = reviewPlan({ setName: 'Stats', setId: 's1', examAt: t(2026, 11, 9, 10), now, busy: [], planned: [], prefs, windDown: '' });
    expect(out.map((p) => new Date(p.start).getDate())).toEqual([3, 5, 7, 8]);
    expect(out[0].href).toBe('/study?tool=practice&set=s1');
  });

  it('flags crunch weeks', () => {
    const weeks = weekLoads({ reminders: [reminder({}), reminder({ id: 'r2', title: 'CHEM exam', dueAt: t(2026, 11, 5, 9) })], events: [{ title: 'MATH240 Quiz', start: t(2026, 11, 20, 9) }], now });
    expect(isCrunch(weeks[0])).toBe(true);
    expect(weeks[2].exams).toBe(1);
    expect(isCrunch(weeks[2])).toBe(false);
  });
});

const session = (day: string, minutes = 30): Session => ({ id: day + minutes, at: `${day}T12:00:00.000Z`, day, minutes, points: 0, subject: 'x', location: '' });
const check = (day: string, mood: 1 | 2 | 3 | 4 | 5, stress = 3, sleep: number | null = 7) => ({ day, mood, energy: 3, stress, sleep, note: '' });

describe('patterns and strain', () => {
  it('reports sleep patterns only with enough data', () => {
    const checkins = [];
    const sessions = [];
    for (let i = 1; i <= 6; i++) {
      checkins.push(check(`2026-10-0${i}`, 4, 2, 8));
      sessions.push(session(`2026-10-0${i}`, 90));
      checkins.push(check(`2026-10-1${i}`, 3, 3, 5));
      sessions.push(session(`2026-10-1${i}`, 30));
    }
    expect(patterns({ sessions, checkins })[0]).toContain('200% longer');
    expect(patterns({ sessions: sessions.slice(0, 4), checkins: checkins.slice(0, 4) })).toEqual([]);
  });

  it('notices a hard week but needs at least four check-ins', () => {
    const today = '2026-10-26';
    const hard = ['2026-10-26', '2026-10-25', '2026-10-24', '2026-10-23'].map((d) => check(d, 2, 4));
    expect(strainCheck({ sessions: [], checkins: hard, today }).kind).toBe('low');
    expect(strainCheck({ sessions: [], checkins: hard.slice(0, 3), today }).kind).toBe('none');
  });
});
