'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Card, CardHeader, Empty, Eyebrow, PageHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Bar } from '@/components/ui/progress';
import { minutesOn, streaks, weekMinutes, weekSeries } from '@/features/focus/logic';
import { TimerReadout } from '@/features/focus/timer-readout';
import { NotificationSettings } from '@/features/planner/notifications';
import { ReminderRow, SessionRow } from '@/features/shared';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import { downloadFile, localDateTimeValue, todayKey } from '@/lib/utils';

function Stat({ label, value, unit, note }: { label: string; value: number; unit: string; note: string }) {
  return (
    <div className="p-5 max-sm:p-4">
      <Eyebrow>{label}</Eyebrow>
      <div className="tnum mt-2 flex items-baseline gap-2">
        <strong className="text-[40px] leading-[44px] font-medium">{value}</strong>
        <span className="text-[13px] text-muted">{unit}</span>
      </div>
      <p className="tnum mt-1 text-[12px] leading-4 text-muted">{note}</p>
    </div>
  );
}

export function Overview() {
  const p = useProfile();
  const [planValue, setPlanValue] = useState(() => (p.nextPlanAt ? localDateTimeValue(p.nextPlanAt) : ''));
  const daily = minutesOn(p.sessions, todayKey());
  const pct = Math.min(100, Math.round((daily / p.dailyGoal) * 100));
  const week = weekMinutes(p.sessions);
  const series = useMemo(() => weekSeries(p.sessions), [p.sessions]);
  const max = Math.max(60, ...series.map((s) => s.minutes));
  const upcoming = p.reminders.filter((r) => !r.done).sort((a, b) => a.dueAt - b.dueAt).slice(0, 4);
  const streak = streaks(p.sessions);

  const savePlan = () => {
    const when = new Date(planValue).getTime();
    if (!Number.isFinite(when) || when <= Date.now()) return toast('Choose a future study time.', 'error');
    p.update({ nextPlanAt: when, nextPlanNotified: false });
    toast('Next session saved.');
  };
  const downloadIcs = () => {
    if (!p.nextPlanAt) return toast('Plan your next session first.');
    const stamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Studytime//Study plan//EN', 'BEGIN:VEVENT', `UID:studytime-${p.nextPlanAt}@studytime`, `DTSTAMP:${stamp(Date.now())}`, `DTSTART:${stamp(p.nextPlanAt)}`, `DTEND:${stamp(p.nextPlanAt + p.duration * 60_000)}`, 'SUMMARY:Studytime focus session', `DESCRIPTION:Open Studytime: ${location.origin}/focus`, 'BEGIN:VALARM', 'TRIGGER:-PT10M', 'ACTION:DISPLAY', 'DESCRIPTION:Study session in 10 minutes', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    downloadFile('Studytime next session.ics', ics, 'text/calendar');
    toast('Calendar file downloaded. Open it to add the event.');
  };

  return (
    <>
      <PageHeader title="Overview" />

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <TimerReadout />
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/focus"><Button size="lg">{p.timer.mode === 'ready' ? 'Start focus session' : 'Open timer'}</Button></Link>
          </div>
        </Card>

        <Card className="lg:col-span-4">
          <CardHeader title="Today" />
          <div className="tnum flex items-baseline gap-2">
            <strong className="text-[40px] leading-[44px] font-medium">{daily}</strong>
            <span className="text-[13px] text-muted">of {p.dailyGoal} min goal</span>
          </div>
          <Bar value={pct} className="mt-4" />
          <p className="mt-3 text-[13px] leading-5 text-muted">{daily >= p.dailyGoal ? 'Daily goal reached.' : daily ? `${p.dailyGoal - daily} min left to reach your goal.` : 'No study time logged yet today.'}</p>
        </Card>

        <div className="grid divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-md sm:grid-cols-3 sm:divide-x sm:divide-y-0 lg:col-span-12">
          <Stat label="Current streak" value={streak.current} unit={streak.current === 1 ? 'day' : 'days'} note={`Best: ${streak.best} ${streak.best === 1 ? 'day' : 'days'}`} />
          <Stat label="Points" value={p.points} unit="pts" note="Earned by finished sessions" />
          <Stat label="This week" value={week} unit="min" note={`Weekly goal: ${p.weeklyGoal} min`} />
        </div>

        <Card className="lg:col-span-7">
          <CardHeader title="Recent sessions" action={<Link href="/planner#activity"><Button variant="link" size="sm">All activity</Button></Link>} />
          {p.sessions.length ? p.sessions.slice(0, 6).map((s) => <SessionRow key={s.id} s={s} />) : <Empty>No sessions yet. Finish a focus session and it is logged here.</Empty>}
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader title="Upcoming deadlines" action={<Link href="/planner"><Button variant="link" size="sm">Planner</Button></Link>} />
          {upcoming.length ? upcoming.map((r) => <ReminderRow key={r.id} r={r} />) : <Empty>No deadlines yet. Add one in Planner or import a syllabus.</Empty>}
        </Card>

        <Card className="lg:col-span-7">
          <CardHeader title="This week" description="Minutes studied per day." />
          <div className="flex h-40 items-end gap-3 border-b border-line">
            {series.map((d) => (
              <div key={d.label} className="flex h-full flex-1 items-end" title={`${d.label}: ${d.minutes} min`}>
                <div className={d.minutes ? 'w-full bg-accent' : 'w-full bg-line'} style={{ height: d.minutes ? `${Math.max(4, (d.minutes / max) * 100)}%` : '2px' }} />
              </div>
            ))}
          </div>
          <div className="tnum mt-2 flex gap-3 text-[12px] leading-4 text-muted">
            {series.map((d) => (
              <span key={d.label} className="flex-1">{d.label}<br />{d.minutes}</span>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader title="Next session" description={p.nextPlanAt ? `Planned for ${new Date(p.nextPlanAt).toLocaleString()}.` : 'Pick a time. Studytime reminds you while the app is open.'} />
          <Input type="datetime-local" aria-label="Next study time" value={planValue} onChange={(e) => setPlanValue(e.target.value)} />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={savePlan}>Save</Button>
            <Button variant="secondary" onClick={downloadIcs}>Add to calendar</Button>
            {p.nextPlanAt && <Button variant="ghost" onClick={() => (p.update({ nextPlanAt: null, nextPlanNotified: false }), setPlanValue(''))}>Clear</Button>}
          </div>
          {p.reflections[0] && <p className="mt-4 text-[13px] leading-5 text-muted">Last check-in: {p.reflections[0].note || 'no note'}. Felt {p.reflections[0].mood}.</p>}
        </Card>
      </div>
      <NotificationSettings />
    </>
  );
}
