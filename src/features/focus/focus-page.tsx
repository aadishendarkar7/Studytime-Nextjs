'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, Empty, PageHeader } from '@/components/ui/card';
import { Field, Input, Note } from '@/components/ui/field';
import { SessionRow } from '@/features/shared';
import { useExtras } from '@/lib/stores/extras';
import { useProfile } from '@/lib/stores/profile';
import { cn, fmtMinutes, todayKey } from '@/lib/utils';
import { isPastWindDown } from '@/features/calendar/sync';
import { toast } from '@/lib/stores/ui';
import { useDropComposer } from '@/features/drop/composer';
import { Icon } from '@/components/ui/icons';
import { BreakCoach } from './break-coach';
import { BuddyPanel } from './buddy-panel';
import { PactCard } from '@/features/pact/pact-card';
import { awardFor, DURATIONS, MAX_LENGTH, MIN_LENGTH, minutesOn } from './logic';
import { ParkingLot } from './parking-lot';
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
  const chip = (on: boolean) => cn('tnum h-9 rounded-lg border text-[13px] font-medium transition-colors disabled:opacity-50', on ? 'border-accent-fill bg-accent-fill text-white' : 'border-line bg-surface text-ink hover:bg-surface-2');
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

export function FocusPage() {
  const p = useProfile();
  const spots = useExtras((s) => s.spots);
  const windDown = useExtras((s) => s.windDown);
  const lastSession = p.sessions[0];
  const [justFinishedTiny] = useState(() => Boolean(lastSession && lastSession.minutes === 5 && Date.now() - new Date(lastSession.at).getTime() < 10 * 60_000));
  const startOrPause = () => {
    if (t.mode === 'ready' && isPastWindDown(windDown) && !confirm(`It is past your wind-down time (${windDown}). Sleep helps you remember what you studied today. Start anyway?`)) return;
    p.startOrPause();
  };
  const keepGoing = () => {
    p.setDuration(30);
    p.startOrPause();
    toast('Nice. 30 more minutes.');
  };
  const t = p.timer;
  const locked = t.mode !== 'ready';
  const today = p.sessions.filter((s) => s.day === todayKey());
  return (
    <>
      <PageHeader title="Focus" />
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <TimerReadout />
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" onClick={startOrPause}>{t.mode === 'running' ? 'Pause' : t.mode === 'paused' ? 'Resume' : 'Start session'}</Button>
            <Button size="lg" variant="secondary" onClick={p.resetTimer}>Reset</Button>
          </div>
          {t.mode === 'ready' && p.duration !== 5 && <Button variant="link" className="mt-4" onClick={() => p.setDuration(5)}>Hard to start? Try just 5 minutes</Button>}
          {justFinishedTiny && t.mode === 'ready' && (
            <div className="mt-4 rounded-xl bg-accent-soft p-4">
              <p className="text-[15px] font-semibold text-accent-ink">You started. That was the hard part.</p>
              <p className="mt-1 text-[14px] text-ink-2">Want to keep the momentum going?</p>
              <Button size="sm" className="mt-3" onClick={keepGoing}>Keep going for 30 minutes</Button>
            </div>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <Button variant="secondary" size="sm" onClick={() => useDropComposer.getState().show({ minutes: p.duration })}><Icon name="pin" className="size-4" /> Let friends know where I am</Button>
          </div>
          <Note>The timer pauses when you switch away from this tab.</Note>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader title="Session setup" />
          <Field label="Subject" htmlFor="subject">
            <Input id="subject" list="subjectSuggestions" maxLength={60} disabled={locked} value={p.subject} onChange={(e) => p.update({ subject: e.target.value })} placeholder="e.g. Biology, Calculus, History" />
          </Field>
          <datalist id="subjectSuggestions">{subjectSuggestions(p.major, p.courses).map((x) => <option key={x} value={x} />)}</datalist>
          <Field label="Location" hint="optional" htmlFor="location">
            <Input id="location" maxLength={80} disabled={locked} value={p.location} onChange={(e) => p.update({ location: e.target.value })} placeholder="Where you are studying" list="spotNames" />
            <datalist id="spotNames">{spots.map((s) => <option key={s.id} value={s.name} />)}</datalist>
          </Field>
          <Field label="Length">
            <LengthPicker locked={locked} />
          </Field>
        </Card>

        <BuddyPanel className="lg:col-span-7" />
        <PactCard className="lg:col-span-5" />
        <BreakCoach className="lg:col-span-7" />
        <ParkingLot className="lg:col-span-5" />

        <Card className="lg:col-span-12">
          <CardHeader title="Today" description={today.length ? `${today.length} ${today.length === 1 ? 'session' : 'sessions'}, ${fmtMinutes(minutesOn(p.sessions, todayKey()))} of ${fmtMinutes(p.dailyGoal)} goal.` : undefined} />
          {today.length ? today.map((s) => <SessionRow key={s.id} s={s} />) : <Empty>No sessions yet today. Finished sessions are logged here.</Empty>}
        </Card>
      </div>
    </>
  );
}
