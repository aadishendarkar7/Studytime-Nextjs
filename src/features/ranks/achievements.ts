import type { DropLogEntry } from '@/lib/stores/extras';
import type { Session } from '@/lib/types';

export type Group = 'Focus' | 'Drop a Spot' | 'Habits' | 'Study tools';
export interface Achievement { id: string; group: Group; title: string; detail: string; have: number; need: number; done: boolean }

export interface AchievementInput {
  sessions: Session[];
  dropLog: DropLogEntry[];
  checkins: { day: string }[];
  water: Record<string, number>;
  waterGoal: number;
  resets: number;
  flashcardSets: number;
  notes: number;
  now: number;
}

const mondayKey = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toDateString();
};

/** Every achievement with progress, counted from what is saved in this browser. */
export function achievements(i: AchievementInput): Achievement[] {
  const minutes = i.sessions.reduce((n, s) => n + s.minutes, 0);
  const hourOf = (s: Session) => new Date(s.at).getHours();
  const days = new Map<string, Set<string>>();
  for (const s of i.sessions) {
    const w = mondayKey(s.day);
    days.set(w, (days.get(w) ?? new Set()).add(s.day));
  }
  const bestWeek = Math.max(0, ...[...days.values()].map((d) => d.size));
  const past = i.dropLog.filter((e) => e.at <= i.now);
  const hosted = past.filter((e) => e.role === 'host').length;
  const joined = past.filter((e) => e.role === 'joined').length;
  const people = new Set(past.flatMap((e) => e.with)).size;
  const spots = new Map<string, number>();
  for (const e of past) {
    const k = e.spotName.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    spots.set(k, (spots.get(k) ?? 0) + 1);
  }
  const regular = Math.max(0, ...spots.values());

  const list: Omit<Achievement, 'done'>[] = [
    { id: 'first-session', group: 'Focus', title: 'First session', detail: 'Finish a focus session.', have: i.sessions.length, need: 1 },
    { id: 'ten-hours', group: 'Focus', title: 'Ten hours in', detail: 'Ten hours of focus time in total.', have: Math.floor(minutes / 60), need: 10 },
    { id: 'fifty-hours', group: 'Focus', title: 'Fifty hours in', detail: 'Fifty hours of focus time in total.', have: Math.floor(minutes / 60), need: 50 },
    { id: 'five-days', group: 'Focus', title: 'Five-day week', detail: 'Study on five different days in one week.', have: bestWeek, need: 5 },
    { id: 'early', group: 'Focus', title: 'Early start', detail: 'Finish a session before 9 AM.', have: i.sessions.some((s) => hourOf(s) < 9) ? 1 : 0, need: 1 },
    { id: 'first-drop', group: 'Drop a Spot', title: 'First drop', detail: 'Drop a spot for others to join.', have: hosted, need: 1 },
    { id: 'host-ten', group: 'Drop a Spot', title: 'Regular host', detail: 'Host ten drops.', have: hosted, need: 10 },
    { id: 'pulled-up', group: 'Drop a Spot', title: 'Pulled up a chair', detail: 'Join someone else’s drop.', have: joined, need: 1 },
    { id: 'crew', group: 'Drop a Spot', title: 'Study crew', detail: 'Study with five different people.', have: people, need: 5 },
    { id: 'usual-spot', group: 'Drop a Spot', title: 'The usual spot', detail: 'Study at the same place five times.', have: regular, need: 5 },
    { id: 'checkins', group: 'Habits', title: 'Checked in', detail: 'Do seven daily check-ins.', have: i.checkins.length, need: 7 },
    { id: 'cards', group: 'Study tools', title: 'Card maker', detail: 'Make a flashcard set.', have: i.flashcardSets, need: 1 },
    { id: 'notes', group: 'Study tools', title: 'Note taker', detail: 'Turn class material into notes five times.', have: i.notes, need: 5 },
  ];
  return list.map((a) => ({ ...a, have: Math.min(a.have, a.need), done: a.have >= a.need }));
}

/** Levels from points: each level needs 150 more points than the one before. */
export function level(points: number) {
  let lvl = 1;
  while (points >= (150 * lvl * (lvl + 1)) / 2) lvl++;
  const floor = (150 * (lvl - 1) * lvl) / 2;
  const next = (150 * lvl * (lvl + 1)) / 2;
  return { level: lvl, into: points - floor, span: next - floor, next };
}

