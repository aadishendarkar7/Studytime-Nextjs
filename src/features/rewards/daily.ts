import { dateKey } from '@/lib/utils';

/** Points for each day in a row you check in. Day 7 is the big one, then it starts over. */
export const LADDER = [5, 10, 15, 20, 25, 30, 50] as const;

const shift = (day: string, by: number) => {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + by);
  return dateKey(d);
};

/** Days in a row with a collected reward, ending today, or yesterday if today is not collected yet. */
export function rewardStreak(days: string[], today: string) {
  const have = new Set(days);
  let day = have.has(today) ? today : shift(today, -1);
  let n = 0;
  while (have.has(day)) {
    n++;
    day = shift(day, -1);
  }
  return n;
}

/** Where today sits on the 7-day ladder, and what it is worth. */
export function dailyReward(days: string[], today: string) {
  const claimed = days.includes(today);
  const streak = rewardStreak(days, today);
  // Before collecting, today is the next step after the streak; after, it is the last step of it.
  const index = claimed ? (streak - 1) % LADDER.length : streak % LADDER.length;
  return { claimed, streak, index, points: LADDER[index] };
}
