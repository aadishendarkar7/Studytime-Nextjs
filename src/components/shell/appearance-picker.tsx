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

function Label({ children }: { children: string }) {
  return <p className="mb-1.5 text-[12px] font-medium text-muted">{children}</p>;
}

/** Every appearance option in one compact panel. */
export function AppearanceOptions() {
  const p = useProfile();
  const [custom, setCustom] = useState(false);
  const active = PALETTES.find((x) => x.accent === p.accent && x.glow === p.glow)?.name;
  return (
    <div className="grid gap-4">
      <div>
        <Label>Theme</Label>
        <Segmented className="[&>button]:flex-1" wrap={false} label="Theme" value={p.theme} onChange={(theme) => changeLook({ theme })} options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'system', label: 'Auto' }]} />
      </div>
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <Label>Colors</Label>
          <button type="button" onClick={(e) => { const pick = PALETTES.filter((x) => x.name !== active); const x = pick[Math.floor(Math.random() * pick.length)]; changeLook({ accent: x.accent, glow: x.glow }, e); }} className="-mt-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] font-medium text-accent-ink hover:bg-accent-soft">
            <Icon name="sparkle" className="size-3.5" /> Surprise me
          </button>
        </div>
        <div role="radiogroup" aria-label="Color" className="grid grid-cols-3 gap-1.5">
          {PALETTES.map((x) => (
            <button key={x.name} type="button" role="radio" aria-checked={active === x.name} onClick={(e) => changeLook({ accent: x.accent, glow: x.glow }, e)} className={cn('group relative overflow-hidden rounded-lg border p-2 text-left transition-all hover:-translate-y-0.5', active === x.name ? 'border-transparent ring-2 ring-[var(--ring)]' : 'border-line hover:border-line-strong/60')} style={{ ['--ring' as string]: x.accent }}>
              <span className="absolute inset-x-0 top-0 h-7 opacity-90" style={{ background: `linear-gradient(120deg, ${x.accent}, ${x.glow})` }} />
              <span className="relative mt-6 block truncate text-[12px] font-semibold text-ink">{x.name}</span>
              <span className="relative block truncate text-[11px] text-muted">{x.mood}</span>
            </button>
          ))}
        </div>
        <button type="button" aria-expanded={custom} onClick={() => setCustom(!custom)} className={cn('mt-1.5 inline-flex items-center gap-1 text-[12px] font-medium', !active ? 'text-accent-ink' : 'text-muted hover:text-ink')}>
          <Icon name="plus" className="size-3.5" /> Pick your own
        </button>
        {custom && (
          <div className="mt-2 flex gap-3 text-[13px]">
            <label className="flex items-center gap-2"><input type="color" value={p.accent} onChange={(e) => p.update({ accent: e.target.value })} className="size-7 cursor-pointer rounded border-0 bg-transparent p-0" /> Main</label>
            <label className="flex items-center gap-2"><input type="color" value={p.glow} onChange={(e) => p.update({ glow: e.target.value })} className="size-7 cursor-pointer rounded border-0 bg-transparent p-0" /> Glow</label>
          </div>
        )}
      </div>
      <div>
        <Label>Background</Label>
        <div role="radiogroup" aria-label="Background pattern" className="grid grid-cols-6 gap-1.5">
          {BACKDROPS.map((b) => (
            <button key={b.value} type="button" role="radio" aria-checked={p.backdrop === b.value} aria-label={b.label} title={b.label} onClick={() => p.update({ backdrop: b.value })} className={cn('relative h-9 overflow-hidden rounded-lg border bg-surface-2', p.backdrop === b.value ? 'border-accent ring-1 ring-accent' : 'border-line hover:border-line-strong')}>
              {b.value !== 'plain' && <span className="absolute inset-0 bg-accent opacity-60" style={{ WebkitMask: PREVIEW[b.value], mask: PREVIEW[b.value] }} />}
              {b.value === 'plain' && <span className="absolute inset-0 grid place-items-center text-[10px] text-muted">None</span>}
            </button>
          ))}
        </div>
        <p className="mt-3 mb-1.5 text-[12px] font-medium text-muted">Glow behind pages</p>
        <Segmented className="[&>button]:flex-1" wrap={false} label="Color wash" value={p.wash} onChange={(wash) => changeLook({ wash })} options={WASHES} />
      </div>
      <div className="grid gap-4">
        <div>
          <Label>Headings</Label>
          <Segmented className="[&>button]:flex-1" wrap={false} label="Heading style" value={p.font} onChange={(font) => p.update({ font })} options={[{ value: 'sans', label: 'Sans' }, { value: 'serif', label: 'Serif' }]} />
        </div>
        <div>
          <Label>Corners</Label>
          <Segmented className="[&>button]:flex-1" wrap={false} label="Corner style" value={p.corners} onChange={(corners) => p.update({ corners })} options={[{ value: 'crisp', label: 'Crisp' }, { value: 'soft', label: 'Soft' }, { value: 'round', label: 'Round' }]} />
        </div>
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
