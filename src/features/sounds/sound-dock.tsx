'use client';
import Link from 'next/link';
import { Icon } from '@/components/ui/icons';
import { useExtras } from '@/lib/stores/extras';
import { cn } from '@/lib/utils';
import { changeVolume, soundLabel, toggleSound, useSoundPlaying } from './controller';

/** Compact player shown in the sidebar and mobile menu on every page. */
export function SoundDock({ className }: { className?: string }) {
  const playing = useSoundPlaying((s) => s.playing);
  const sound = useExtras((s) => s.sound);
  const volume = useExtras((s) => s.volume);
  return (
    <div className={cn('rounded-lg border border-line bg-surface p-2', className)}>
      <div className="flex items-center gap-2">
        <button type="button" onClick={toggleSound} aria-label={playing ? `Pause ${soundLabel(sound)}` : `Play ${soundLabel(sound)}`} className={cn('grid size-7 shrink-0 place-items-center rounded-md', playing ? 'bg-accent-fill text-white' : 'bg-surface-3 text-ink hover:bg-line')}>
          <Icon name={playing ? 'pause' : 'play'} className="size-3.5" />
        </button>
        <Link href="/focus#sounds" className="min-w-0 flex-1 leading-tight hover:underline">
          <strong className="block truncate text-[13px] font-medium">{soundLabel(sound)}</strong>
          <small className="text-[11px] text-muted">{playing ? 'Playing' : 'Focus sound'}</small>
        </Link>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={volume}
        onChange={(e) => changeVolume(Number(e.target.value))}
        aria-label="Sound volume"
        className="mt-1.5 h-4 w-full accent-[var(--ink)]"
      />
    </div>
  );
}
