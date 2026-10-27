'use client';
import { useEffect, useState } from 'react';
import { Badge, Card, CardHeader, Empty, PageHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, FieldRow, Input, Select } from '@/components/ui/field';
import { Icon } from '@/components/ui/icons';
import { streaks } from '@/features/focus/logic';
import { LEAD_NAMES, REMINDER_TYPES, ReminderRow, SessionRow } from '@/features/shared';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import type { ReminderType } from '@/lib/types';
import { cn, dateKey, downloadFile, fmtMinutes, localDateTimeValue, todayKey } from '@/lib/utils';
import { minutesOn } from '@/features/focus/logic';
import { SyllabusImport } from './syllabus-import';

function ReminderForm() {
  const addReminder = useProfile((s) => s.addReminder);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<ReminderType>('homework');
  const [due, setDue] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(17, 0, 0, 0);
    return localDateTimeValue(d.getTime());
  });
  const [lead, setLead] = useState(1440);
  return (
    <Card>
      <CardHeader title="What is coming up?" />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const dueAt = new Date(due).getTime();
          if (!title.trim() || !Number.isFinite(dueAt) || dueAt <= Date.now()) return toast('Add a title and a future due date.', 'error');
          addReminder({ title: title.trim().slice(0, 80), type, dueAt, lead });
          setTitle('');
          toast('Reminder added.');
        }}
      >
        <Field label="Title" htmlFor="reminderTitle"><Input id="reminderTitle" maxLength={80} required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Chemistry problem set" /></Field>
        <FieldRow>
          <Field label="Type" htmlFor="reminderType">
            <Select id="reminderType" value={type} onChange={(e) => setType(e.target.value as ReminderType)}>
              {Object.entries(REMINDER_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Due date and time" htmlFor="reminderDue"><Input id="reminderDue" type="datetime-local" required value={due} onChange={(e) => setDue(e.target.value)} /></Field>
        </FieldRow>
        <Field label="Remind me" htmlFor="reminderLead">
          <Select id="reminderLead" value={lead} onChange={(e) => setLead(Number(e.target.value))}>
            {Object.entries(LEAD_NAMES).map(([v, l]) => <option key={v} value={v}>{l[0].toUpperCase() + l.slice(1)}</option>)}
          </Select>
        </Field>
        <Button type="submit" className="mt-5">Add reminder</Button>
      </form>
    </Card>
  );
}

