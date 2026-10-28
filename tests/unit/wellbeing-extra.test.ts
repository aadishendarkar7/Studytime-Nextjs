import { describe, expect, it } from 'vitest';
import { codeIn, myClasses } from '@/features/classes/logic';
import { streaks } from '@/features/focus/logic';
import { burnoutCheck } from '@/features/wellbeing/logic';
import { inQuietHours } from '@/lib/quiet';
import type { CheckIn } from '@/lib/stores/extras';
import type { Session } from '@/lib/types';

const day = (n: number) => { const d = new Date(2026, 9, 28 - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const session = (n: number, minutes: number, hour = 15): Session => ({ id: `${n}-${hour}`, day: day(n), at: new Date(2026, 9, 28 - n, hour).toISOString(), minutes, points: 0, subject: 'STAT400', location: '' });
const check = (n: number, c: Partial<CheckIn>): CheckIn => ({ day: day(n), mood: 3, energy: 3, stress: 3, sleep: 7, note: '', ...c });

describe('burnout check', () => {
  it('stays quiet on a normal week', () => {
    const sessions = [...Array.from({ length: 5 }, (_, i) => session(i, 60)), ...Array.from({ length: 5 }, (_, i) => session(i + 7, 60))];
    expect(burnoutCheck({ sessions, checkins: [check(0, {}), check(1, {}), check(2, {})], today: day(0) }).level).toBe('none');
  });

  it('flags a jump in study time with short sleep and late nights', () => {
    const sessions = [...Array.from({ length: 7 }, (_, i) => session(i, 200)), session(1, 60, 1), session(2, 60, 2), session(3, 60, 3), ...Array.from({ length: 4 }, (_, i) => session(i + 7, 90))];
    const r = burnoutCheck({ sessions, checkins: [0, 1, 2].map((n) => check(n, { sleep: 5, stress: 4 })), today: day(0) });
    expect(r.level).toBe('high');
    expect(r.reasons.join(' ')).toMatch(/sleep/);
    expect(r.reasons.join(' ')).toMatch(/midnight/);
  });
});

describe('rest days keep the streak', () => {
  it('skips a planned rest day', () => {
    const sessions = [session(0, 30), session(2, 30), session(3, 30)];
    expect(streaks(sessions, day(0)).current).toBe(1);
    expect(streaks(sessions, day(0), [day(1)]).current).toBe(3);
  });
});

describe('quiet hours', () => {
  it('handles windows across midnight', () => {
    const q = { on: true, from: '23:00', to: '07:00' };
    expect(inQuietHours(q, new Date(2026, 9, 28, 23, 30))).toBe(true);
    expect(inQuietHours(q, new Date(2026, 9, 28, 6, 59))).toBe(true);
    expect(inQuietHours(q, new Date(2026, 9, 28, 7, 0))).toBe(false);
    expect(inQuietHours({ ...q, on: false }, new Date(2026, 9, 28, 23, 30))).toBe(false);
    expect(inQuietHours({ on: true, from: '13:00', to: '15:00' }, new Date(2026, 9, 28, 14, 0))).toBe(true);
  });
});

describe('classes from calendars', () => {
  it('finds course codes in Canvas titles', () => {
    expect(codeIn('Homework 5 [STAT400-0101-Fall2026]')).toBe('STAT400');
    expect(codeIn('CMSC 131 Project 2')).toBe('CMSC131');
    expect(myClasses(['MATH240'], ['Quiz 3 [STAT400-0101]', 'MATH240 Lecture', 'Dinner']).map((c) => c.code)).toEqual(['MATH240', 'STAT400']);
  });
});
