'use client';
import { Eyebrow } from '@/components/ui/card';
import { Ruler } from '@/components/ui/progress';
import { useProfile } from '@/lib/stores/profile';
import { cn, fmtClock } from '@/lib/utils';
import { AWARD } from './logic';

const STATUS = { ready: 'Ready', running: 'Running', paused: 'Paused' } as const;

/** The timer as an instrument readout: tabular digits over a 60-tick ruler. Real timer state only. */
export function TimerReadout({ className }: { className?: string }) {
  const duration = useProfile((s) => s.duration);
  const timer = useProfile((s) => s.timer);
  const total = duration * 60;
  const pct = Math.min(100, Math.max(0, (1 - timer.remaining / total) * 100));
  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-4">
        <Eyebrow className={cn(timer.mode === 'running' && 'text-accent')}>{STATUS[timer.mode]}</Eyebrow>
        <Eyebrow className="tnum">{duration} min session, +{AWARD[duration]} pts</Eyebrow>
      </div>
      <div className="tnum mt-3 text-[96px] leading-[96px] font-medium tracking-[-0.04em] text-ink max-sm:text-[60px] max-sm:leading-[64px]" aria-live="off">
        {fmtClock(timer.remaining)}
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
