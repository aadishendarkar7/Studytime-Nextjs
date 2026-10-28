'use client';
import { Button } from '@/components/ui/button';
import { useExtras } from '@/lib/stores/extras';
import { toast } from '@/lib/stores/ui';
import { cn, todayKey } from '@/lib/utils';

function Glass({ full }: { full: boolean }) {
  return (
    <svg viewBox="0 0 24 30" className="h-8 w-6" aria-hidden="true">
      <path d="M3 2h18l-2.2 25a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      {full && <path d="M4.2 10h15.6l-1.6 17a1 1 0 0 1-1 .9H6.8a1 1 0 0 1-1-.9z" fill="currentColor" opacity="0.85" />}
    </svg>
  );
}

export function logWater(delta = 1) {
  const x = useExtras.getState();
  const day = todayKey();
  const n = Math.max(0, (x.water[day] ?? 0) + delta);
  // Keep the last 60 days only.
  const keep = Object.fromEntries(Object.entries({ ...x.water, [day]: n }).sort(([a], [b]) => b.localeCompare(a)).slice(0, 60));
  x.update({ water: keep, lastWaterAt: delta > 0 ? Date.now() : x.lastWaterAt });
  if (delta > 0 && n === x.waterGoal) toast('Water goal reached for today.');
}

/** Tap a glass to log it. */
export function WaterTracker({ className }: { className?: string }) {
  const { water, waterGoal } = useExtras();
  const n = water[todayKey()] ?? 0;
  return (
    <div className={className}>
      <div className="flex flex-wrap gap-1 text-accent" role="group" aria-label={`Water today: ${n} of ${waterGoal} glasses`}>
        {Array.from({ length: Math.max(waterGoal, n) }, (_, i) => (
          <button key={i} type="button" aria-label={i < n ? `Remove glass ${i + 1}` : `Log glass ${i + 1}`} onClick={() => logWater(i < n ? -1 : 1)} className={cn('rounded-md p-0.5 hover:bg-surface-3', i >= n && 'text-line-strong')}>
            <Glass full={i < n} />
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-3">
        <Button size="sm" variant="secondary" onClick={() => logWater(1)}>+ 1 glass</Button>
        <span className="tnum text-[14px] text-muted">{n} of {waterGoal} today</span>
      </div>
    </div>
  );
}
