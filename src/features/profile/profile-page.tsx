'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Card, CardHeader, Empty, PageHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, FieldRow, Input, Note, Select } from '@/components/ui/field';
import { Icon } from '@/components/ui/icons';
import { streaks } from '@/features/focus/logic';
import { MAJORS, YEARS } from '@/lib/constants';
import { PromptsCard, StyleQuizCard } from './style-cards';
import { useExtras } from '@/lib/stores/extras';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import { fmtMinutes, plural } from '@/lib/utils';

function AboutCard() {
  const p = useProfile();
  const [form, setForm] = useState({ name: p.name, school: p.school, major: p.major, year: p.year, daily: p.dailyGoal, weekly: p.weeklyGoal });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  return (
    <Card className="lg:col-span-7">
      <CardHeader title="About you" description="Your school, major and year group you on leaderboards and help study partners find you." />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.name.trim()) return toast('Add your name.', 'error');
          if (form.daily < 15 || form.daily > 720 || form.weekly < 30 || form.weekly > 5040) return toast('Daily goal must be 15 to 720 minutes and weekly goal 30 to 5040.', 'error');
          p.update({ name: form.name.trim().slice(0, 30), school: form.school.trim().slice(0, 80), major: form.major, year: form.year, dailyGoal: form.daily, weeklyGoal: form.weekly });
          toast('Profile saved.');
        }}
      >
        <FieldRow className="mt-0">
          <Field label="Name" htmlFor="pName"><Input id="pName" maxLength={30} required value={form.name} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label="School" htmlFor="pSchool"><Input id="pSchool" maxLength={80} value={form.school} placeholder="Your school name" onChange={(e) => set({ school: e.target.value })} /></Field>
        </FieldRow>
        <FieldRow>
          <Field label="Major" htmlFor="pMajor">
            <Select id="pMajor" value={form.major} onChange={(e) => set({ major: e.target.value })}>
              <option value="">Choose your major</option>
              {MAJORS.map((m) => <option key={m}>{m}</option>)}
            </Select>
          </Field>
          <Field label="Year" htmlFor="pYear">
            <Select id="pYear" value={form.year} onChange={(e) => set({ year: e.target.value })}>
              <option value="">Choose your year</option>
              {YEARS.map((y) => <option key={y.value} value={y.value}>{y.label}</option>)}
            </Select>
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Daily goal" hint="minutes" htmlFor="pDaily"><Input id="pDaily" type="number" min={15} max={720} step={5} value={form.daily} onChange={(e) => set({ daily: Number(e.target.value) })} /></Field>
          <Field label="Weekly goal" hint="minutes" htmlFor="pWeekly"><Input id="pWeekly" type="number" min={30} max={5040} step={5} value={form.weekly} onChange={(e) => set({ weekly: Number(e.target.value) })} /></Field>
        </FieldRow>
        <Button type="submit" className="mt-5">Save profile</Button>
      </form>
    </Card>
  );
}

function CoursesCard() {
  const { courses, addCourse, removeCourse } = useProfile();
  const [course, setCourse] = useState('');
  return (
    <Card className="lg:col-span-5">
      <CardHeader title="Courses" description="Used by the focus timer, drops, syllabus import and study partner search." />
      <form className="flex gap-2" onSubmit={(e) => (e.preventDefault(), addCourse(course), setCourse(''))}>
        <Input aria-label="Course" maxLength={60} value={course} onChange={(e) => setCourse(e.target.value)} placeholder="Course code or name, like MATH240" />
        <Button type="submit" variant="secondary">Add</Button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {courses.length ? courses.map((c, i) => (
          <span key={c} className="flex items-center gap-1 rounded-lg bg-accent-soft py-1 pr-1 pl-3 text-[14px] font-semibold text-accent-ink">
            <Link href={`/class/${encodeURIComponent(c)}`} className="hover:underline" title={`Open the ${c} class page`}>{c}</Link>
            <button type="button" onClick={() => removeCourse(i)} aria-label={`Remove ${c}`} className="grid size-7 place-items-center rounded-md hover:bg-surface"><Icon name="close" className="size-3.5" /></button>
          </span>
        )) : <Note className="mt-0">No courses yet.</Note>}
      </div>
    </Card>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl bg-surface-3 p-4">
      <p className="text-[14px] text-muted">{label}</p>
      <p className="tnum mt-1 font-display text-[28px] leading-8">{value}</p>
      {note && <p className="mt-1 text-[13px] text-muted">{note}</p>}
    </div>
  );
}

export function StatsCard() {
  const p = useProfile();
  const x = useExtras();
  const restDays = useExtras((x) => x.restDays);
  const s = streaks(p.sessions, undefined, restDays);
  const total = p.sessions.reduce((a, b) => a + b.minutes, 0);
  const spots = x.dropLog.length;
  const people = new Set(x.dropLog.flatMap((d) => d.with)).size;
  const bySubject = useMemo(() => {
    const m = new Map<string, number>();
    for (const ses of p.sessions) if (ses.subject) m.set(ses.subject, (m.get(ses.subject) ?? 0) + ses.minutes);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [p.sessions]);
  const topMinutes = bySubject[0]?.[1] ?? 1;
  return (
    <Card className="lg:col-span-12">
      <CardHeader title="Your study record" description="Counted from the sessions saved in this browser." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total focus time" value={fmtMinutes(total)} note={plural(p.sessions.length, 'session')} />
        <Stat label="Current streak" value={plural(s.current, 'day')} note={`Best: ${plural(s.best, 'day')}`} />
        <Stat label="Points" value={String(p.points)} />
        <Stat label="Drops" value={String(spots)} note={people ? `Studied with ${plural(people, 'person', 'people')}` : 'From Drop a Spot'} />
      </div>
      <h3 className="mt-6 mb-3 text-[18px]">Time by subject</h3>
      {bySubject.length ? (
        <ul className="grid gap-2.5">
          {bySubject.map(([subject, minutes]) => (
            <li key={subject} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-[14px]">
              <span className="truncate font-medium">{subject}</span>
              <span className="h-2.5 overflow-hidden rounded-full bg-surface-3"><span className="block h-full rounded-full bg-accent" style={{ width: `${(minutes / topMinutes) * 100}%` }} /></span>
              <span className="tnum text-muted">{fmtMinutes(minutes)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <Empty action={<Link href="/focus"><Button variant="secondary" size="sm">Open focus timer</Button></Link>}>Pick a subject when you start a focus session and your time is broken down here.</Empty>
      )}
    </Card>
  );
}

export function ProfilePage({ embedded = false }: { embedded?: boolean } = {}) {
  const p = useProfile();
  const year = YEARS.find((y) => y.value === p.year)?.label;
  const line = [p.school, p.major, year].filter(Boolean).join(', ');
  return (
    <>
      {!embedded && <PageHeader title={p.name || 'Profile'} description={line || 'Add your school, major and year below.'} />}
      <div className="grid gap-5 lg:grid-cols-12 [&>*]:min-w-0">
        {!embedded && <StatsCard />}
        <AboutCard />
        <CoursesCard />
        <StyleQuizCard className="lg:col-span-6" />
        <PromptsCard className="lg:col-span-6" />
      </div>
    </>
  );
}
