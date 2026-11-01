'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Icon, type IconName } from '@/components/ui/icons';
import { deleteLecture, listLectures, saveLecture, type Lecture } from '@/lib/media-db';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import { AiError } from '@/lib/ai/client';
import { useAi } from '@/lib/stores/ai';
import { useLearning } from '@/lib/stores/learning';
import { cn, uid } from '@/lib/utils';
import { clock, LecturePlayer } from './lecture-player';
import { lectureNotes } from './lecture-notes';
import { generateCards } from './tasks';

/** One study action under a lecture: icon, what it does, and a short line about it. */
export function ActionTile({ icon, label, sub, onClick, busy, disabled, primary }: { icon: IconName; label: string; sub: string; onClick: () => void; busy?: boolean; disabled?: boolean; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className={cn(
        'group flex min-w-0 items-center gap-3 rounded-[8px] border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-55',
        primary ? 'border-transparent bg-accent-fill text-white hover:brightness-105' : 'border-line bg-surface hover:border-line-strong',
      )}
    >
      <span className={cn('grid size-8 shrink-0 place-items-center rounded-md transition-transform group-hover:-translate-y-px', primary ? 'bg-white/15' : 'bg-surface-3 text-ink-2')}>
        <Icon name={icon} className={cn('size-4', busy && 'animate-pulse')} />
      </span>
      <span className="min-w-0">
        <strong className="block truncate text-[14px] font-semibold">{label}</strong>
        <span className={cn('block truncate text-[12px]', primary ? 'text-white/80' : 'text-muted')}>{sub}</span>
      </span>
    </button>
  );
}

