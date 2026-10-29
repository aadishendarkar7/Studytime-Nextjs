import { describe, expect, it } from 'vitest';
import { completeSession, streaks, weekMinutes } from '@/features/focus/logic';
import { parseBulkCards } from '@/features/games/decks';
import { isDue, schedule, DAY_MS } from '@/features/games/srs';
import { parseDue, scanSyllabus } from '@/features/planner/syllabus';
import type { Session } from '@/lib/types';
import { parseJSONLoose } from '@/lib/utils';

const session = (day: string, minutes = 30): Session => ({ id: day + minutes, at: `${day}T12:00:00`, day, minutes, points: 25, subject: 'x', location: '' });

describe('streaks', () => {
  it('counts consecutive days ending today or yesterday', () => {
    const s = [session('2026-10-20'), session('2026-10-21'), session('2026-10-22'), session('2026-10-24')];
    expect(streaks(s, '2026-10-24')).toEqual({ current: 1, best: 3 });
    expect(streaks(s, '2026-10-25')).toEqual({ current: 1, best: 3 });
    expect(streaks(s, '2026-10-26').current).toBe(0);
  });
});

describe('completeSession', () => {
  it('awards base points and the daily goal bonus once', () => {
    const now = new Date('2026-10-25T10:00:00');
    const first = completeSession({ sessions: [], bonusDays: [], dailyGoal: 60, duration: 60, subject: 'Bio', location: '', now });
    expect(first.base).toBe(60);
    expect(first.bonus).toBe(15);
    expect(first.bonusDay).toBe('2026-10-25');
    const again = completeSession({ sessions: [first.session], bonusDays: ['2026-10-25'], dailyGoal: 60, duration: 30, subject: '', location: '', now });
    expect(again.bonus).toBe(0);
    expect(again.session.subject).toBe('Study session');
  });
  it('adds the 3-day streak bonus on the third day', () => {
    const prior = [session('2026-10-23'), session('2026-10-24')];
    const r = completeSession({ sessions: prior, bonusDays: [], dailyGoal: 600, duration: 15, subject: '', location: '', now: new Date('2026-10-25T09:00:00') });
    expect(r.bonus).toBe(20);
  });
  it('sums this week only', () => {
    expect(weekMinutes([session('2026-10-19', 30), session('2026-10-18', 45)], new Date('2026-10-25T12:00:00'))).toBe(30);
  });
});

describe('spaced repetition', () => {
  it('schedules growing intervals and resets on again', () => {
    const now = 1_000_000;
    let s = schedule(undefined, 'good', now);
    expect(s.interval).toBe(1);
    s = schedule(s, 'good', now);
    expect(s.interval).toBe(3);
    s = schedule(s, 'good', now);
    expect(s.interval).toBe(Math.round(3 * 2.5));
    expect(s.due).toBe(now + s.interval * DAY_MS);
    const again = schedule(s, 'again', now);
    expect(again.reps).toBe(0);
    expect(again.due).toBe(now + 60_000);
    expect(again.ease).toBeCloseTo(2.3);
  });
  it('treats unseen cards as due', () => {
    expect(isDue({})).toBe(true);
    expect(isDue({ srs: { interval: 1, ease: 2.5, reps: 1, due: Date.now() + DAY_MS } })).toBe(false);
  });
});

describe('syllabus scanner', () => {
  it('finds dated graded work and guesses types', () => {
    const items = scanSyllabus('Week 1: Intro (no work)\nHomework 1 due Sept 5, 2026\nMidterm Exam — 10/14/2026\nOffice hours Oct 3\nFinal paper due December 9th, 2026', 2026);
    expect(items.map((i) => [i.title, i.type])).toEqual([
      ['Homework 1', 'homework'],
      ['Midterm Exam', 'exam'],
      ['Final paper', 'assignment'],
    ]);
    expect(new Date(items[1].dueAt).getMonth()).toBe(9);
  });
  it('rejects impossible dates', () => {
    expect(parseDue('Quiz 2/30/2026')).toBeNull();
  });
});

describe('helpers', () => {
  it('parses bulk cards in several formats', () => {
    expect(parseBulkCards('A - B\nC: D\nE\tF\nbad')).toEqual([{ front: 'A', back: 'B' }, { front: 'C', back: 'D' }, { front: 'E', back: 'F' }]);
  });
  it('extracts JSON from fenced or chatty replies', () => {
    expect(parseJSONLoose('Sure!\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJSONLoose('Here: {"cards":[{"front":"x","back":"y"}]} hope it helps')).toEqual({ cards: [{ front: 'x', back: 'y' }] });
    expect(() => parseJSONLoose('nope')).toThrow();
  });
});

describe('markdown math normalization', async () => {
  const { normalizeMath } = await import('@/components/ui/markdown');
  it('escapes currency but keeps math', () => {
    expect(normalizeMath('costs $5 and $10.')).toBe('costs \\$5 and \\$10.');
    expect(normalizeMath('$2x + 1$ and $$x^2$$')).toBe('$2x + 1$ and $$x^2$$');
    expect(normalizeMath('\\(a+b\\) then \\[c\\]')).toBe('$a+b$ then $$c$$');
    expect(normalizeMath('Price: $1,200.50, tax $3')).toBe('Price: \\$1,200.50, tax \\$3');
  });
});

describe('math in AI replies', async () => {
  const { normalizeMath } = await import('@/lib/math-text');
  const { parseJSONLoose } = await import('@/lib/utils');
  it('treats a dollar before a number as math when the inside is math', () => {
    const t = 'For a $2 \\times 2$ matrix $\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}$, the inverse is $\\frac{1}{ad-bc}$.';
    expect(normalizeMath(t)).toBe(t);
  });
  it('keeps prices as text and short expressions as math', () => {
    expect(normalizeMath('Lunch was $12 and coffee $4.')).toBe('Lunch was \\$12 and coffee \\$4.');
    expect(normalizeMath('Solve $2x + 1 = 5$ for $x$.')).toBe('Solve $2x + 1 = 5$ for $x$.');
    expect(normalizeMath('Use `$PATH` and $y$')).toBe('Use `$PATH` and $y$');
  });
  it('rescues LaTeX inside JSON', () => {
    const raw = '{"body":"The inverse is $\\frac{1}{ad-bc}$ and $2 \\times 2$ and \\(x\\)","n":"line\\nnext"}';
    const r = parseJSONLoose<{ body: string; n: string }>(raw);
    expect(r.body).toBe('The inverse is $\\frac{1}{ad-bc}$ and $2 \\times 2$ and \\(x\\)');
    expect(r.n).toBe('line\nnext');
  });
});
