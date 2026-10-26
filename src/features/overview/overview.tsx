'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Badge, Card, CardHeader, Empty, Eyebrow } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Icon, type IconName } from '@/components/ui/icons';
import { Bar, Ring } from '@/components/ui/progress';
import { minutesOn, streaks, weekMinutes, weekSeries } from '@/features/focus/logic';
import { NotificationSettings } from '@/features/planner/notifications';
import { CALMING_THOUGHTS, ReminderRow, SessionRow } from '@/features/shared';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import { downloadFile, localDateTimeValue, todayKey } from '@/lib/utils';

function Stat({ icon, tone, value, unit, title, text }: { icon: IconName; tone: string; value: number; unit: string; title: string; text: string }) {
  return (
    <Card>
      <span className={`grid size-9 place-items-center rounded-xl ${tone}`}><Icon name={icon} className="size-[18px]" /></span>
      <div className="mt-4 mb-1 flex items-baseline gap-1.5">
        <strong className="font-display text-3xl font-extrabold text-ink">{value}</strong>
        <small className="text-sm text-muted">{unit}</small>
      </div>
      <h3 className="text-sm font-bold text-ink">{title}</h3>
      <p className="mt-0.5 text-[13px] text-muted">{text}</p>
    </Card>
  );
}

export function Overview() {
  const p = useProfile();
  const [thought, setThought] = useState(() => new Date().getDate() % CALMING_THOUGHTS.length);
  const [planValue, setPlanValue] = useState(() => (p.nextPlanAt ? localDateTimeValue(p.nextPlanAt) : ''));
  const daily = minutesOn(p.sessions, todayKey());
  const pct = Math.min(100, Math.round((daily / p.dailyGoal) * 100));
  const week = weekMinutes(p.sessions);
  const series = useMemo(() => weekSeries(p.sessions), [p.sessions]);
  const max = Math.max(60, ...series.map((s) => s.minutes));
  const upcoming = p.reminders.filter((r) => !r.done).sort((a, b) => a.dueAt - b.dueAt).slice(0, 3);
  const hour = new Date().getHours();
  const name = p.name.trim() || 'Student';

  const savePlan = () => {
    const when = new Date(planValue).getTime();
    if (!Number.isFinite(when) || when <= Date.now()) return toast('Choose a future study time.', 'error');
    p.update({ nextPlanAt: when, nextPlanNotified: false });
    toast('Your next study session is planned.');
  };
  const downloadIcs = () => {
    if (!p.nextPlanAt) return toast('Plan your next session first.');
    const stamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Studytime//Study plan//EN', 'BEGIN:VEVENT', `UID:studytime-${p.nextPlanAt}@studytime`, `DTSTAMP:${stamp(Date.now())}`, `DTSTART:${stamp(p.nextPlanAt)}`, `DTEND:${stamp(p.nextPlanAt + p.duration * 60_000)}`, 'SUMMARY:Studytime focus session', `DESCRIPTION:Open Studytime: ${location.origin}/focus`, 'BEGIN:VALARM', 'TRIGGER:-PT10M', 'ACTION:DISPLAY', 'DESCRIPTION:Time to get ready for your study session', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    downloadFile('Studytime next session.ics', ics, 'text/calendar');
    toast('Calendar event downloaded. Open it to add the reminder.');
  };

  return (
    <>
      <header className="mt-8 mb-6 flex flex-wrap items-end justify-between gap-4 max-sm:mt-5">
        <div>
          <Eyebrow>YOUR STUDY SPACE</Eyebrow>
          <h1 className="mt-2 text-[clamp(28px,3vw,40px)] font-extrabold tracking-[-0.04em]">{hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'}, {name}</h1>
          <p className="mt-2 text-[15px] text-muted">Show up for yourself today. Every minute counts.</p>
        </div>
        <Link href="/focus"><Button size="lg">Start focusing <Icon name="arrow" className="size-4" /></Button></Link>
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-accent-soft px-5 py-4">
        <Badge tone="accent" className="bg-brand! text-white!">NEW</Badge>
        <div className="min-w-0 flex-1">
          <strong className="font-display text-[15px]">Stuck on a problem? Snap a photo.</strong>
          <p className="mt-0.5 text-[13px] text-muted">The free AI tutor explains it step by step, cross-checks the answer, and turns it into concept cards.</p>
        </div>
        <Link href="/ai"><Button variant="white" size="sm" className="shadow-sm">Open AI Tutor <Icon name="arrow" className="size-3.5" /></Button></Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="relative flex min-h-64 overflow-hidden rounded-2xl bg-[#1d4735] text-white lg:col-span-2">
          <div className="relative z-10 p-8 sm:w-2/3">
            <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.13em] text-[#c9deb6]"><i className="size-1.5 rounded-full bg-[#c7e796]" /> READY WHEN YOU ARE</div>
            <h2 className="mt-5 text-[clamp(26px,2.5vw,36px)] leading-tight font-extrabold">Find your focus.<br /><span className="text-[#cde5a6]">Build your future.</span></h2>
            <p className="mt-3 mb-6 max-w-sm text-sm leading-relaxed text-[#b7cfba]">Set a timer, get into your flow, and turn your effort into progress you can see.</p>
            <div className="flex flex-wrap gap-2.5">
              <Link href="/focus"><Button variant="white">Start a study session <Icon name="arrow" className="size-4" /></Button></Link>
              <Link href="/ai"><Button variant="outline-light">Ask the AI tutor</Button></Link>
            </div>
          </div>
          <div aria-hidden="true" className="absolute top-1/2 right-[-40px] size-[300px] -translate-y-1/2 rounded-full border border-[#cdebb440] bg-[#7aa0591f] max-sm:hidden">
            <div className="absolute inset-10 rounded-full border border-[#cdebb440] bg-[#cfeaad19]" />
            <div className="absolute inset-24 rounded-full border border-[#cdebb440] bg-[#bdd99a30]" />
          </div>
        </section>

        <Card>
          <CardHeader eyebrow="TODAY'S PROGRESS" title="Keep it going" />
          <div className="flex items-center gap-5">
            <Ring value={pct}>
              <div><strong className="block font-display text-3xl leading-none">{daily}</strong><span className="text-[11px] text-muted">min studied</span></div>
            </Ring>
            <div>
              <strong className="text-sm">{daily} / {p.dailyGoal} min</strong>
              <span className="block text-xs text-muted">daily goal</span>
              <p className="mt-3 text-xs text-muted">{daily >= p.dailyGoal ? 'Daily goal complete. Nice work!' : daily ? 'You’re making progress today.' : 'Your first session is waiting.'}</p>
            </div>
          </div>
          <Bar value={pct} className="mt-5" />
        </Card>

        <div className="grid overflow-hidden rounded-2xl border border-line shadow-card md:grid-cols-2 lg:col-span-3">
          <div className="bg-surface p-6">
            <Eyebrow>YOUR CAMPUS STUDY SPOT</Eyebrow>
            <h2 className="mt-1.5 text-lg font-bold">Where are you studying today?</h2>
            <p className="mt-1 text-sm text-muted">It will appear in your completed session history.</p>
            <Field label="Campus location" htmlFor="homeLocation" className="mt-4">
              <Input id="homeLocation" list="campusLocations" maxLength={80} value={p.location} disabled={p.timer.mode !== 'ready'} onChange={(e) => p.update({ location: e.target.value })} placeholder="e.g. Main Library, Science Building" />
            </Field>
          </div>
          <div className="bg-accent-soft p-6">
            <Eyebrow>A MOMENT FOR YOU</Eyebrow>
            <h2 className="mt-1.5 text-lg font-bold">Take a breath.</h2>
            <p className="mt-3 min-h-14 font-display text-lg font-semibold text-accent-ink">{CALMING_THOUGHTS[thought]}</p>
            <Button variant="white" size="sm" className="mt-3 border border-line" onClick={() => setThought((thought + 1) % CALMING_THOUGHTS.length)}>Another calming thought →</Button>
          </div>
        </div>

        <Stat icon="flame" tone="bg-[#fff1e5] text-[#e8913f] dark:bg-[#3a2a1c]" value={streaks(p.sessions).current} unit="days" title="Current streak" text="Keep showing up each day." />
        <Stat icon="star" tone="bg-[#f2edfa] text-[#9d7cc4] dark:bg-[#2c2538]" value={p.points} unit="pts" title="Total points" text="Earned through focused work." />
        <Stat icon="clock" tone="bg-[#e8f2f5] text-[#5f9cb0] dark:bg-[#1d2f35]" value={week} unit="min" title="This week" text={`${week} / ${p.weeklyGoal} min weekly goal`} />

        <Card className="lg:col-span-2">
          <CardHeader eyebrow="WHAT IS NEXT" title="Upcoming deadlines" action={<div className="flex gap-3"><Link href="/planner#syllabus"><Button variant="link" size="sm">Import syllabus →</Button></Link><Link href="/planner"><Button variant="link" size="sm">Manage →</Button></Link></div>} />
          {upcoming.length ? upcoming.map((r) => <ReminderRow key={r.id} r={r} />) : <Empty>No deadlines yet. Add homework, an exam, or an assignment in Planner.</Empty>}
        </Card>

        <Card>
          <CardHeader eyebrow="YOUR NEXT STUDY MOMENT" title="Make it easy to come back" description={p.nextPlanAt ? `Next session planned for ${new Date(p.nextPlanAt).toLocaleString()}.` : 'Choose when you want to study next. Studytime reminds you while it’s open.'} />
          <Input type="datetime-local" aria-label="Next study time" value={planValue} onChange={(e) => setPlanValue(e.target.value)} />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={savePlan}>Plan next session</Button>
            <Button variant="secondary" onClick={downloadIcs}>Add to calendar</Button>
            {p.nextPlanAt && <Button variant="ghost" onClick={() => (p.update({ nextPlanAt: null, nextPlanNotified: false }), setPlanValue(''))}>Clear</Button>}
          </div>
          {p.reflections[0] && <p className="mt-4 text-[13px] text-muted">Last check-in: {p.reflections[0].note || 'You showed up.'} · Felt {p.reflections[0].mood}</p>}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader eyebrow="YOUR MOMENTUM" title="This week" action={<Link href="/planner#activity"><Button variant="link" size="sm">View activity →</Button></Link>} />
          <div className="flex h-40 items-end gap-3">
            {series.map((d) => (
              <div key={d.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2" title={`${d.label}: ${d.minutes} minutes`}>
                <div className={`w-full max-w-11 rounded-lg ${d.minutes ? 'bg-accent' : 'bg-surface-3'}`} style={{ height: `${Math.max(5, (d.minutes / max) * 100)}%` }} />
                <small className="text-[11px] text-muted">{d.label}</small>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader eyebrow="THE WORK YOU'VE DONE" title="Recent sessions" action={<Link href="/planner#activity"><Button variant="link" size="sm">See all →</Button></Link>} />
          {p.sessions.length ? p.sessions.slice(0, 4).map((s) => <SessionRow key={s.id} s={s} />) : <Empty>Your completed sessions will show up here.</Empty>}
        </Card>
      </div>
      <NotificationSettings />
      <datalist id="campusLocations">{['Library', 'Student center', 'Study lounge', 'Residence hall', 'Campus café', 'Other campus spot'].map((x) => <option key={x} value={x} />)}</datalist>
    </>
  );
}
