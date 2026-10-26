import type { Card, SrsState } from '@/lib/types';

export const DAY_MS = 86_400_000;
export type Rating = 'again' | 'hard' | 'good' | 'easy';
export const RATINGS: { id: Rating; label: string }[] = [
  { id: 'again', label: 'Again' },
  { id: 'hard', label: 'Hard' },
  { id: 'good', label: 'Good' },
  { id: 'easy', label: 'Easy' },
];

export const isDue = (card: Pick<Card, 'srs'>, now = Date.now()) => !card.srs || card.srs.due <= now;

/** SM-2 style scheduling. Returns a new SRS state; does not mutate. */
export function schedule(prev: SrsState | undefined, rating: Rating, now = Date.now()): SrsState {
  const s: SrsState = prev ? { ...prev } : { interval: 0, ease: 2.5, reps: 0, due: 0 };
  if (rating === 'again') {
    s.reps = 0;
    s.interval = 0;
    s.ease = Math.max(1.3, s.ease - 0.2);
    s.due = now + 60_000;
    return s;
  }
  if (rating === 'hard') {
    s.interval = Math.max(1, Math.round((s.interval || 1) * 1.2));
    s.ease = Math.max(1.3, s.ease - 0.15);
  } else if (rating === 'good') {
    s.interval = s.reps === 0 ? 1 : s.reps === 1 ? 3 : Math.round(s.interval * s.ease);
  } else {
    s.interval = s.reps === 0 ? 3 : Math.round(Math.max(1, s.interval) * s.ease * 1.3);
    s.ease += 0.15;
  }
  s.interval = Math.min(365, s.interval);
  s.reps++;
  s.due = now + s.interval * DAY_MS;
  return s;
}

export function previewInterval(prev: SrsState | undefined, rating: Rating) {
  if (rating === 'again') return '1 min';
  const d = schedule(prev, rating).interval;
  return d >= 30 ? `${Math.round(d / 30)} mo` : `${d} day${d === 1 ? '' : 's'}`;
}