export type Tier = 0 | 1 | 2 | 3;
export const TIER_NAME = ['Locked', 'Bronze', 'Silver', 'Gold'] as const;
export interface Trophy { id: string; group: Group; title: string; unit: string; have: number; tiers: [number, number, number]; tier: Tier; next: number | null }

export interface TrophyInput extends AchievementInput {
  /** Longest run of daily check-in rewards. */
  bestRewardStreak: number;
  lessonsDone: number;
}

/** Trophies with bronze, silver and gold levels, counted from what is saved in this browser. */
export function trophies(i: TrophyInput): Trophy[] {
  const minutes = i.sessions.reduce((n, s) => n + s.minutes, 0);
  const weeks = new Map<string, Set<string>>();
  for (const s of i.sessions) {
    const w = mondayKey(s.day);
    weeks.set(w, (weeks.get(w) ?? new Set()).add(s.day));
  }
  const past = i.dropLog.filter((e) => e.at <= i.now);
  const spots = new Map<string, number>();
  for (const e of past) {
    const k = e.spotName.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    spots.set(k, (spots.get(k) ?? 0) + 1);
  }
  const lines: Omit<Trophy, 'tier' | 'next'>[] = [
    { id: 'hours', group: 'Focus', title: 'Deep focus', unit: 'hours focused', have: Math.floor(minutes / 60), tiers: [1, 10, 50] },
    { id: 'sessions', group: 'Focus', title: 'Session count', unit: 'sessions', have: i.sessions.length, tiers: [1, 25, 100] },
    { id: 'week', group: 'Focus', title: 'Full week', unit: 'days in one week', have: Math.max(0, ...[...weeks.values()].map((d) => d.size)), tiers: [3, 5, 7] },
    { id: 'early', group: 'Focus', title: 'Early bird', unit: 'sessions before 9 AM', have: i.sessions.filter((s) => new Date(s.at).getHours() < 9).length, tiers: [1, 5, 20] },
    { id: 'host', group: 'Drop a Spot', title: 'Host', unit: 'drops hosted', have: past.filter((e) => e.role === 'host').length, tiers: [1, 10, 30] },
    { id: 'joiner', group: 'Drop a Spot', title: 'Pull up a chair', unit: 'drops joined', have: past.filter((e) => e.role === 'joined').length, tiers: [1, 5, 20] },
    { id: 'crew', group: 'Drop a Spot', title: 'Study crew', unit: 'people studied with', have: new Set(past.flatMap((e) => e.with)).size, tiers: [2, 5, 15] },
    { id: 'regular', group: 'Drop a Spot', title: 'The usual spot', unit: 'visits to one spot', have: Math.max(0, ...spots.values()), tiers: [3, 5, 10] },
    { id: 'checkins', group: 'Habits', title: 'Checked in', unit: 'check-ins', have: i.checkins.length, tiers: [3, 7, 30] },
    { id: 'streak', group: 'Habits', title: 'On a roll', unit: 'check-in days in a row', have: i.bestRewardStreak, tiers: [3, 7, 14] },
    { id: 'cards', group: 'Study tools', title: 'Card maker', unit: 'flashcard sets', have: i.flashcardSets, tiers: [1, 5, 15] },
    { id: 'notes', group: 'Study tools', title: 'Note taker', unit: 'notes made', have: i.notes, tiers: [1, 5, 20] },
    { id: 'lessons', group: 'Study tools', title: 'Scholar', unit: 'course lessons finished', have: i.lessonsDone, tiers: [1, 10, 30] },
  ];
  return lines.map((t) => {
    const tier = t.tiers.filter((n) => t.have >= n).length as Tier;
    return { ...t, tier, next: (t.tiers as number[])[tier] ?? null };
  });
}

/** Longest run of consecutive days in a list of YYYY-MM-DD keys. */
export function longestRun(days: string[]) {
  const sorted = [...new Set(days)].sort();
  let best = 0;
  let run = 0;
  let prev = 0;
  for (const d of sorted) {
    const t = new Date(`${d}T12:00:00`).getTime();
    run = prev && Math.round((t - prev) / 86_400_000) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  return best;
}
