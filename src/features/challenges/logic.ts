import type { DropLogEntry, JoinedChallenge } from '@/lib/stores/extras';
import type { Session } from '@/lib/types';

export interface Challenge { id: string; title: string; detail: string; days: number; target: number; unit: string; points: number; metric: (d: ChallengeData, from: number, to: number) => number }
export interface ChallengeData { sessions: Session[]; dropLog: DropLogEntry[]; rewardDays: string[] }

const sessionsIn = (d: ChallengeData, from: number, to: number) => d.sessions.filter((s) => { const t = new Date(s.at).getTime(); return t >= from && t <= to; });
const dayStart = (ms: number) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };

export const CHALLENGES: Challenge[] = [
  { id: 'five-hour-week', title: 'Five-hour week', detail: 'Focus for five hours in seven days.', days: 7, target: 300, unit: 'min', points: 60, metric: (d, a, b) => sessionsIn(d, a, b).reduce((n, s) => n + s.minutes, 0) },
  { id: 'five-of-seven', title: 'Five of seven', detail: 'Study on five different days this week.', days: 7, target: 5, unit: 'days', points: 50, metric: (d, a, b) => new Set(sessionsIn(d, a, b).map((s) => s.day)).size },
  { id: 'deep-three', title: 'Deep work', detail: 'Three sessions of 50 minutes or more in a week.', days: 7, target: 3, unit: 'sessions', points: 40, metric: (d, a, b) => sessionsIn(d, a, b).filter((s) => s.minutes >= 50).length },
  { id: 'early-riser', title: 'Early riser', detail: 'Three sessions that end before 9 AM in a week.', days: 7, target: 3, unit: 'sessions', points: 40, metric: (d, a, b) => sessionsIn(d, a, b).filter((s) => new Date(s.at).getHours() < 9).length },
  { id: 'check-in-week', title: 'Every day check-in', detail: 'Check in seven days in a row.', days: 7, target: 7, unit: 'days', points: 40, metric: (d, a, b) => d.rewardDays.filter((k) => { const t = new Date(`${k}T12:00:00`).getTime(); return t >= dayStart(a) && t <= b; }).length },
  { id: 'social-study', title: 'Study together', detail: 'Host or join three drops in two weeks.', days: 14, target: 3, unit: 'drops', points: 60, metric: (d, a, b) => d.dropLog.filter((e) => e.role !== 'solo' && e.at >= a && e.at <= b).length },
  { id: 'twenty-hours', title: 'Twenty-hour month', detail: 'Focus for twenty hours in thirty days.', days: 30, target: 1200, unit: 'min', points: 150, metric: (d, a, b) => sessionsIn(d, a, b).reduce((n, s) => n + s.minutes, 0) },
];

export type ChallengeState = { challenge: Challenge; entry: JoinedChallenge | null; status: 'open' | 'active' | 'done' | 'missed'; have: number; endsAt: number; wins: number };

/** Where you stand on every challenge: not joined, in progress, finished, or ran out of time. */
export function challengeStates(joined: JoinedChallenge[], data: ChallengeData, now: number): ChallengeState[] {
  return CHALLENGES.map((c) => {
    const mine = joined.filter((j) => j.id === c.id).sort((a, b) => b.joinedAt - a.joinedAt);
    const wins = mine.filter((j) => j.doneAt).length;
    const entry = mine[0] ?? null;
    if (!entry) return { challenge: c, entry, status: 'open', have: 0, endsAt: 0, wins };
    const endsAt = entry.joinedAt + c.days * 86_400_000;
    const have = c.metric(data, entry.joinedAt, Math.min(now, endsAt));
    const status = entry.doneAt ? 'done' : have >= c.target ? 'done' : now > endsAt ? 'missed' : 'active';
    return { challenge: c, entry, status, have: Math.min(have, c.target), endsAt, wins };
  });
}