function ReminderList() {
  const { reminders, setReminderDone, deleteReminder } = useProfile();
  const upcoming = reminders.filter((r) => !r.done).sort((a, b) => a.dueAt - b.dueAt);
  const done = reminders.filter((r) => r.done).sort((a, b) => b.dueAt - a.dueAt).slice(0, 10);
  const exportIcs = () => {
    if (!upcoming.length) return toast('No upcoming deadlines to export.');
    const stamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const esc = (s: string) => s.replace(/[,;\\]/g, (c) => `\\${c}`);
    const events = upcoming.flatMap((r) => ['BEGIN:VEVENT', `UID:${r.id}@studytime`, `DTSTAMP:${stamp(Date.now())}`, `DTSTART:${stamp(r.dueAt - 3_600_000)}`, `DTEND:${stamp(r.dueAt)}`, `SUMMARY:${esc(`${REMINDER_TYPES[r.type]}: ${r.title}`)}`, 'BEGIN:VALARM', `TRIGGER:-PT${Math.max(0, r.lead)}M`, 'ACTION:DISPLAY', `DESCRIPTION:${esc(r.title)}`, 'END:VALARM', 'END:VEVENT']);
    downloadFile('Studytime deadlines.ics', ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Studytime//Deadlines//EN', ...events, 'END:VCALENDAR'].join('\r\n'), 'text/calendar');
    toast(`Exported ${upcoming.length} deadlines. Open the file to add them to your calendar.`);
  };
  const actions = (id: string, isDone: boolean) => (
    <span className="flex gap-1">
      <Button size="sm" variant="secondary" onClick={() => setReminderDone(id, !isDone)}>{isDone ? 'Reopen' : 'Done'}</Button>
      <Button size="sm" variant="danger" onClick={() => confirm('Delete this reminder?') && deleteReminder(id)}>Delete</Button>
    </span>
  );
  return (
    <Card className="mt-5">
      <CardHeader title="Reminders" action={<div className="flex items-center gap-3"><Badge>{upcoming.length} upcoming</Badge><Button size="sm" variant="secondary" onClick={exportIcs}><Icon name="download" className="size-4" /> Export to calendar</Button></div>} />
      {upcoming.length || done.length ? (
        <>
          {upcoming.map((r) => <ReminderRow key={r.id} r={r} actions={actions(r.id, false)} />)}
          {done.length > 0 && <div className="mt-5 mb-1 text-[12px] font-semibold text-muted">COMPLETED</div>}
          {done.map((r) => <ReminderRow key={r.id} r={r} actions={actions(r.id, true)} />)}
        </>
      ) : (
        <Empty>Nothing planned yet. Add your first deadline or import a syllabus.</Empty>
      )}
    </Card>
  );
}

function Activity() {
  const { sessions, points } = useProfile();
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const y = month.getFullYear();
  const m = month.getMonth();
  const first = (new Date(y, m, 1).getDay() + 6) % 7;
  const count = new Date(y, m + 1, 0).getDate();
  const now = new Date();
  const { best } = streaks(sessions);
  const total = sessions.reduce((n, s) => n + s.minutes, 0);
  const [showAll, setShowAll] = useState(false);
  return (
    <section id="activity" className="scroll-mt-6">
      <PageHeader level={2} title="Your activity" description="Study minutes by day, and your full session history." />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title={month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            action={
              <div className="flex gap-1">
                <Button size="icon" variant="secondary" aria-label="Previous month" onClick={() => setMonth(new Date(y, m - 1, 1))}>←</Button>
                <Button size="icon" variant="secondary" aria-label="Next month" disabled={y === now.getFullYear() && m === now.getMonth()} onClick={() => setMonth(new Date(y, m + 1, 1))}>→</Button>
              </div>
            }
          />
          <div className="grid grid-cols-7 gap-1.5 text-center text-[12px] font-semibold text-muted">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <span key={d}>{d}</span>)}</div>
          <div className="mt-2 grid grid-cols-7 gap-1.5">
            {Array.from({ length: first }, (_, i) => <span key={`b${i}`} />)}
            {Array.from({ length: count }, (_, i) => {
              const key = dateKey(new Date(y, m, i + 1));
              const n = minutesOn(sessions, key);
              return (
                <span key={key} title={n ? `${n} minutes studied` : 'No study sessions'} className={cn('tnum grid aspect-square place-items-center border text-[13px] font-medium rounded-xl', n ? 'border-accent bg-accent text-bg' : 'border-line text-ink-2', key === todayKey() && 'border-line outline-2 -outline-offset-3 outline-ink')}>
                  {i + 1}
                </span>
              );
            })}
          </div>
        </Card>
        <Card>
          <CardHeader title="Your numbers" />
          {[
            ['Total study time', fmtMinutes(total)],
            ['Sessions completed', String(sessions.length)],
            ['Longest streak', `${best} ${best === 1 ? 'day' : 'days'}`],
            ['Points earned', `${points} pts`],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between border-b border-line py-3.5 text-sm last:border-0"><span className="text-muted">{label}</span><strong>{value}</strong></div>
          ))}
        </Card>
      </div>
      <Card className="mt-5">
        <CardHeader title="Study history" />
        {sessions.length ? (showAll ? sessions : sessions.slice(0, 15)).map((s) => <SessionRow key={s.id} s={s} />) : <Empty>No sessions yet. Your history starts with one focus session.</Empty>}
        {sessions.length > 15 && !showAll && <Button variant="link" className="mt-3" onClick={() => setShowAll(true)}>Show all {sessions.length} sessions</Button>}
      </Card>
    </section>
  );
}

export function PlannerPage() {
  useEffect(() => {
    const id = location.hash.slice(1);
    if (id) setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);
  return (
    <>
      <PageHeader title="Study planner" description="Homework, exams and assignments with reminders. Import them from a syllabus or add them by hand." />
      <SyllabusImport />
      <div className="mt-5"><ReminderForm /></div>
      <ReminderList />
      <Activity />
    </>
  );
}
