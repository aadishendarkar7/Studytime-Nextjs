'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';
import { useExtras } from '@/lib/stores/extras';
import { useProfile } from '@/lib/stores/profile';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/stores/ui';
import { useDropComposer } from '@/features/drop/composer';
import { Icon } from '@/components/ui/icons';
import { awardFor, DURATIONS, MAX_LENGTH, MIN_LENGTH } from './logic';
import { TimerReadout } from './timer-readout';

const MAJOR_SUGGESTIONS: Record<string, string[]> = { Biology: ['Biology', 'Chemistry', 'Lab'], Business: ['Accounting', 'Economics', 'Marketing'], 'Computer Science': ['Programming', 'Algorithms', 'Mathematics'], Engineering: ['Calculus', 'Physics', 'Design'], Psychology: ['Psychology', 'Statistics', 'Research'], 'Arts & Humanities': ['Writing', 'History', 'Studio'] };
export const subjectSuggestions = (major: string, courses: string[]) => [...new Set([...(MAJOR_SUGGESTIONS[major] ?? []), ...courses])];

/** Preset lengths plus a custom one, from 1 to 240 minutes. */
function LengthPicker({ locked }: { locked: boolean }) {
  const p = useProfile();
  const preset = (DURATIONS as readonly number[]).includes(p.duration);
  const [custom, setCustom] = useState(!preset);
  const [value, setValue] = useState(String(p.duration));
  const apply = () => {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n) || n < MIN_LENGTH || n > MAX_LENGTH) return toast(`Pick a length from ${MIN_LENGTH} to ${MAX_LENGTH} minutes.`, 'error');
    p.setDuration(n);
    toast(`${n} minute session, ${awardFor(n)} points.`);
  };
  const chip = (on: boolean) => cn('well tnum h-9 text-[13px] font-medium disabled:opacity-50', on && 'well-on');
  return (
    <div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6" role="radiogroup" aria-label="Session length">
        {DURATIONS.map((d) => (
          <button key={d} type="button" role="radio" aria-checked={!custom && p.duration === d} disabled={locked} onClick={() => (setCustom(false), p.setDuration(d))} className={chip(!custom && p.duration === d)}>{d} min</button>
        ))}
        <button type="button" role="radio" aria-checked={custom} disabled={locked} onClick={() => (setCustom(true), setValue(String(p.duration)))} className={chip(custom)}>Custom</button>
      </div>
      {custom && (
        <form className="mt-2 flex items-center gap-2" onSubmit={(e) => (e.preventDefault(), apply())}>
          <Input type="number" inputMode="numeric" min={MIN_LENGTH} max={MAX_LENGTH} step={1} aria-label="Custom length in minutes" className="w-28" disabled={locked} value={value} onChange={(e) => setValue(e.target.value)} />
          <span className="text-[13px] text-muted">minutes</span>
          <Button type="submit" size="sm" variant="secondary" disabled={locked}>Set</Button>
          <span className="tnum ml-auto text-[12px] text-muted">{p.duration} min now</span>
        </form>
      )}
    </div>
  );
}

/** The focus timer with its setup: what you are studying and for how long. Lives on Home. */
export function FocusPanel({ className }: { className?: string }) {
  const p = useProfile();
  const spots = useExtras((s) => s.spots);
  const lastSession = p.sessions[0];
  const [justFinishedTiny] = useState(() => Boolean(lastSession && lastSession.minutes === 5 && Date.now() - new Date(lastSession.at).getTime() < 10 * 60_000));
  const keepGoing = () => {
    p.setDuration(30);
    p.startOrPause();
    toast('Nice. 30 more minutes.');
  };
  const t = p.timer;
  const locked = t.mode !== 'ready';
  return (
    <Card className={cn('relative isolate overflow-hidden', className)}>
      {/* The card's top edge fills as the session runs. */}
      {locked && (
        <div className="absolute inset-x-0 top-0 h-[3px] bg-surface-3" aria-hidden="true">
          <div className="h-full bg-accent-fill transition-[width] duration-1000 ease-linear" style={{ width: `${Math.min(100, (1 - t.remaining / (p.duration * 60)) * 100)}%` }} />
        </div>
      )}
      <TimerReadout />
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button size="lg" onClick={p.startOrPause}>{t.mode === 'running' ? 'Pause' : t.mode === 'paused' ? 'Resume' : 'Start focus'}</Button>
        {locked && <Button size="lg" variant="secondary" onClick={p.resetTimer}>Reset</Button>}
        <Button variant="ghost" onClick={() => useDropComposer.getState().show({ minutes: p.duration })}><Icon name="pin" className="size-4" /> Tell friends where</Button>
      </div>
      {justFinishedTiny && t.mode === 'ready' && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-accent-soft px-4 py-3">
          <p className="flex-1 text-[14px] font-semibold text-accent-ink">You started. That was the hard part.</p>
          <Button size="sm" onClick={keepGoing}>Keep going for 30 minutes</Button>
        </div>
      )}
      <div className="mt-6 grid gap-4 border-t border-line pt-5 sm:grid-cols-2 [&>*]:mt-0">
        <Field label="Studying" htmlFor="subject">
          <Input id="subject" list="subjectSuggestions" maxLength={60} disabled={locked} value={p.subject} onChange={(e) => p.update({ subject: e.target.value })} placeholder="Calculus, Orgo, essay" />
        </Field>
        <Field label="Where" hint="optional" htmlFor="location">
          <Input id="location" maxLength={80} disabled={locked} value={p.location} onChange={(e) => p.update({ location: e.target.value })} placeholder="Library, dorm, cafe" list="spotNames" />
        </Field>
        <datalist id="subjectSuggestions">{subjectSuggestions(p.major, p.courses).map((x) => <option key={x} value={x} />)}</datalist>
        <datalist id="spotNames">{spots.map((s) => <option key={s.id} value={s.name} />)}</datalist>
      </div>
      <Field label="Length"><LengthPicker locked={locked} /></Field>
    </Card>
  );
}
