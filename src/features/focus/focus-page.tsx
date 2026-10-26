'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, Eyebrow, PageHeader } from '@/components/ui/card';
import { Field, Input, Note } from '@/components/ui/field';
import { Ring } from '@/components/ui/progress';
import { CALMING_THOUGHTS } from '@/features/shared';
import { useProfile } from '@/lib/stores/profile';
import { cn, fmtClock } from '@/lib/utils';
import { AWARD, DURATIONS } from './logic';

const MAJOR_SUGGESTIONS: Record<string, string[]> = { Biology: ['Biology', 'Chemistry', 'Lab'], Business: ['Accounting', 'Economics', 'Marketing'], 'Computer Science': ['Programming', 'Algorithms', 'Mathematics'], Engineering: ['Calculus', 'Physics', 'Design'], Psychology: ['Psychology', 'Statistics', 'Research'], 'Arts & Humanities': ['Writing', 'History', 'Studio'] };
export const subjectSuggestions = (major: string, courses: string[]) => [...new Set([...(MAJOR_SUGGESTIONS[major] ?? []), ...courses])];

export function FocusPage() {
  const p = useProfile();
  const [thought, setThought] = useState(0);
  const t = p.timer;
  const total = p.duration * 60;
  const pct = Math.min(100, Math.max(0, (1 - t.remaining / total) * 100));
  const locked = t.mode !== 'ready';
  return (
    <>
      <PageHeader eyebrow="DEEP WORK STARTS HERE" title="Focus timer" description="Pick your study time, settle in, and make it count." />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className="flex flex-col items-center py-8">
          <div className="flex w-full justify-between text-[11px] font-bold tracking-[0.12em] text-muted">
            <span className="flex items-center gap-2"><i className={cn('size-2 rounded-full', t.mode === 'running' ? 'animate-pulse bg-accent' : 'bg-line-strong')} /> {t.mode === 'running' ? 'FOCUSING NOW' : t.mode === 'paused' ? 'SESSION PAUSED' : 'READY TO FOCUS'}</span>
            <span className="text-accent-ink">+{AWARD[p.duration]} points</span>
          </div>
          <div className="my-8">
            <Ring value={pct} size={300} stroke={16}>
              <div>
                <span className="text-[11px] font-bold tracking-[0.14em] text-muted">FOCUS SESSION</span>
                <strong className="my-2 block font-display text-6xl font-extrabold tabular-nums" aria-live="off">{fmtClock(t.remaining)}</strong>
                <small className="text-sm text-muted">{t.mode === 'running' ? 'Stay with it' : t.mode === 'paused' ? 'Pick up where you left off' : 'Time to get started'}</small>
              </div>
            </Ring>
          </div>
          <div className="flex gap-3">
            <Button size="lg" onClick={p.startOrPause}>{t.mode === 'running' ? 'Pause session' : t.mode === 'paused' ? 'Resume focusing' : 'Start focusing'}</Button>
            <Button size="lg" variant="secondary" onClick={p.resetTimer}>Reset</Button>
          </div>
          <Note>The timer pauses when you switch away from this tab.</Note>
        </Card>
        <div className="grid content-start gap-5">
          <Card>
            <Eyebrow>MAKE IT YOURS</Eyebrow>
            <h2 className="mt-1.5 mb-4 text-lg font-bold">Session setup</h2>
            <Field label="What are you studying?" htmlFor="subject">
              <Input id="subject" list="subjectSuggestions" maxLength={60} disabled={locked} value={p.subject} onChange={(e) => p.update({ subject: e.target.value })} placeholder="e.g. Biology, Calculus, History" />
            </Field>
            <datalist id="subjectSuggestions">{subjectSuggestions(p.major, p.courses).map((x) => <option key={x} value={x} />)}</datalist>
            <Field label="Where on campus are you studying?" htmlFor="location">
              <Input id="location" maxLength={80} disabled={locked} value={p.location} onChange={(e) => p.update({ location: e.target.value })} placeholder="e.g. Main Library" />
            </Field>
            <Field label="Focus duration">
              <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Focus duration">
                {DURATIONS.map((d) => (
                  <button key={d} type="button" role="radio" aria-checked={p.duration === d} disabled={locked} onClick={() => p.setDuration(d)} className={cn('rounded-xl border py-3 font-display text-lg font-bold disabled:opacity-50', p.duration === d ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line-strong bg-surface-2 text-ink-2')}>
                    {d} <small className="text-xs font-medium">min</small>
                  </button>
                ))}
              </div>
            </Field>
            <Note>Finish the full session to earn points.</Note>
          </Card>
          <Card className="bg-accent-soft">
            <Eyebrow>A MOMENT FOR YOU</Eyebrow>
            <h3 className="mt-1.5 font-bold">Take a breath.</h3>
            <p className="mt-2 text-accent-ink">{CALMING_THOUGHTS[thought]}</p>
            <Button variant="link" className="mt-3" onClick={() => setThought((thought + 1) % CALMING_THOUGHTS.length)}>Another thought →</Button>
          </Card>
        </div>
      </div>
    </>
  );
}
