import type { CheckIn } from '@/lib/stores/extras';
import type { Session } from '@/lib/types';
import { dateKey } from '@/lib/utils';

export const MOODS: { value: 1 | 2 | 3 | 4 | 5; label: string }[] = [
  { value: 1, label: 'Rough' },
  { value: 2, label: 'Low' },
  { value: 3, label: 'Okay' },
  { value: 4, label: 'Good' },
  { value: 5, label: 'Great' },
];

/** Monday of the week containing `day` (YYYY-MM-DD), as YYYY-MM-DD. */
export function mondayOf(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return dateKey(date);
}

const addDays = (day: string, n: number) => {
  const [y, m, d] = day.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d + n));
};

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * Plain-language patterns, only when the data supports them: at least five
 * days in each group and a difference of 15% or more.
 */
export function patterns(input: { sessions: Session[]; checkins: CheckIn[] }): string[] {
  const minutes = new Map<string, number>();
  for (const s of input.sessions) minutes.set(s.day, (minutes.get(s.day) ?? 0) + s.minutes);
  const out: string[] = [];

  const withSleep = input.checkins.filter((c) => c.sleep !== null);
  const rested = withSleep.filter((c) => (c.sleep as number) >= 7).map((c) => minutes.get(c.day) ?? 0);
  const short = withSleep.filter((c) => (c.sleep as number) < 7).map((c) => minutes.get(c.day) ?? 0);
  if (rested.length >= 5 && short.length >= 5) {
    const a = avg(rested);
    const b = avg(short);
    if (b > 0 && a >= b * 1.15) out.push(`On days after 7 or more hours of sleep you studied ${Math.round(((a - b) / b) * 100)}% longer (${Math.round(a)} vs ${Math.round(b)} min, from ${rested.length + short.length} check-ins).`);
    else if (a > 0 && b >= a * 1.15) out.push(`You studied longer on short-sleep days (${Math.round(b)} vs ${Math.round(a)} min). Late nights studying can cost sleep the next day too.`);
  }

  const studied = input.checkins.filter((c) => (minutes.get(c.day) ?? 0) >= 30).map((c) => c.mood);
  const rest = input.checkins.filter((c) => (minutes.get(c.day) ?? 0) === 0).map((c) => c.mood);
  if (studied.length >= 5 && rest.length >= 5) {
    const a = avg(studied);
    const b = avg(rest);
    if (a >= b * 1.15) out.push(`Your mood averaged ${a.toFixed(1)} out of 5 on days you studied 30 minutes or more, and ${b.toFixed(1)} on days you did not.`);
  }

  const stressed = input.checkins.filter((c) => c.stress >= 4).map((c) => minutes.get(c.day) ?? 0);
  const calm = input.checkins.filter((c) => c.stress <= 2).map((c) => minutes.get(c.day) ?? 0);
  if (stressed.length >= 5 && calm.length >= 5) {
    const a = avg(stressed);
    const b = avg(calm);
    if (b > 0 && b >= a * 1.15) out.push(`You got ${Math.round(((b - a) / b) * 100)}% less study done on high-stress days. Shorter sessions and an early break may help on those days.`);
  }
  return out;
}

export type Strain = { kind: 'none' } | { kind: 'low'; days: number } | { kind: 'overload'; days: number };

/**
 * A gentle check, not a diagnosis. "low": mood and stress have both been hard
 * for most of the last week. "overload": study time jumped while mood dropped.
 */
export function strainCheck(input: { sessions: Session[]; checkins: CheckIn[]; today: string }): Strain {
  const week = (offset: number) => {
    const days = new Set(Array.from({ length: 7 }, (_, i) => addDays(input.today, -i - offset)));
    return {
      checks: input.checkins.filter((c) => days.has(c.day)),
      minutes: input.sessions.filter((s) => days.has(s.day)).reduce((n, s) => n + s.minutes, 0),
    };
  };
  const last = week(0);
  const prev = week(7);
  if (last.checks.length < 4) return { kind: 'none' };
  const mood = avg(last.checks.map((c) => c.mood));
  const stress = avg(last.checks.map((c) => c.stress));
  if (mood <= 2.2 && stress >= 3.8) return { kind: 'low', days: last.checks.length };
  if (prev.checks.length >= 3 && prev.minutes > 0 && last.minutes >= prev.minutes * 1.5 && avg(prev.checks.map((c) => c.mood)) - mood >= 0.8) return { kind: 'overload', days: last.checks.length };
  return { kind: 'none' };
}

export interface Burnout { level: 'none' | 'watch' | 'high'; reasons: string[] }

/**
 * Burnout warning signs from the last seven days, compared with the week before.
 * Each reason is something the student can see in their own data. Not a diagnosis.
 */
export function burnoutCheck(input: { sessions: Session[]; checkins: CheckIn[]; today: string; restDays?: string[] }): Burnout {
  const days = (offset: number) => new Set(Array.from({ length: 7 }, (_, i) => addDays(input.today, -i - offset)));
  const last = days(0);
  const prev = days(7);
  const mins = (set: Set<string>) => input.sessions.filter((s) => set.has(s.day)).reduce((n, s) => n + s.minutes, 0);
  const lastMin = mins(last);
  const prevMin = mins(prev);
  const checks = input.checkins.filter((c) => last.has(c.day));
  const prevChecks = input.checkins.filter((c) => prev.has(c.day));
  const reasons: string[] = [];
  let score = 0;

  if (prevMin >= 120 && lastMin >= prevMin * 1.4) {
    reasons.push(`You studied ${Math.round((lastMin / prevMin - 1) * 100)}% more than the week before.`);
    score++;
  }
  const late = input.sessions.filter((s) => last.has(s.day) && (() => { const h = new Date(s.at).getHours(); return h >= 0 && h < 5; })()).length;
  if (late >= 3) {
    reasons.push(`${late} sessions ended between midnight and 5 AM.`);
    score++;
  }
  const sleeps = checks.map((c) => c.sleep).filter((v): v is number => v !== null);
  if (sleeps.length >= 3 && avg(sleeps) < 6) {
    reasons.push(`You averaged ${avg(sleeps).toFixed(1)} hours of sleep.`);
    score += 2;
  }
  if (checks.length >= 3) {
    const stress = avg(checks.map((c) => c.stress));
    const prevStress = prevChecks.length >= 3 ? avg(prevChecks.map((c) => c.stress)) : null;
    if (stress >= 4) {
      reasons.push('Your stress has been high most days.');
      score += 2;
    } else if (prevStress !== null && stress - prevStress >= 0.8) {
      reasons.push('Your stress went up compared with the week before.');
      score++;
    }
    if (avg(checks.map((c) => c.mood)) <= 2.2) {
      reasons.push('Your mood has been low.');
      score += 2;
    }
  }
  const studiedDays = [...last].filter((d) => input.sessions.some((s) => s.day === d && s.minutes >= 15)).length;
  const rested = [...last].some((d) => input.restDays?.includes(d));
  if (studiedDays === 7 && !rested && lastMin >= 7 * 150) {
    reasons.push('You studied every day this week without a rest day.');
    score++;
  }
  return { level: score >= 3 ? 'high' : score >= 2 ? 'watch' : 'none', reasons };
}
