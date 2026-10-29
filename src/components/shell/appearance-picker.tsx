'use client';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { Segmented } from '@/components/ui/segmented';
import { BACKDROPS, PALETTES, WASHES, type Backdrop } from '@/lib/appearance';
import { useProfile } from '@/lib/stores/profile';
import { changeLook } from '@/lib/color-ripple';
import { cn } from '@/lib/utils';

/** Small CSS previews of each background pattern, drawn in the accent color. */
const PREVIEW: Record<Backdrop, string> = {
  contours: 'url(/backdrop/contours.svg) 0 0 / 160px 160px',
  waves: 'url(/backdrop/waves.svg) 0 0 / 80px 40px',
  grid: 'linear-gradient(#000 1px, transparent 1px) 0 0 / 8px 8px, linear-gradient(90deg, #000 1px, transparent 1px) 0 0 / 8px 8px',
  dots: 'radial-gradient(circle, #000 1px, transparent 1.4px) 0 0 / 7px 7px',
  diagonal: 'repeating-linear-gradient(45deg, #000 0 1px, transparent 1px 6px)',
  plain: 'none',
};

const SHOWN = ['Cobalt', 'Ocean', 'Harbor', 'Sage', 'Forest', 'Moss', 'Ember', 'Rose', 'Plum', 'Graphite'];

/** Every appearance option, compact: theme, a row of colors, and the background. */
export function AppearanceOptions() {
  const p = useProfile();
  const palettes = PALETTES.filter((x) => SHOWN.includes(x.name));
  const active = PALETTES.find((x) => x.accent === p.accent && x.glow === p.glow);
  return (
    <div className="grid gap-3.5">
      <Segmented className="[&>button]:flex-1" wrap={false} label="Theme" value={p.theme} onChange={(theme) => changeLook({ theme })} options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'system', label: 'Auto' }]} />
      <div>
        <p className="mb-2 text-[12px] text-muted">Color{active ? <span className="text-ink"> · {active.name}</span> : <span className="text-ink"> · Your own</span>}</p>
        <div role="radiogroup" aria-label="Color" className="flex flex-wrap items-center gap-2">
          {palettes.map((x) => (
            <button key={x.name} type="button" role="radio" aria-checked={active?.name === x.name} aria-label={x.name} title={x.name} onClick={(e) => changeLook({ accent: x.accent, glow: x.glow }, e)} className={cn('size-7 rounded-full transition-transform hover:scale-110', active?.name === x.name && 'ring-2 ring-offset-2 ring-offset-surface')} style={{ background: `linear-gradient(135deg, ${x.accent} 50%, ${x.glow} 50%)`, ['--tw-ring-color' as string]: x.accent }} />
          ))}
          <label title="Pick your own" className={cn('relative grid size-7 cursor-pointer place-items-center rounded-full border border-dashed border-line-strong text-muted hover:text-ink', !active && 'ring-2 ring-accent ring-offset-2 ring-offset-surface')}>
            <Icon name="plus" className="size-3.5" />
            <input type="color" aria-label="Pick your own color" value={p.accent} onChange={(e) => p.update({ accent: e.target.value, glow: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" />
          </label>
          <button type="button" aria-label="Surprise me" title="Surprise me" onClick={(e) => { const pick = palettes.filter((x) => x.name !== active?.name); const x = pick[Math.floor(Math.random() * pick.length)]; changeLook({ accent: x.accent, glow: x.glow }, e); }} className="grid size-7 place-items-center rounded-full text-muted hover:bg-surface-3 hover:text-ink">
            <Icon name="sparkle" className="size-4" />
          </button>
        </div>
      </div>
      <div>
        <p className="mb-2 text-[12px] text-muted">Background</p>
        <div role="radiogroup" aria-label="Background pattern" className="grid grid-cols-6 gap-1.5">
          {BACKDROPS.map((b) => (
            <button key={b.value} type="button" role="radio" aria-checked={p.backdrop === b.value} aria-label={b.label} title={b.label} onClick={() => p.update({ backdrop: b.value })} className={cn('relative h-8 overflow-hidden rounded-md border bg-surface-2', p.backdrop === b.value ? 'border-accent ring-1 ring-accent' : 'border-line hover:border-line-strong')}>
              {b.value !== 'plain' && <span className="absolute inset-0 bg-accent opacity-60" style={{ WebkitMask: PREVIEW[b.value], mask: PREVIEW[b.value] }} />}
            </button>
          ))}
        </div>
        <Segmented className="mt-2 [&>button]:flex-1" wrap={false} label="Glow" value={p.wash} onChange={(wash) => changeLook({ wash })} options={WASHES.map((w) => (w.value === 'none' ? { ...w, label: 'No glow' } : w))} />
      </div>
    </div>
  );
}

/** Top bar buttons: a one-tap light/dark switch and the appearance panel. */
export function AppearanceButtons() {
  const theme = useProfile((s) => s.theme);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => (document.removeEventListener('mousedown', onDown), document.removeEventListener('keydown', onKey));
  }, [open]);
  const isDark = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  return (
    <div ref={box} className="relative flex items-center gap-1.5">
      <button type="button" onClick={(e) => changeLook({ theme: isDark ? 'light' : 'dark' }, e)} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'} title={theme === 'system' ? 'Following your device' : undefined} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-3 hover:text-ink">
        <Icon name={isDark ? 'sun' : 'moon'} className="size-[18px]" />
      </button>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Appearance" className={cn("grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-3 hover:text-ink", open && "bg-surface-3 text-ink")}>
        <Icon name="palette" className="size-[18px]" />
      </button>
      {open && (
        <div role="dialog" aria-label="Appearance" className="absolute top-11 right-0 z-50 w-[min(320px,calc(100vw-32px))] rounded-xl border border-line bg-surface p-4 shadow-lg">
          <AppearanceOptions />
        </div>
      )}
    </div>
  );
}