/** A saved lecture: play it, jump between marks, and turn it into notes, flashcards or a quiz. */
export function RecordingRow({ l, onChange, onOpenNote, index = 0 }: { l: Lecture; onChange: () => void; onOpenNote: (id: string, then?: 'quiz') => void; index?: number }) {
  const ai = useAi();
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState('');
  const [cards, setCards] = useState(false);
  const [naming, setNaming] = useState(false);
  const notes = ai.notes.find((n) => n.title === `${l.title}: notes`);
  const transcript = ai.notes.find((n) => n.title === `${l.title}: transcript`);
  const folders = [...new Set([...ai.noteFolders, ...(l.course ? [l.course] : [])])];

  const save = async (patch: Partial<Lecture>) => {
    await saveLecture({ ...l, ...patch });
    onChange();
  };
  const makeNotes = async () => {
    try {
      const r = await lectureNotes(l, setProgress);
      const store = useAi.getState();
      const folder = l.course && store.noteFolders.includes(l.course) ? l.course : 'General';
      const note = store.saveNote({ title: `${l.title}: notes`, folder, kind: 'notes', content: r.notes });
      store.saveNote({ title: `${l.title}: transcript`, folder, kind: 'notes', content: r.transcript });
      toast('Notes are ready.');
      onOpenNote(note.id);
    } catch (e) {
      toast(e instanceof AiError && e.needsSetup ? e.message : `Could not make notes: ${(e as Error).message}`, 'error');
    } finally {
      setProgress('');
    }
  };
  const flashcards = async () => {
    if (!notes) return;
    setCards(true);
    try {
      const set = useLearning.getState().addSet(l.title, await generateCards(notes.content, 20), l.course || undefined);
      toast(`${set.cards.length} flashcards added to Flashcards.`);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setCards(false);
    }
  };
  const rename = async (title: string) => {
    setNaming(false);
    const t = title.trim().slice(0, 80);
    if (!t || t === l.title) return;
    // Keep the notes made from this lecture linked to it.
    if (notes) ai.updateNote(notes.id, { title: `${t}: notes` });
    if (transcript) ai.updateNote(transcript.id, { title: `${t}: transcript` });
    await save({ title: t });
  };
  const ext = l.mime.includes('mp4') ? 'm4a' : l.mime.includes('ogg') ? 'ogg' : 'webm';
  const download = () => {
    const u = URL.createObjectURL(l.blob);
    const a = Object.assign(document.createElement('a'), { href: u, download: `${l.title.replace(/[^\w\s-]/g, '').trim() || 'lecture'}.${ext}` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
  };

  return (
    <li className="st-rise @container" style={{ '--i': index } as React.CSSProperties}>
      <div className={cn('rounded-[10px] border bg-surface transition-colors', open ? 'border-line-strong' : 'border-line hover:border-line-strong')}>
        <div className="flex items-center gap-3 p-3">
          <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? 'Close lecture' : 'Open lecture'} className="grid size-11 shrink-0 place-items-center rounded-[8px] bg-danger-soft text-danger transition-transform active:scale-95">
            <Icon name={open ? 'down' : 'mic'} className="size-[18px]" />
          </button>
          <div className="min-w-0 flex-1">
            {naming ? (
              <input autoFocus defaultValue={l.title} maxLength={80} aria-label="Lecture name" onBlur={(e) => void rename(e.target.value)} onKeyDown={(e) => (e.key === 'Enter' ? e.currentTarget.blur() : e.key === 'Escape' && setNaming(false))} className="h-7 w-full rounded border border-line bg-surface px-2 text-[15px] font-semibold outline-none focus:border-ink" />
            ) : (
              <button type="button" onClick={() => setOpen(!open)} onDoubleClick={() => setNaming(true)} className="block max-w-full truncate text-left text-[15px] font-semibold hover:underline">{l.title}</button>
            )}
            <p className="tnum mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
              <span>{new Date(l.at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
              <span>{clock(l.seconds)}</span>
              {l.course && <span>{l.course}</span>}
              {l.marks.length > 0 && <span className="inline-flex items-center gap-1"><Icon name="flag" className="size-3" />{l.marks.length}</span>}
              {notes && <span className="inline-flex items-center gap-1 font-medium text-accent-ink"><Icon name="check" className="size-3" />Notes made</span>}
            </p>
          </div>
          {!open && <Button size="sm" variant="secondary" className="max-sm:hidden" onClick={() => setOpen(true)}><Icon name="play" className="size-3.5" />Play</Button>}
        </div>

        <div className="st-open" data-open={open}>
          <div>
            {open && (
              <div className="grid gap-4 border-t border-line p-3 pt-4">
                <LecturePlayer lecture={l} onMarks={(marks) => void save({ marks })} />
                <div>
                  <p className="mb-2 text-[12px] font-semibold text-muted">Study this lecture</p>
                  <div className="grid gap-2 @lg:grid-cols-2 @4xl:grid-cols-4">
                    {notes
                      ? <ActionTile primary icon="file" label="Open notes" sub="Organized from the audio" onClick={() => onOpenNote(notes.id)} />
                      : <ActionTile primary icon="sparkle" label={progress || 'Make notes'} sub="Transcribe and organize" busy={Boolean(progress)} onClick={() => void makeNotes()} />}
                    <ActionTile icon="book" label="Transcript" sub={transcript ? 'Every word, searchable' : 'Comes with the notes'} disabled={!transcript} onClick={() => transcript && onOpenNote(transcript.id)} />
                    <ActionTile icon="games" label={cards ? 'Making cards' : 'Flashcards'} sub={notes ? '20 cards from the notes' : 'Make notes first'} busy={cards} disabled={!notes} onClick={() => void flashcards()} />
                    <ActionTile icon="quiz" label="Quiz me" sub={notes ? 'A practice test' : 'Make notes first'} disabled={!notes} onClick={() => notes && onOpenNote(notes.id, 'quiz')} />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1 border-t border-line pt-3 text-[13px]">
                  <button type="button" onClick={() => setNaming(true)} className="flex h-8 items-center gap-1.5 rounded-md px-2.5 font-medium text-ink-2 hover:bg-surface-3 hover:text-ink"><Icon name="pen" className="size-3.5" />Rename</button>
                  <button type="button" onClick={download} className="flex h-8 items-center gap-1.5 rounded-md px-2.5 font-medium text-ink-2 hover:bg-surface-3 hover:text-ink"><Icon name="download" className="size-3.5" />Download</button>
                  <label className="flex h-8 items-center gap-1.5 rounded-md px-2.5 font-medium text-ink-2 hover:bg-surface-3">
                    <Icon name="layers" className="size-3.5" />
                    <select aria-label="Folder" value={l.course || ''} onChange={(e) => void save({ course: e.target.value })} className="cursor-pointer bg-transparent outline-none">
                      <option value="">No folder</option>
                      {folders.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </label>
                  <button type="button" onClick={async () => { if (confirm('Delete this recording? Notes made from it stay.')) { await deleteLecture(l.id); onChange(); } }} className="ml-auto flex h-8 items-center gap-1.5 rounded-md px-2.5 font-medium text-danger hover:bg-danger-soft"><Icon name="trash" className="size-3.5" />Delete</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

/** Record a lecture in the browser and mark important moments. Saved recordings show up in Notes. */
export function Recorder({ onSaved }: { onSaved: () => void }) {
  const courses = useProfile((s) => s.courses);
  const [title, setTitle] = useState('');
  const [course, setCourse] = useState(courses[0] ?? '');
  const [state, setState] = useState<'idle' | 'recording' | 'paused'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const [marks, setMarks] = useState<{ t: number; label: string }[]>([]);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<number | null>(null);
  const meter = useRef<number | null>(null);
  const secs = useRef(0);

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
      setLevels([]);
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
        const v = peak / 128;
        if (rec.current?.state === 'recording') setLevels((l) => [...l.slice(-59), v]);
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
      const name = title.trim() || `${course || 'Lecture'}, ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
      try {
        await saveLecture({ id: uid(), title: name.slice(0, 80), course, at: Date.now(), seconds: secs.current, mime: blob.type, blob, marks });
        toast('Recording saved in this browser.');
      } catch {
        toast('Could not save the recording. Your browser may be out of space.', 'error');
      }
      setTitle('');
      onSaved();
    };
    r.stop();
    stream.current?.getTracks().forEach((t) => t.stop());
    if (timer.current) clearInterval(timer.current);
    if (meter.current) cancelAnimationFrame(meter.current);
    rec.current = null;
    setState('idle');
    setLevels([]);
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
    <div data-recorder={state} className="rounded-xl border border-line-strong/50 bg-surface">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <input aria-label="Lecture title" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Lecture title" className="h-8 min-w-0 flex-1 bg-transparent px-1 text-[15px] font-semibold outline-none placeholder:font-normal placeholder:text-muted" />
        <Input aria-label="Course" list="lecCourses" className="h-8 w-36 text-[13px]" value={course} onChange={(e) => setCourse(e.target.value)} placeholder="Course" />
        <datalist id="lecCourses">{courses.map((c) => <option key={c} value={c} />)}</datalist>
      </div>
      <div className="flex flex-wrap items-center gap-4 px-4 py-4">
        <button type="button" onClick={state === 'idle' ? start : stop} aria-label={state === 'idle' ? 'Start recording' : 'Stop and save'} className={cn('grid size-14 shrink-0 place-items-center rounded-full border-2 transition-colors', state === 'idle' ? 'border-line hover:border-danger' : 'border-danger')}>
          <span className={cn('block bg-danger transition-all', state === 'idle' ? 'size-5 rounded-full' : 'size-4 rounded-[3px]')} />
        </button>
        <div className="min-w-0">
          <p className="tnum text-[26px] leading-8 font-semibold tracking-tight">{clock(seconds)}</p>
          <p className="flex items-center gap-1.5 text-[13px] text-muted">{state === 'recording' && <span className="size-2 animate-pulse rounded-full bg-danger" />}{state === 'idle' ? 'Tap to record' : state === 'paused' ? 'Paused' : 'Recording'}</p>
        </div>
        <div className="flex h-10 min-w-0 flex-1 items-center gap-[2px] overflow-hidden" aria-hidden="true">
          {Array.from({ length: 60 }, (_, i) => {
            const v = levels[levels.length - 60 + i];
            return <span key={i} className={cn('w-[3px] shrink-0 rounded-full transition-[height] duration-75', v === undefined ? 'bg-ink/10' : state === 'paused' ? 'bg-ink/30' : 'bg-danger')} style={{ height: `${v === undefined ? 3 : Math.max(3, Math.min(40, v * 70))}px` }} />;
          })}
        </div>
        {state !== 'idle' && (
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => { const label = `Mark ${marks.length + 1}`; setMarks([...marks, { t: secs.current, label }]); toast(`${label} at ${clock(secs.current)}.`); }}>Mark</Button>
            <Button size="sm" variant="ghost" onClick={pause}>{state === 'paused' ? 'Resume' : 'Pause'}</Button>
          </div>
        )}
      </div>
      {marks.length > 0 && <div className="flex flex-wrap gap-1.5 border-t border-line px-4 py-2.5">{marks.map((m) => <span key={m.label} className="tnum rounded-md bg-surface-3 px-2 py-0.5 text-[12px]">{clock(m.t)}, {m.label}</span>)}</div>}
      <p className="border-t border-line px-4 py-2 text-[12px] text-muted">Stays in this browser. Ask your instructor before recording.</p>
    </div>
  );
}

export { listLectures };
