'use client';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/field';
import { Icon } from '@/components/ui/icons';
import { useExtras } from '@/lib/stores/extras';
import { cn } from '@/lib/utils';
import { changeVolume, startSound, toggleSound, useSoundPlaying } from './controller';
import { SOUNDS, type SoundId } from './engine';

const GROUPS: { label: string; ids: SoundId[] }[] = [
  { label: 'Study music', ids: ['lofi', 'ambient'] },
  { label: 'Noise', ids: ['bright', 'balanced', 'dark'] },
  { label: 'Nature', ids: ['rain', 'ocean', 'stream', 'fire'] },
];

/** Focus sounds as one compact card: pick, play, volume. */
export function SoundsPanel({ className }: { className?: string }) {
  const { sound, volume, soundWithTimer, update } = useExtras();
  const playing = useSoundPlaying((s) => s.playing);
  const current = SOUNDS.find((s) => s.id === sound)!;
  return (
    <Card id="sounds" className={className}>
      <CardHeader title="Focus sounds" description="Study music without words, or steady noise that covers voices around you." action={<Button size="sm" onClick={toggleSound}><Icon name={playing ? 'pause' : 'play'} className="size-4" /> {playing ? 'Pause' : 'Play'}</Button>} />
      <div role="radiogroup" aria-label="Sound" className="grid gap-3">
        {GROUPS.map((g) => (
          <div key={g.label}>
            <p className="mb-1.5 text-[12px] font-medium text-muted">{g.label}</p>
            <div className="flex flex-wrap gap-1.5">
              {SOUNDS.filter((s) => g.ids.includes(s.id)).map((s) => (
                <button key={s.id} type="button" role="radio" aria-checked={s.id === sound} title={s.note} onClick={() => (playing ? startSound(s.id) : update({ sound: s.id }))} className={cn('rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors', s.id === sound ? 'border-accent-fill bg-accent-fill text-white' : 'border-line hover:bg-surface-2')}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[13px] text-muted">{current.note}</p>
      <label htmlFor="focusVolume" className="mt-4 mb-1 flex justify-between text-[13px] font-semibold">Volume <span className="tnum font-normal text-muted">{Math.round(volume * 100)}%</span></label>
      <input id="focusVolume" type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => changeVolume(Number(e.target.value))} className="h-6 w-full accent-[var(--ink)]" />
      <Checkbox label="Play with the focus timer" checked={soundWithTimer} onChange={(e) => update({ soundWithTimer: e.target.checked })} />
    </Card>
  );
}
