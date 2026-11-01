'use client';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/icons';
import type { Lecture } from '@/lib/media-db';
import { cn } from '@/lib/utils';

export const clock = (s: number) => {
  const h = Math.floor(s / 3600);
  return `${h ? `${h}:` : ''}${String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

const BARS = 120;
const RATES = [1, 1.25, 1.5, 2, 0.75];

/** The loudness of the recording in BARS slices, read from the audio itself. */
function usePeaks(blob: Blob) {
  const [peaks, setPeaks] = useState<number[] | null>(null);
  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        const ctx = new AudioContext();
        const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
        void ctx.close();
        const data = buf.getChannelData(0);
        const size = Math.max(1, Math.floor(data.length / BARS));
        const out: number[] = [];
        for (let b = 0; b < BARS; b++) {
          let sum = 0;
          const from = b * size;
          // Root mean square per slice reads closer to how loud it sounds than the single peak.
          for (let i = from; i < Math.min(data.length, from + size); i += 16) sum += data[i] * data[i];
          out.push(Math.sqrt(sum / (size / 16)));
        }
        const max = Math.max(...out, 0.0001);
        if (!stop) setPeaks(out.map((v) => Math.max(0.06, v / max)));
      } catch {
        if (!stop) setPeaks(Array.from({ length: BARS }, () => 0.35));
      }
    })();
    return () => void (stop = true);
  }, [blob]);
  return peaks;
}

/** A lecture player built for studying: waveform you can scrub, marks you can jump to, skip and speed. */
export function LecturePlayer({ lecture, onMarks }: { lecture: Lecture; onMarks: (marks: Lecture['marks']) => void }) {
  const audio = useRef<HTMLAudioElement>(null);
  const wave = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState('');
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(lecture.seconds || 1);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [editing, setEditing] = useState<number | null>(null);
  const [fresh, setFresh] = useState<number | null>(null);
  const peaks = usePeaks(lecture.blob);

  useEffect(() => {
    const u = URL.createObjectURL(lecture.blob);
    const tm = setTimeout(() => setUrl(u), 0);
    return () => (clearTimeout(tm), URL.revokeObjectURL(u));
  }, [lecture.blob]);

  // Smooth progress while playing; timeupdate alone only fires a few times a second.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      if (audio.current) setT(audio.current.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const seek = (s: number) => {
    const a = audio.current;
    if (!a) return;
    const next = Math.max(0, Math.min(dur, s));
    a.currentTime = next;
    setT(next);
  };
  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) void a.play();
    else a.pause();
  };
  const cycleRate = () => {
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
    setRate(next);
    if (audio.current) audio.current.playbackRate = next;
  };
  const addMark = () => {
    const at = Math.round(t);
    const marks = [...lecture.marks, { t: at, label: `Mark ${lecture.marks.length + 1}` }].sort((a, b) => a.t - b.t);
    onMarks(marks);
    setFresh(at);
    setTimeout(() => setFresh(null), 700);
  };
  const fromPointer = (clientX: number) => {
    const r = wave.current?.getBoundingClientRect();
    if (!r) return;
    seek(((clientX - r.left) / r.width) * dur);
  };
  const current = [...lecture.marks].reverse().find((m) => m.t <= t + 0.25);
  const pct = Math.min(1, t / dur);

  return (
    <div
      tabIndex={0}
      aria-label="Lecture player. Space plays or pauses, arrows skip 5 seconds, M adds a mark."
      onKeyDown={(e) => {
        if ((e.target as HTMLElement).tagName === 'INPUT') return;
        const k = e.key.toLowerCase();
        if (k === 'm') return addMark();
        const act = k === ' ' ? toggle : k === 'arrowleft' ? () => seek(t - 5) : k === 'arrowright' ? () => seek(t + 5) : null;
        if (!act) return;
        e.preventDefault();
        act();
      }}
      className="rounded-[10px] border border-line bg-surface-2 p-4 outline-none focus-visible:border-ink max-sm:p-3"
    >
      {url && (
        <audio
          ref={audio}
          src={url}
          preload="metadata"
          onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && e.currentTarget.duration > 0 && setDur(e.currentTarget.duration)}
          onPlay={() => setPlaying(true)}
          onPause={() => (setPlaying(false), audio.current && setT(audio.current.currentTime))}
          onEnded={() => setPlaying(false)}
          onTimeUpdate={(e) => !playing && setT(e.currentTarget.currentTime)}
        />
      )}

      <div className="relative pt-5">
        {lecture.marks.map((m, i) => (
          <button
            key={`${m.t}-${i}`}
            type="button"
            title={`${clock(m.t)}, ${m.label}`}
            onClick={() => (seek(m.t), audio.current?.paused && void audio.current.play())}
            className={cn('absolute top-0 z-10 -translate-x-1/2 text-accent-ink transition-transform hover:scale-125', fresh === m.t && 'st-pop')}
            style={{ left: `${(m.t / dur) * 100}%` }}
          >
            <Icon name="flag" className="size-3.5" />
          </button>
        ))}
        <div
          ref={wave}
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.round(dur)}
          aria-valuenow={Math.round(t)}
          aria-valuetext={clock(t)}
          tabIndex={-1}
          onPointerDown={(e) => (e.currentTarget.setPointerCapture(e.pointerId), fromPointer(e.clientX))}
          onPointerMove={(e) => e.buttons === 1 && fromPointer(e.clientX)}
          className="relative flex h-16 cursor-pointer touch-none items-center gap-[2px] max-sm:h-12"
        >
          {(peaks ?? Array.from({ length: BARS }, () => 0.08)).map((p, i) => (
            <span
              key={i}
              className={cn('min-w-0 flex-1 rounded-full transition-[height,background-color] duration-300', i / BARS < pct ? 'bg-accent-fill' : 'bg-ink/15')}
              style={{ height: `${p * 100}%`, transitionDelay: peaks ? `${Math.min(i, 60) * 4}ms` : '0ms' }}
            />
          ))}
          <span className="pointer-events-none absolute inset-y-0 w-px bg-ink" style={{ left: `${pct * 100}%` }} />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button type="button" onClick={() => seek(t - 15)} aria-label="Back 15 seconds" className="tnum grid h-9 w-11 place-items-center rounded-md text-[12px] font-semibold text-ink-2 hover:bg-surface-3 hover:text-ink">-15</button>
        <button type="button" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'} className="grid size-11 shrink-0 place-items-center rounded-full bg-ink text-bg transition-transform active:scale-95">
          <Icon name={playing ? 'pause' : 'play'} className={cn('size-4', !playing && 'translate-x-[1px]')} />
        </button>
        <button type="button" onClick={() => seek(t + 15)} aria-label="Forward 15 seconds" className="tnum grid h-9 w-11 place-items-center rounded-md text-[12px] font-semibold text-ink-2 hover:bg-surface-3 hover:text-ink">+15</button>
        <p className="tnum ml-1 text-[13px] text-ink-2"><span className="font-semibold text-ink">{clock(t)}</span> / {clock(dur)}</p>
        <span className="ml-auto flex items-center gap-1.5">
          <button type="button" onClick={cycleRate} aria-label="Playback speed" className="tnum h-8 min-w-12 rounded-md border border-line bg-surface px-2 text-[12px] font-semibold hover:border-line-strong">{rate}x</button>
          <button type="button" onClick={addMark} className="flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-[12px] font-semibold hover:border-line-strong"><Icon name="flag" className="size-3.5" /><span className="max-sm:hidden">Mark this</span></button>
        </span>
      </div>

      {lecture.marks.length > 0 && (
        <ul className="mt-3 grid gap-1 border-t border-line pt-3">
          {lecture.marks.map((m, i) => {
            const on = current === m;
            return (
              <li key={`${m.t}-${i}`} className={cn('group flex items-center gap-2 rounded-md px-2 py-1 transition-colors', on ? 'bg-surface' : 'hover:bg-surface')}>
                <button type="button" onClick={() => (seek(m.t), audio.current?.paused && void audio.current.play())} className={cn('tnum w-12 shrink-0 text-left text-[13px] font-semibold', on ? 'text-accent-ink' : 'text-ink-2')}>{clock(m.t)}</button>
                {editing === i ? (
                  <input
                    autoFocus
                    defaultValue={m.label}
                    maxLength={60}
                    aria-label="Mark name"
                    onBlur={(e) => (onMarks(lecture.marks.map((x, j) => (j === i ? { ...x, label: e.target.value.trim() || x.label } : x))), setEditing(null))}
                    onKeyDown={(e) => (e.key === 'Enter' ? e.currentTarget.blur() : e.key === 'Escape' && setEditing(null))}
                    className="h-7 min-w-0 flex-1 rounded border border-line bg-surface px-2 text-[13px] outline-none focus:border-ink"
                  />
                ) : (
                  <button type="button" onClick={() => setEditing(i)} title="Rename mark" className="min-w-0 flex-1 truncate text-left text-[13px]">{m.label}</button>
                )}
                <button type="button" aria-label={`Remove ${m.label}`} onClick={() => onMarks(lecture.marks.filter((_, j) => j !== i))} className="grid size-7 place-items-center rounded text-muted opacity-0 group-hover:opacity-100 hover:text-danger focus:opacity-100 max-sm:opacity-100"><Icon name="close" className="size-3.5" /></button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
