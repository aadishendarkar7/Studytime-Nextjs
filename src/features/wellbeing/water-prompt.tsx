'use client';
import { useEffect } from 'react';
import { sendBrowserAlert } from '@/components/shell/global-effects';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { isPastWindDown } from '@/features/calendar/sync';
import { useExtras } from '@/lib/stores/extras';
import { useUi } from '@/lib/stores/ui';
import { todayKey } from '@/lib/utils';
import { logWater } from './water';

let lastPrompt = 0;
const openedAt = Date.now();

/** A small glass that fills up when the card appears. */
function FillingGlass() {
  return (
    <svg viewBox="0 0 40 52" className="h-12 w-10 shrink-0 text-accent" aria-hidden="true">
      <defs>
        <clipPath id="glass-inside"><path d="M7 6h26l-3.4 39a3 3 0 0 1-3 2.7H13.4a3 3 0 0 1-3-2.7z" /></clipPath>
      </defs>
      <g clipPath="url(#glass-inside)">
        <g className="water-rise">
          <path className="water-wave" d="M-20 22 q5 -3 10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 V60 H-20 z" fill="currentColor" opacity="0.85" />
        </g>
      </g>
      <path d="M5 4h30l-3.6 41.2a4 4 0 0 1-4 3.6H12.6a4 4 0 0 1-4-3.6z" fill="none" stroke="var(--ink)" strokeOpacity="0.55" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

/** The reminder card, plus the timer that decides when it appears. */
export function WaterPrompt() {
  const open = useUi((s) => s.waterPrompt);
  const every = useExtras((s) => s.waterEvery);
  const glasses = useExtras((s) => s.water[todayKey()] ?? 0);
  const goal = useExtras((s) => s.waterGoal);

  useEffect(() => {
    const check = () => {
      const x = useExtras.getState();
      if (!x.waterRemind || useUi.getState().waterPrompt || isPastWindDown(x.windDown)) return;
      const now = Date.now();
      const since = Math.max(x.lastWaterAt, lastPrompt, openedAt);
      if (now - since < x.waterEvery * 60_000) return;
      lastPrompt = now;
      useUi.setState({ waterPrompt: true });
      if (document.hidden) sendBrowserAlert('Water break', `It has been ${x.waterEvery} minutes. Have a glass of water.`);
    };
    const id = setInterval(check, 20_000);
    return () => clearInterval(id);
  }, []);

  // Close by itself after two minutes if nobody answers.
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => useUi.setState({ waterPrompt: false }), 120_000);
    return () => clearTimeout(id);
  }, [open]);

  if (!open) return null;
  const close = () => useUi.setState({ waterPrompt: false });
  return (
    <div role="alertdialog" aria-labelledby="water-title" aria-describedby="water-body" className="water-pop fixed right-4 bottom-20 z-50 w-[min(340px,calc(100vw-32px))] rounded-xl border border-line bg-surface p-4 shadow-lg lg:right-6 lg:bottom-6">
      <div className="flex gap-3.5">
        <FillingGlass />
        <div className="min-w-0 flex-1">
          <p id="water-title" className="text-[14px] font-semibold">Time for some water</p>
          <p id="water-body" className="mt-0.5 text-[13px] leading-5 text-muted">It has been {every} minutes. A glass now helps you stay focused. {glasses} of {goal} today.</p>
        </div>
        <button type="button" onClick={close} aria-label="Dismiss" className="-mt-1 -mr-1 grid size-7 shrink-0 place-items-center rounded-md text-muted hover:bg-surface-3 hover:text-ink"><Icon name="close" className="size-4" /></button>
      </div>
      <div className="mt-3 flex gap-2 pl-[54px]">
        <Button size="sm" onClick={() => (logWater(1), close())}>I drank a glass</Button>
        <Button size="sm" variant="ghost" onClick={() => ((lastPrompt = Date.now() - (every - 10) * 60_000), close())}>In 10 min</Button>
      </div>
    </div>
  );
}
