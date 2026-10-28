import { describe, expect, it } from 'vitest';
import { examPlan, readiness, sessionsFor, upcomingExams, type Topic } from '@/features/calendar/exam-prep';
import { startOfDay } from '@/features/calendar/plan';
import { catchUp, courseName, detectClasses, freeGaps, missedBlocks, routinePlan } from '@/features/calendar/routine';
import type { StudyBlock } from '@/lib/stores/extras';

const H = 3_600_000;
const D = 86_400_000;
const monday = new Date(2026, 10, 2, 8, 0).getTime(); // Mon Nov 2 2026, 8:00
const at = (day: number, h: number, m = 0) => { const d = new Date(monday + day * D); d.setHours(h, m, 0, 0); return d.getTime(); };
const win = { dayStart: 9 * 60, dayEnd: 22 * 60 };
const ev = (uid: string, title: string, s: number, e: number) => ({ uid, title, start: s, end: e, allDay: false, location: '' });

const events = [
  ...[0, 2, 4, 7, 9, 11].map((d) => ev(`m${d}`, 'MATH240 Lecture', at(d, 10), at(d, 10, 50))),
  ...[1, 3, 8, 10].map((d) => ev(`s${d}`, 'STAT400 Lecture', at(d, 11), at(d, 12, 15))),
  ev('w1', 'Library shift', at(0, 14), at(0, 17)),
  ev('w2', 'Library shift', at(2, 14), at(2, 17)),
  ev('x1', 'STAT400 Midterm', at(5, 10), at(5, 11, 15)),
];

describe('weekly routine', () => {
  it('groups lectures and sections by course code', () => {
    expect(courseName('MATH240 Lecture')).toBe('MATH240');
    expect(courseName('CMSC 131 Discussion 0102')).toBe('CMSC131');
    expect(courseName('Intro to Psych Lecture')).toBe('Intro to Psych');
  });

  it('finds repeating classes and skips shifts and exams', () => {
    const c = detectClasses(events, monday);
    expect(c.map((x) => x.name)).toEqual(['MATH240', 'STAT400']);
    expect(c[0].meetings).toHaveLength(3);
  });

  it('puts a review right after each class and deep work on other days', () => {
    const classes = detectClasses(events, monday);
    const busy = events.map((e) => ({ start: e.start, end: e.end }));
    const plan = routinePlan({ classes, busy, planned: [], win, maxPerDay: 180, blockMinutes: 50, now: monday });
    const reviews = plan.filter((p) => p.title.startsWith('Review'));
    expect(reviews).toHaveLength(5);
    const firstMath = reviews.find((r) => r.subject === 'MATH240')!;
    expect(firstMath.start).toBeGreaterThanOrEqual(at(0, 10, 50));
    expect(firstMath.start).toBeLessThan(at(0, 14));
    const deep = plan.filter((p) => p.title.startsWith('Deep work'));
    expect(deep).toHaveLength(4);
    for (const d of deep.filter((x) => x.subject === 'MATH240')) expect([0, 2, 4]).not.toContain(Math.round((startOfDay(d.start) - startOfDay(monday)) / D));
    for (const p of plan) for (const b of busy) expect(p.start < b.end && b.start < p.end).toBe(false);
  });

  it('does not add a review twice when the routine is built again', () => {
    const classes = detectClasses(events, monday);
    const busy = events.map((e) => ({ start: e.start, end: e.end }));
    const first = routinePlan({ classes, busy, planned: [], win, maxPerDay: 180, blockMinutes: 50, now: monday });
    const again = routinePlan({ classes, busy, planned: first, win, maxPerDay: 180, blockMinutes: 50, now: monday });
    expect(again.filter((p) => p.title.startsWith('Review'))).toHaveLength(0);
  });

  it('lists free gaps today', () => {
    const busy = events.map((e) => ({ start: e.start, end: e.end }));
    const gaps = freeGaps({ now: at(0, 9), win, busy });
    expect(gaps.map((g) => [new Date(g.start).getHours(), new Date(g.end).getHours()])).toEqual([[9, 10], [10, 14], [17, 22]]);
  });

  it('moves missed blocks into free time', () => {
    const blocks: StudyBlock[] = [{ id: 'b1', title: 'Prep', subject: 'x', start: at(0, 18), end: at(0, 19), source: 'suggested', done: false }, { id: 'b2', title: 'Mine', subject: 'x', start: at(0, 19), end: at(0, 20), source: 'manual', done: false }];
    const now = at(1, 9);
    const missed = missedBlocks(blocks, now);
    expect(missed.map((b) => b.id)).toEqual(['b1']);
    const moved = catchUp({ missed, busy: events.map((e) => ({ start: e.start, end: e.end })), planned: [], win, maxPerDay: 180, now });
    expect(moved).toHaveLength(1);
    expect(moved[0].start).toBeGreaterThan(now);
  });
});

describe('exam prep', () => {
  const topics: Topic[] = [
    { id: '1', name: 'Probability rules', conf: 'solid', minutes: 45 },
    { id: '2', name: 'Random variables', conf: 'shaky', minutes: 45 },
    { id: '3', name: 'Normal distribution', conf: 'new', minutes: 60 },
    { id: '4', name: 'CLT', conf: 'new', minutes: 60 },
  ];

  it('finds exams in deadlines and calendars once', () => {
    const list = upcomingExams({ reminders: [{ id: 'r1', title: 'STAT400 Midterm', type: 'exam', dueAt: at(5, 10), done: false }], events, now: monday });
    expect(list).toHaveLength(1);
    expect(list[0].reminderId).toBe('r1');
  });

  it('gives new topics two sessions and skips solid ones', () => {
    expect(sessionsFor(topics).map((s) => s.title)).toEqual(['Practice: Random variables', 'Learn: Normal distribution', 'Practice: Normal distribution', 'Learn: CLT', 'Practice: CLT']);
  });

  it('spreads topics in order and ends with a practice exam and a light review', () => {
    const exam = { key: 'r1', title: 'STAT400 Midterm', at: at(5, 10) };
    const { proposals, missing } = examPlan({ exam, topics, now: monday, win, busy: events.map((e) => ({ start: e.start, end: e.end })), planned: [], maxPerDay: 180 });
    expect(missing).toBe(0);
    expect(proposals.every((p) => p.end <= exam.at - H)).toBe(true);
    const last = proposals[proposals.length - 1];
    expect(last.title).toMatch(/^Light review/);
    expect(startOfDay(last.start)).toBe(startOfDay(at(4, 12)));
    const practice = proposals.find((p) => p.title.startsWith('Practice exam'))!;
    expect(startOfDay(practice.start)).toBe(startOfDay(at(3, 12)));
    const topicDays = new Set(proposals.filter((p) => !p.title.includes(exam.title)).map((p) => startOfDay(p.start)));
    expect(topicDays.size).toBeGreaterThanOrEqual(3);
    const learnCLT = proposals.findIndex((p) => p.title === 'Learn: CLT');
    expect(learnCLT).toBeGreaterThan(proposals.findIndex((p) => p.title === 'Learn: Normal distribution'));
  });

  it('scores readiness from confidence and finished blocks', () => {
    expect(readiness([], [], 'r1')).toBeNull();
    expect(readiness(topics, [], 'r1')).toBe(38);
    expect(readiness(topics, [{ reminderId: 'r1', source: 'exam', done: true }, { reminderId: 'r1', source: 'exam', done: false }], 'r1')).toBe(43);
  });
});
