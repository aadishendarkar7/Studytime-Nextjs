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
  const waterDays = Object.values(i.water).filter((n) => n >= i.waterGoal).length;

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
    { id: 'water', group: 'Habits', title: 'Hydrated', detail: 'Reach your water goal on five days.', have: waterDays, need: 5 },
    { id: 'reset', group: 'Habits', title: 'Fresh week', detail: 'Finish a weekly reset.', have: i.resets, need: 1 },
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
