'use client';
import { Card, CardHeader, PageHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox, Note } from '@/components/ui/field';
import { Icon } from '@/components/ui/icons';
import { useExtras } from '@/lib/stores/extras';
import { cn } from '@/lib/utils';
import { changeVolume, pauseSound, startSound, toggleSound, useSoundPlaying } from './controller';
import { SOUNDS } from './engine';

/** A few bars that show the selected sound's character. Static, not an animation. */
function Swatch({ id }: { id: string }) {
  const shapes: Record<string, number[]> = {
    rain: [5, 9, 6, 10, 7, 9, 5, 8, 10, 6, 9, 7],
    ocean: [3, 5, 8, 10, 8, 5, 3, 4, 7, 9, 7, 4],
    stream: [6, 8, 5, 9, 6, 8, 7, 9, 5, 8, 6, 9],
    fire: [4, 4, 5, 10, 4, 5, 4, 8, 4, 5, 9, 4],
    balanced: [8, 7, 7, 6, 6, 6, 5, 5, 5, 4, 4, 4],
    bright: [5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10],
    dark: [10, 9, 8, 6, 5, 4, 3, 3, 2, 2, 2, 2],
  };
  return (
    <span className="flex h-10 items-end gap-[3px]" aria-hidden="true">
      {shapes[id].map((h, i) => <span key={i} className="w-1 rounded-full bg-current opacity-70" style={{ height: `${h * 10}%` }} />)}
    </span>
  );
}

export function SoundsPage() {
  const { sound, volume, soundWithTimer, update } = useExtras();
  const playing = useSoundPlaying((s) => s.playing);
  const current = SOUNDS.find((s) => s.id === sound)!;
  return (
    <>
      <PageHeader title="Focus sounds" description="Steady background sound makes conversations and sudden noises less noticeable. It changes what you hear, not how smart you are, so try a few and keep the one that helps." />
      <div className="grid gap-5 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <CardHeader title="Choose a sound" />
          <div role="radiogroup" aria-label="Sound" className="grid gap-2 sm:grid-cols-2">
            {SOUNDS.map((s) => {
              const on = s.id === sound;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => (playing || on ? startSound(s.id) : update({ sound: s.id }))}
                  className={cn('flex items-center gap-4 rounded-xl border p-4 text-left transition-colors', on ? 'border-accent bg-accent-soft' : 'border-line hover:bg-surface-3')}
                >
                  <span className={on ? 'text-accent-ink' : 'text-muted'}><Swatch id={s.id} /></span>
                  <span className="min-w-0">
                    <strong className={cn('block text-[16px] font-semibold', on && 'text-accent-ink')}>{s.label}</strong>
                    <span className="block text-[14px] leading-5 text-muted">{s.note}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="lg:col-span-4">
          <CardHeader title={current.label} description={playing ? 'Playing now. It keeps going when you switch pages.' : 'Press play to start.'} />
          <Button size="lg" block onClick={toggleSound}><Icon name={playing ? 'pause' : 'play'} className="size-4" /> {playing ? 'Pause' : 'Play'}</Button>
          <label htmlFor="soundVolume" className="mt-6 mb-1.5 flex justify-between text-[14px] font-semibold">Volume <span className="tnum font-normal text-muted">{Math.round(volume * 100)}%</span></label>
          <input id="soundVolume" type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => changeVolume(Number(e.target.value))} className="h-6 w-full accent-[var(--accent)]" />
          <Checkbox label="Play with the focus timer" checked={soundWithTimer} onChange={(e) => update({ soundWithTimer: e.target.checked })} />
          <Note className="mt-1">Starts this sound when a focus session starts and stops it when the session pauses or ends.</Note>
          {playing && <Button variant="ghost" size="sm" className="mt-3" onClick={pauseSound}>Stop</Button>}
          <Note>Keep the volume at a comfortable, low level, especially with headphones. Sounds are generated in your browser, so they work offline and use no data.</Note>
        </Card>
      </div>
    </>
  );
}
