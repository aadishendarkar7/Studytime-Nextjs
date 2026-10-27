'use client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, Empty, PageHeader } from '@/components/ui/card';
import { Field, Input, Note } from '@/components/ui/field';
import { SessionRow } from '@/features/shared';
import { useExtras } from '@/lib/stores/extras';
import { useProfile } from '@/lib/stores/profile';
import { cn, fmtMinutes, todayKey } from '@/lib/utils';
import { DURATIONS, minutesOn } from './logic';
import { TimerReadout } from './timer-readout';

const MAJOR_SUGGESTIONS: Record<string, string[]> = { Biology: ['Biology', 'Chemistry', 'Lab'], Business: ['Accounting', 'Economics', 'Marketing'], 'Computer Science': ['Programming', 'Algorithms', 'Mathematics'], Engineering: ['Calculus', 'Physics', 'Design'], Psychology: ['Psychology', 'Statistics', 'Research'], 'Arts & Humanities': ['Writing', 'History', 'Studio'] };
export const subjectSuggestions = (major: string, courses: string[]) => [...new Set([...(MAJOR_SUGGESTIONS[major] ?? []), ...courses])];

export function FocusPage() {
  const p = useProfile();
  const spots = useExtras((s) => s.spots);
  const t = p.timer;
  const locked = t.mode !== 'ready';
  const today = p.sessions.filter((s) => s.day === todayKey());
  return (
    <>
      <PageHeader title="Focus timer" description="Choose a length, name the subject, start. A session only earns points if you finish it." />
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <TimerReadout />
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" onClick={p.startOrPause}>{t.mode === 'running' ? 'Pause' : t.mode === 'paused' ? 'Resume' : 'Start session'}</Button>
            <Button size="lg" variant="secondary" onClick={p.resetTimer}>Reset</Button>
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
            <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Session length">
              {DURATIONS.map((d) => (
                <button key={d} type="button" role="radio" aria-checked={p.duration === d} disabled={locked} onClick={() => p.setDuration(d)} className={cn('tnum h-11 border border-line text-[14px] font-medium transition-colors disabled:opacity-50 rounded-xl', p.duration === d ? 'bg-ink text-white' : 'bg-surface text-ink hover:bg-surface-3')}>
                  {d} min
                </button>
              ))}
            </div>
          </Field>
        </Card>

        <Card className="lg:col-span-12">
          <CardHeader title="Today" description={today.length ? `${today.length} ${today.length === 1 ? 'session' : 'sessions'}, ${fmtMinutes(minutesOn(p.sessions, todayKey()))} of ${fmtMinutes(p.dailyGoal)} goal.` : undefined} />
          {today.length ? today.map((s) => <SessionRow key={s.id} s={s} />) : <Empty>No sessions yet today. Finished sessions are logged here.</Empty>}
        </Card>
      </div>
    </>
  );
}
