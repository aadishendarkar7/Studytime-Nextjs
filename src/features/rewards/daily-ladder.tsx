'use client';
import Link from 'next/link';
import { Icon } from '@/components/ui/icons';
import { useExtras } from '@/lib/stores/extras';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import { cn, todayKey } from '@/lib/utils';
import { dailyReward, LADDER } from './daily';

/** Collects today's check-in reward once. Returns the points, or 0 if already collected. */
export function collectDailyReward() {
  const x = useExtras.getState();
  const today = todayKey();
  const r = dailyReward(x.rewardDays, today);
  if (r.claimed) return 0;
  x.update({ rewardDays: [today, ...x.rewardDays].slice(0, 400) });
  const p = useProfile.getState();
  p.update({ points: p.points + r.points });
  toast(`Day ${r.index + 1} reward: +${r.points} points`);
  return r.points;
}

/** Seven days of check-in rewards. Each day in a row is worth more. */
export function DailyLadder({ checkInHref, className }: { checkInHref?: string; className?: string }) {
  const days = useExtras((s) => s.rewardDays);
  const r = dailyReward(days, todayKey());
  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold"><Icon name="flame" className="size-4 text-accent" /> {r.streak ? `${r.streak} day${r.streak === 1 ? '' : 's'} in a row` : 'Daily check-in'}</p>
        {!r.claimed && checkInHref && <Link href={checkInHref} className="text-[13px] font-semibold text-accent-ink hover:underline">Check in</Link>}
      </div>
      <ol className="grid grid-cols-7 gap-1.5">
        {LADDER.map((pts, i) => {
          const done = i < r.index || (r.claimed && i === r.index);
          const today = i === r.index;
          return (
            <li key={i} className={cn('well flex flex-col items-center gap-0.5 py-2 text-center', done ? 'well-done' : today && 'well-on', i === 6 && !done && !today && 'border-dashed')}>
              <span className="text-[11px] font-medium">{today && !r.claimed ? 'Today' : `Day ${i + 1}`}</span>
              {done ? <Icon name="check" className="size-4" /> : <span className="tnum text-[14px] font-semibold">+{pts}</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
