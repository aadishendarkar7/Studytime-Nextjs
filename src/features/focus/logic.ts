import type { Session } from '@/lib/types';
import { dateKey, dayBefore, todayKey, uid, weekStart } from '@/lib/utils';

export const DURATIONS = [15, 30, 60, 90] as const;
export type Duration = (typeof DURATIONS)[number];
export const AWARD: Record<Duration, number> = { 15: 10, 30: 25, 60: 60, 90: 100 };
export const DAILY_GOAL_BONUS = 15;
export const STREAK_BONUS = { three: 20, weekly: 50 };

export const isDuration = (n: number): n is Duration => (DURATIONS as readonly number[]).includes(n);

export const minutesOn = (sessions: Session[], key: string) => sessions.filter((s) => s.day === key).reduce((n, s) => n + s.minutes, 0);

export function weekMinutes(sessions: Session[], now = new Date()) {
  const start = weekStart(now).getTime();
  return sessions.filter((s) => new Date(s.at).getTime() >= start).reduce((n, s) => n + s.minutes, 0);
}

export function weekSeries(sessions: Session[], now = new Date()) {
  const start = weekStart(now);
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return { label, minutes: minutesOn(sessions, dateKey(d)) };
  });
}

export function streaks(sessions: Session[], today = todayKey()) {
  const days = [...new Set(sessions.map((s) => s.day))].sort();
  let best = 0;
  let run = 0;
  let prior = '';
  for (const day of days) {
    run = prior && dayBefore(day) === prior ? run + 1 : 1;
    best = Math.max(best, run);
    prior = day;
  }
  const set = new Set(days);
  let cursor = set.has(today) ? today : dayBefore(today);
  let current = 0;
  while (set.has(cursor)) {
    current++;
    cursor = dayBefore(cursor);
  }
  return { current, best };
}

/** Build the session record and bonus points for a completed focus session. */
export function completeSession(input: {
  sessions: Session[];
  bonusDays: string[];
  dailyGoal: number;
  duration: Duration;
  subject: string;
  location: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const day = dateKey(now);
  const priorMinutes = minutesOn(input.sessions, day);
  const priorStreak = streaks(input.sessions, day).current;
  const base = AWARD[input.duration];
  const session: Session = { id: uid(), at: now.toISOString(), day, minutes: input.duration, points: base, subject: input.subject.trim() || 'Study session', location: input.location.trim() };
  const sessions = [session, ...input.sessions];
  let bonus = 0;
  let bonusDay: string | null = null;
  if (priorMinutes < input.dailyGoal && priorMinutes + input.duration >= input.dailyGoal && !input.bonusDays.includes(day)) {
    bonus += DAILY_GOAL_BONUS;
    bonusDay = day;
  }
  const newStreak = streaks(sessions, day).current;
  if (newStreak > priorStreak || priorMinutes === 0) {
    if (newStreak === 3) bonus += STREAK_BONUS.three;
    if (newStreak >= 7 && newStreak % 7 === 0) bonus += STREAK_BONUS.weekly;
  }
  session.points += bonus;
  return { session, base, bonus, bonusDay };
}
