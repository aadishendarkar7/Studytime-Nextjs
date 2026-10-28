import type { CheckIn, DropLogEntry } from '@/lib/stores/extras';
import type { Session } from '@/lib/types';

export type Period = 'week' | 'month' | 'semester' | 'all';
export const PERIOD_LABEL: Record<Period, string> = { week: 'This week', month: 'This month', semester: 'This semester', all: 'All time' };

/** Start of the period containing `now`, in local time. Semesters start mid-January, late May and mid-August. */
export function periodStart(period: Period, now: number) {
  const d = new Date(now);
  if (period === 'week') return new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)).getTime();
  if (period === 'month') return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  if (period === 'semester') {
    const y = d.getFullYear();
    const starts = [new Date(y, 0, 15), new Date(y, 4, 20), new Date(y, 7, 15)].map((x) => x.getTime()).filter((t) => t <= now);
    return starts.length ? starts[starts.length - 1] : new Date(y - 1, 7, 15).getTime();
  }
  return 0;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export interface Wrapped {
  minutes: number;
  sessions: number;
  days: number;
  longest: number;
  subjects: { name: string; minutes: number }[];
  weekday: string | null;
  hour: number | null;
  spot: string | null;
  people: number;
  buddy: string | null;
  hosted: number;
  joined: number;
  glasses: number;
  mood: number | null;
  change: number | null;
}

/** A recap of everything logged between `from` and `now`, compared with the same length of time before it. */
export function wrap(input: { sessions: Session[]; dropLog: DropLogEntry[]; water: Record<string, number>; checkins: CheckIn[]; from: number; now: number }): Wrapped {
  const inRange = (t: number) => t >= input.from && t <= input.now;
  const list = input.sessions.filter((s) => inRange(new Date(s.at).getTime()));
  const minutes = list.reduce((n, s) => n + s.minutes, 0);
  const bySubject = new Map<string, number>();
  const byWeekday = new Array(7).fill(0);
  const byHour = new Array(24).fill(0);
  for (const s of list) {
    bySubject.set(s.subject || 'Study session', (bySubject.get(s.subject || 'Study session') ?? 0) + s.minutes);
    const at = new Date(s.at);
    byWeekday[at.getDay()] += s.minutes;
    byHour[at.getHours()] += s.minutes;
  }
  const top = (arr: number[]) => (Math.max(...arr) > 0 ? arr.indexOf(Math.max(...arr)) : null);
  const drops = input.dropLog.filter((e) => inRange(e.at));
  const spots = new Map<string, number>();
  const people = new Map<string, number>();
  for (const e of drops) {
    spots.set(e.spotName, (spots.get(e.spotName) ?? 0) + 1);
    for (const n of new Set(e.with)) people.set(n, (people.get(n) ?? 0) + 1);
  }
  const best = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const fromDay = new Date(input.from).toISOString().slice(0, 10);
  const moods = input.checkins.filter((c) => input.from === 0 || c.day >= fromDay).map((c) => c.mood);
  const span = input.now - input.from;
  const before = input.from > 0 ? input.sessions.filter((s) => { const t = new Date(s.at).getTime(); return t >= input.from - span && t < input.from; }).reduce((n, s) => n + s.minutes, 0) : 0;
  const weekday = top(byWeekday);
  return {
    minutes,
    sessions: list.length,
    days: new Set(list.map((s) => s.day)).size,
    longest: Math.max(0, ...list.map((s) => s.minutes)),
    subjects: [...bySubject.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, m]) => ({ name, minutes: m })),
    weekday: weekday === null ? null : WEEKDAYS[weekday],
    hour: top(byHour),
    spot: best(spots),
    people: people.size,
    buddy: best(people),
    hosted: drops.filter((e) => e.role === 'host').length,
    joined: drops.filter((e) => e.role === 'joined').length,
    glasses: Object.entries(input.water).filter(([day]) => input.from === 0 || day >= fromDay).reduce((n, [, g]) => n + g, 0),
    mood: moods.length ? Math.round((moods.reduce((a, b) => a + b, 0) / moods.length) * 10) / 10 : null,
    change: input.from > 0 && before > 0 ? Math.round(((minutes - before) / before) * 100) : null,
  };
}

export const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`;
