'use client';
import { Eyebrow } from '@/components/ui/card';
import { Ruler } from '@/components/ui/progress';
import { useProfile } from '@/lib/stores/profile';
import Counter from '@/components/bits/Counter';
import { cn } from '@/lib/utils';
import { awardFor } from './logic';

const STATUS = { ready: 'Ready', running: 'Focusing', paused: 'Paused' } as const;

/** The timer as an instrument readout: tabular digits over a 60-tick ruler. Real timer state only. */
export function TimerReadout({ className }: { className?: string }) {
  const duration = useProfile((s) => s.duration);
  const timer = useProfile((s) => s.timer);
  const total = duration * 60;
  const pct = Math.min(100, Math.max(0, (1 - timer.remaining / total) * 100));
  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-4">
        <Eyebrow className={cn('flex items-center gap-2', timer.mode === 'running' && 'text-accent-ink')}>
          {timer.mode !== 'ready' && <span className={cn('size-2 rounded-full', timer.mode === 'running' ? 'animate-pulse bg-accent' : 'bg-muted')} aria-hidden="true" />}
          {STATUS[timer.mode]}
        </Eyebrow>
        <Eyebrow className="tnum">{duration} min session, +{awardFor(duration)} pts</Eyebrow>
      </div>
      {/* Digits roll like a flip clock. Screen readers get the plain time. */}
      <div className="mt-3 flex items-baseline text-[112px] leading-none font-medium tracking-[-0.04em] text-ink max-sm:text-[64px]" role="timer" aria-label={`${Math.floor(timer.remaining / 60)} minutes ${timer.remaining % 60} seconds left`}>
        <Counter value={Math.floor(timer.remaining / 60)} minDigits={2} format={{ useGrouping: false }} fontSize="1em" duration={0.55} bounce={0.12} />
        <span className="mx-[0.04em] -translate-y-[0.06em] text-ink/50" aria-hidden="true">:</span>
        <Counter value={timer.remaining % 60} minDigits={2} fontSize="1em" duration={0.55} bounce={0.12} />
      </div>
      <Ruler value={pct} className="mt-5" />
      <div className="tnum mt-1.5 flex justify-between text-[12px] leading-4 text-muted">
        <span>0</span>
        <span>{duration / 2}</span>
        <span>{duration} min</span>
      </div>
    </div>
  );
}
