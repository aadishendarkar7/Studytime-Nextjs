'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Icon } from '@/components/ui/icons';
import { deleteLecture, listLectures, saveLecture, type Lecture } from '@/lib/media-db';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import { cn, uid } from '@/lib/utils';
import { SectionLabel } from './composer';

const clock = (s: number) => `${Math.floor(s / 3600) ? `${Math.floor(s / 3600)}:` : ''}${String(Math.floor((s % 3600) / 60)).padStart(Math.floor(s / 3600) ? 2 : 1, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function Saved({ l, onChange }: { l: Lecture; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const audio = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (!open) return;
    const u = URL.createObjectURL(l.blob);
    const t = setTimeout(() => setUrl(u), 0);
    return () => (clearTimeout(t), URL.revokeObjectURL(u));
  }, [open, l.blob]);
  const seek = (t: number) => {
    if (!audio.current) return;
    audio.current.currentTime = t;
    void audio.current.play();
  };
  const ext = l.mime.includes('mp4') ? 'm4a' : l.mime.includes('ogg') ? 'ogg' : 'webm';
  return (
    <li className="py-3">
      <button type="button" onClick={() => setOpen(!open)} className="group flex w-full items-center gap-3 text-left">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-3 text-ink-2"><Icon name={open ? 'down' : 'play'} className="size-4" /></span>
        <span className="min-w-0 flex-1">
          <strong className="block truncate text-[15px] font-medium group-hover:underline">{l.title}</strong>
          <small className="tnum text-[13px] text-muted">{new Date(l.at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · {clock(l.seconds)}{l.course ? ` · ${l.course}` : ''}{l.marks.length ? ` · ${l.marks.length} marks` : ''}</small>
        </span>
      </button>
      {open && (
        <div className="mt-3 ml-12 grid gap-3">
          {url && <audio ref={audio} controls src={url} className="w-full" preload="metadata" />}
          {l.marks.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {l.marks.map((m, i) => <button key={i} type="button" onClick={() => seek(m.t)} className="tnum rounded-md border border-line px-2 py-1 text-[12px] hover:border-ink">{clock(m.t)} · {m.label}</button>)}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {url && <a href={url} download={`${l.title.replace(/[^\w\s-]/g, '').trim() || 'lecture'}.${ext}`}><Button size="sm" variant="secondary"><Icon name="download" className="size-4" /> Download</Button></a>}
            <Button size="sm" variant="ghost" onClick={async () => { const t = prompt('Rename recording', l.title)?.trim(); if (t) { await saveLecture({ ...l, title: t.slice(0, 80) }); onChange(); } }}>Rename</Button>
            <Button size="sm" variant="ghost" className="text-danger" onClick={async () => { if (confirm('Delete this recording?')) { await deleteLecture(l.id); onChange(); } }}>Delete</Button>
          </div>
        </div>
      )}
    </li>
  );
}

/** Record a lecture in the browser, mark important moments, and play it back later. */
export function LectureTool() {
  const courses = useProfile((s) => s.courses);
  const [title, setTitle] = useState('');
  const [course, setCourse] = useState(courses[0] ?? '');
  const [state, setState] = useState<'idle' | 'recording' | 'paused'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [marks, setMarks] = useState<{ t: number; label: string }[]>([]);
  const [list, setList] = useState<Lecture[] | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<number | null>(null);
  const meter = useRef<number | null>(null);
  const secs = useRef(0);

  const reload = useCallback(() => listLectures().then(setList).catch(() => setList([])), []);
  useEffect(() => {
    const t = setTimeout(() => void reload(), 0);
    return () => clearTimeout(t);
  }, [reload]);
  useEffect(() => () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    if (timer.current) clearInterval(timer.current);
    if (meter.current) cancelAnimationFrame(meter.current);
  }, []);

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return toast('This browser cannot record audio.', 'error');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: true } });
      stream.current = s;
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg'].find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
      const r = new MediaRecorder(s, mime ? { mimeType: mime, audioBitsPerSecond: 48_000 } : undefined);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.start(5000);
      rec.current = r;
      secs.current = 0;
      setSeconds(0);
      setMarks([]);
      setState('recording');
      timer.current = window.setInterval(() => {
        if (rec.current?.state === 'recording') setSeconds((secs.current += 1));
      }, 1000);
      const ctx = new AudioContext();
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      ctx.createMediaStreamSource(s).connect(an);
      const data = new Uint8Array(an.fftSize);
      const tick = () => {
        an.getByteTimeDomainData(data);
        let peak = 0;
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
        setLevel(peak / 128);
        meter.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      toast('Microphone access was blocked. Allow it in your browser to record.', 'error');
    }
  };

  const stop = () => {
    const r = rec.current;
    if (!r) return;
    r.onstop = async () => {
      const blob = new Blob(chunks.current, { type: r.mimeType || 'audio/webm' });
      const name = title.trim() || `${course || 'Lecture'} · ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
      try {
        await saveLecture({ id: uid(), title: name.slice(0, 80), course, at: Date.now(), seconds: secs.current, mime: blob.type, blob, marks });
        toast('Recording saved in this browser.');
      } catch {
        toast('Could not save the recording. Your browser may be out of space.', 'error');
      }
      setTitle('');
      void reload();
    };
    r.stop();
    stream.current?.getTracks().forEach((t) => t.stop());
    if (timer.current) clearInterval(timer.current);
    if (meter.current) cancelAnimationFrame(meter.current);
    rec.current = null;
    setState('idle');
    setLevel(0);
  };

  const pause = () => {
    const r = rec.current;
    if (!r) return;
    if (r.state === 'recording') {
      r.pause();
      setState('paused');
    } else {
      r.resume();
      setState('recording');
    }
  };

  return (
    <div className="grid gap-8">
      <div className="rounded-2xl border border-line-strong/50 bg-surface">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
          <input aria-label="Lecture title" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Lecture title, like Week 9: Bayes" className="h-8 min-w-0 flex-1 bg-transparent px-1 text-[15px] font-semibold outline-none placeholder:font-normal placeholder:text-muted" />
          <Input aria-label="Course" list="lecCourses" className="h-8 w-36 text-[13px]" value={course} onChange={(e) => setCourse(e.target.value)} placeholder="Course" />
          <datalist id="lecCourses">{courses.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
        <div className="flex flex-wrap items-center gap-4 px-5 py-6">
          <button type="button" onClick={state === 'idle' ? start : stop} aria-label={state === 'idle' ? 'Start recording' : 'Stop and save'} className={cn('grid size-14 shrink-0 place-items-center rounded-full border-2 transition-colors', state === 'idle' ? 'border-line hover:border-danger' : 'border-danger')}>
            <span className={cn('block bg-danger transition-all', state === 'idle' ? 'size-5 rounded-full' : 'size-4 rounded-[3px]')} />
          </button>
          <div className="min-w-0">
            <p className="tnum text-[28px] leading-8 font-semibold tracking-tight">{clock(seconds)}</p>
            <p className="text-[13px] text-muted">{state === 'idle' ? 'Tap the red button to start' : state === 'paused' ? 'Paused' : 'Recording'}</p>
          </div>
          <div className="flex h-8 items-end gap-[3px]" aria-hidden="true">
            {Array.from({ length: 16 }, (_, i) => <span key={i} className="w-1 rounded-full bg-ink/70 transition-all" style={{ height: `${Math.max(3, Math.min(32, level * 64 * (0.5 + Math.abs(Math.sin(i * 1.7 + seconds)))))}px` }} />)}
          </div>
          {state !== 'idle' && (
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => { const label = `Mark ${marks.length + 1}`; setMarks([...marks, { t: secs.current, label }]); toast(`${label} at ${clock(secs.current)}.`); }}>Mark this moment</Button>
              <Button size="sm" variant="ghost" onClick={pause}>{state === 'paused' ? 'Resume' : 'Pause'}</Button>
            </div>
          )}
        </div>
        {marks.length > 0 && <div className="flex flex-wrap gap-1.5 border-t border-line px-5 py-2.5">{marks.map((m) => <span key={m.label} className="tnum rounded-md bg-surface-3 px-2 py-0.5 text-[12px]">{clock(m.t)} · {m.label}</span>)}</div>}
      </div>
      <p className="-mt-6 px-1 text-[13px] text-muted">Recordings stay in this browser and are never uploaded. Ask your instructor before recording a class.</p>
      <section>
        <SectionLabel>Recordings</SectionLabel>
        {list === null ? <p className="text-[13px] text-muted">Loading</p> : list.length ? <ul className="divide-y divide-line">{list.map((l) => <Saved key={l.id} l={l} onChange={reload} />)}</ul> : <p className="text-[14px] text-muted">No recordings yet.</p>}
      </section>
    </div>
  );
}
