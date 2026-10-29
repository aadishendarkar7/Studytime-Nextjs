'use client';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { useExtras } from '@/lib/stores/extras';
import { cn } from '@/lib/utils';
import { changeVolume, soundLabel, startSound, toggleSound, useSoundPlaying } from './controller';
import { SOUNDS } from './engine';
import { GROUPS } from './sounds-panel';

/** The focus sound player in the sidebar: play, pick a sound from a menu, set the volume. */
export function SoundDock({ className }: { className?: string }) {
  const playing = useSoundPlaying((s) => s.playing);
  const { sound, volume, soundWithTimer, update } = useExtras();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => (document.removeEventListener('mousedown', away), document.removeEventListener('keydown', esc));
  }, [open]);

  return (
    <div ref={box} className={cn('relative rounded-lg border border-line bg-surface p-2', className)}>
      {open && (
        <div role="menu" aria-label="Focus sounds" className="absolute bottom-full left-0 z-40 mb-2 max-h-[70dvh] w-64 overflow-y-auto rounded-xl border border-line bg-surface p-2 shadow-lg">
          {GROUPS.map((g) => (
            <div key={g.label} className="mb-1.5">
              <p className="px-2 pt-1 pb-0.5 text-[11px] font-medium text-muted">{g.label}</p>
              {SOUNDS.filter((s) => g.ids.includes(s.id)).map((s) => (
                <button key={s.id} type="button" role="menuitemradio" aria-checked={s.id === sound} title={s.note} onClick={() => (void startSound(s.id), update({ sound: s.id }))} className={cn('flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-surface-3', s.id === sound && 'font-semibold text-accent-ink')}>
                  {s.label}
                  {s.id === sound && <Icon name={playing ? 'sound' : 'check'} className="size-3.5" />}
                </button>
              ))}
            </div>
          ))}
          <label className="flex items-center gap-2 border-t border-line px-2 pt-2 pb-1 text-[12px] text-ink-2">
            <input type="checkbox" className="size-3.5 accent-[var(--accent)]" checked={soundWithTimer} onChange={(e) => update({ soundWithTimer: e.target.checked })} />
            Start with the focus timer
          </label>
        </div>
      )}
      <div className="flex items-center gap-2">
        <button type="button" onClick={toggleSound} aria-label={playing ? `Pause ${soundLabel(sound)}` : `Play ${soundLabel(sound)}`} className={cn('grid size-7 shrink-0 place-items-center rounded-md', playing ? 'bg-accent-fill text-white' : 'bg-surface-3 text-ink hover:bg-line')}>
          <Icon name={playing ? 'pause' : 'play'} className="size-3.5" />
        </button>
        <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} className="flex min-w-0 flex-1 items-center gap-1 rounded-md px-1 py-0.5 text-left leading-tight hover:bg-surface-3">
          <span className="min-w-0 flex-1">
            <strong className="block truncate text-[13px] font-medium">{soundLabel(sound)}</strong>
            <small className="text-[11px] text-muted">{playing ? 'Playing' : 'Focus sound'}</small>
          </span>
          <Icon name="down" className={cn('size-3.5 shrink-0 text-muted transition-transform', open && 'rotate-180')} />
        </button>
      </div>
      <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => changeVolume(Number(e.target.value))} aria-label="Sound volume" className="mt-1.5 h-4 w-full accent-[var(--ink)]" />
    </div>
  );
}
