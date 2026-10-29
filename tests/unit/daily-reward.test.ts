import { describe, expect, it } from 'vitest';
import { dailyReward, rewardStreak } from '@/features/rewards/daily';

describe('daily check-in reward', () => {
  it('starts at day 1 with no history', () => {
    expect(dailyReward([], '2026-10-29')).toEqual({ claimed: false, streak: 0, index: 0, points: 5 });
  });
  it('climbs while the streak holds', () => {
    const days = ['2026-10-26', '2026-10-27', '2026-10-28'];
    expect(dailyReward(days, '2026-10-29').index).toBe(3);
    expect(dailyReward([...days, '2026-10-29'], '2026-10-29')).toMatchObject({ claimed: true, index: 3, streak: 4 });
  });
  it('resets after a missed day', () => {
    expect(rewardStreak(['2026-10-26', '2026-10-27'], '2026-10-29')).toBe(0);
    expect(dailyReward(['2026-10-26', '2026-10-27'], '2026-10-29').index).toBe(0);
  });
  it('wraps after day 7', () => {
    const days = Array.from({ length: 7 }, (_, i) => `2026-10-${String(20 + i).padStart(2, '0')}`);
    expect(dailyReward(days, '2026-10-27')).toMatchObject({ index: 0, points: 5 });
    expect(dailyReward(days, '2026-10-26')).toMatchObject({ claimed: true, index: 6, points: 50 });
  });
});

import { challengeStates } from '@/features/challenges/logic';
import { longestRun, trophies } from '@/features/ranks/achievements';

describe('challenges', () => {
  const at = (iso: string, minutes: number) => ({ id: iso, at: new Date(iso).toISOString(), day: iso.slice(0, 10), minutes, points: 0, subject: '', location: '' });
  const joinedAt = new Date('2026-10-20T00:00:00').getTime();
  it('counts only what happened after joining', () => {
    const data = { sessions: [at('2026-10-19T10:00:00', 200), at('2026-10-21T10:00:00', 120), at('2026-10-22T10:00:00', 60)], dropLog: [], rewardDays: [] };
    const s = challengeStates([{ id: 'five-hour-week', joinedAt, doneAt: null }], data, joinedAt + 3 * 86_400_000).find((x) => x.challenge.id === 'five-hour-week')!;
    expect(s).toMatchObject({ status: 'active', have: 180 });
  });
  it('is done at the target and missed after the window', () => {
    const data = { sessions: [at('2026-10-21T10:00:00', 300)], dropLog: [], rewardDays: [] };
    expect(challengeStates([{ id: 'five-hour-week', joinedAt, doneAt: null }], data, joinedAt + 86_400_000 * 2)[0].status).toBe('done');
    expect(challengeStates([{ id: 'five-hour-week', joinedAt, doneAt: null }], { ...data, sessions: [] }, joinedAt + 86_400_000 * 8)[0].status).toBe('missed');
  });
});

describe('trophies', () => {
  it('earns bronze, silver and gold by thresholds', () => {
    const sessions = Array.from({ length: 30 }, (_, i) => ({ id: String(i), at: new Date(2026, 9, 1 + (i % 28), 14).toISOString(), day: '2026-10-01', minutes: 30, points: 0, subject: '', location: '' }));
    const t = trophies({ sessions, dropLog: [], checkins: [], water: {}, waterGoal: 8, resets: 0, flashcardSets: 0, notes: 0, now: Date.now(), bestRewardStreak: 7, lessonsDone: 0 });
    expect(t.find((x) => x.id === 'sessions')).toMatchObject({ tier: 2, next: 100 });
    expect(t.find((x) => x.id === 'hours')).toMatchObject({ tier: 2, have: 15 });
    expect(t.find((x) => x.id === 'streak')).toMatchObject({ tier: 2 });
    expect(t.find((x) => x.id === 'notes')).toMatchObject({ tier: 0, next: 1 });
  });
  it('finds the longest run of days', () => {
    expect(longestRun(['2026-10-01', '2026-10-02', '2026-10-04', '2026-10-05', '2026-10-06'])).toBe(3);
    expect(longestRun([])).toBe(0);
  });
});
