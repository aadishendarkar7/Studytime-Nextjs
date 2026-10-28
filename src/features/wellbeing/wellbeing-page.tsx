'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Badge, Card, CardHeader, Empty, PageHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, FieldRow, Input, Select } from '@/components/ui/field';
import { useExtras } from '@/lib/stores/extras';
import { useProfile } from '@/lib/stores/profile';
import { toast, useUi } from '@/lib/stores/ui';
import { cn, plural, todayKey } from '@/lib/utils';
import { CheckInForm } from './check-in';
import { patterns, strainCheck } from './logic';
import { WaterTracker } from './water';

function PatternsCard() {
  const sessions = useProfile((s) => s.sessions);
  const checkins = useExtras((s) => s.checkins);
  const found = patterns({ sessions, checkins });
  return (
    <Card className="lg:col-span-7">
      <CardHeader title="Your patterns" description="Found from your own check-ins and sessions, only when there is enough data to be fair." />
      {found.length ? (
        <ul className="grid gap-2">{found.map((f) => <li key={f} className="rounded-xl bg-surface-2 px-4 py-3 text-[15px] leading-6">{f}</li>)}</ul>
      ) : checkins.length >= 14 ? (
        <Empty>No clear patterns yet from your {plural(checkins.length, 'check-in')}. Studytime only reports a difference when it is large and shows up across several days, so nothing here means nothing stood out.</Empty>
      ) : (
        <Empty>Patterns appear after about two weeks of check-ins. So far: {plural(checkins.length, 'check-in')}.</Empty>
      )}
    </Card>
  );
}

function StrainNotice() {
  const sessions = useProfile((s) => s.sessions);
  const checkins = useExtras((s) => s.checkins);
  const strain = strainCheck({ sessions, checkins, today: todayKey() });
  if (strain.kind === 'none') return null;
  return (
    <Card className="border-glow bg-warn-soft lg:col-span-12">
      <h2 className="text-[21px] leading-7">{strain.kind === 'low' ? 'This week looks heavy' : 'You are pushing hard'}</h2>
      <p className="mt-2 max-w-[68ch] text-[15px] leading-6 text-ink-2">
        {strain.kind === 'low'
          ? `Your last ${strain.days} check-ins show low mood and high stress. That happens, especially near exams. A rest day, a walk, or talking to someone you trust can help more than another hour of studying.`
          : 'You studied a lot more this week than last, and your mood dropped. Consider shorter sessions and a planned rest day.'}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/help"><Button variant="secondary">Support and resources</Button></Link>
      </div>
    </Card>
  );
}

function HabitsCard() {
  const x = useExtras();
  return (
    <Card className="lg:col-span-5">
      <CardHeader title="Water" description="Tap a glass when you drink one. A reminder pops up while Studytime is open." />
      <WaterTracker />
      <Checkbox label="Remind me to drink water" checked={x.waterRemind} onChange={(e) => x.update({ waterRemind: e.target.checked })} />
      <FieldRow className="mt-2">
        <Field label="Every" hint="minutes" htmlFor="waterEvery"><Select id="waterEvery" value={x.waterEvery} disabled={!x.waterRemind} onChange={(e) => x.update({ waterEvery: Number(e.target.value) })}>{[25, 30, 45, 60].map((m) => <option key={m} value={m}>{m}</option>)}</Select></Field>
        <Field label="Daily goal" hint="glasses" htmlFor="waterGoal"><Select id="waterGoal" value={x.waterGoal} onChange={(e) => x.update({ waterGoal: Number(e.target.value) })}>{[4, 5, 6, 7, 8, 9, 10, 12].map((m) => <option key={m} value={m}>{m}</option>)}</Select></Field>
      </FieldRow>
      <Button size="sm" variant="ghost" className="mt-3 -ml-2" onClick={() => useUi.setState({ waterPrompt: true })}>Preview the reminder</Button>
    </Card>
  );
}

function RoutineCard() {
  const x = useExtras();
  const [windDown, setWindDown] = useState(x.windDown);
  return (
    <Card className="lg:col-span-7">
      <CardHeader title="Wind-down" description="Sleep matters as much as study time. After your wind-down time Studytime stops suggesting study blocks and shows tomorrow's plan instead." />
      <FieldRow className="mt-0">
        <Field label="Wind-down time" hint="leave empty to turn off" htmlFor="windDown">
          <div className="flex gap-2">
            <Input id="windDown" type="time" value={windDown} onChange={(e) => setWindDown(e.target.value)} />
            <Button variant="secondary" onClick={() => (x.update({ windDown }), toast(windDown ? `Wind-down set for ${windDown}.` : 'Wind-down turned off.'))}>Save</Button>
          </div>
        </Field>
      </FieldRow>
    </Card>
  );
}

function HistoryCard() {
  const checkins = useExtras((s) => s.checkins);
  const recent = [...checkins].sort((a, b) => b.day.localeCompare(a.day)).slice(0, 7);
  return (
    <Card className="lg:col-span-5">
      <CardHeader title="Recent check-ins" />
      {recent.length ? (
        <ul className="divide-y divide-line">
          {recent.map((c) => (
            <li key={c.day} className="py-2.5 text-[14px]">
              <div className="flex items-center justify-between gap-2">
                <strong className="font-semibold">{new Date(`${c.day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</strong>
                <span className="flex gap-1.5"><Badge tone="accent">Mood {c.mood}/5</Badge><Badge>Stress {c.stress}/5</Badge>{c.sleep !== null && <Badge>{c.sleep}h sleep</Badge>}</span>
              </div>
              {c.note && <p className="mt-1 text-ink-2">{c.note}</p>}
            </li>
          ))}
        </ul>
      ) : <Empty>No check-ins yet.</Empty>}
    </Card>
  );
}

export function WellbeingPage({ embedded = false }: { embedded?: boolean } = {}) {
  const checkedIn = useExtras((s) => s.checkins.some((c) => c.day === todayKey()));
  return (
    <>
      {!embedded && <PageHeader title="Check-in" description="Thirty seconds a day. Over time it shows how sleep, stress and study affect each other, and it is only saved in this browser." />}
      <div className="grid gap-5 lg:grid-cols-12 [&>*]:min-w-0">
        <StrainNotice />
        <Card className={cn('lg:col-span-5', !checkedIn && 'ring-2 ring-accent/30')}>
          <CardHeader title={checkedIn ? 'Today’s check-in' : 'Check in for today'} />
          <CheckInForm />
        </Card>
        <PatternsCard />
        <HistoryCard />
        <RoutineCard />
        <HabitsCard />
      </div>
      <p className="mt-6 text-[14px] text-muted">Having a hard time? <Link href="/help" className="font-medium text-accent-ink underline underline-offset-4">Support and resources</Link></p>
    </>
  );
}
