'use client';
import { useNow } from '@/lib/use-now';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Card, CardHeader, Empty, PageHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { suggestBlocks, type Proposal } from '@/features/calendar/plan';
import { ProposalList } from '@/features/calendar/proposal-list';
import { busyTimes } from '@/features/calendar/sync';
import { mondayOf } from '@/features/wellbeing/logic';
import { useExtras, type WeeklyReset } from '@/lib/stores/extras';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import { dateKey, fmtMinutes, plural, todayKey } from '@/lib/utils';

/** The week being planned: next week from Friday on, otherwise this week. */
export function planningWeek(now = new Date()) {
  const d = new Date(now);
  if ([5, 6, 0].includes(d.getDay())) d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  return mondayOf(dateKey(d));
}

/** True when a weekly reset is worth suggesting: Friday to Monday, and not done yet for the week ahead. */
export function resetDue(resets: WeeklyReset[], now = new Date()) {
  return [5, 6, 0, 1].includes(now.getDay()) && !resets.some((r) => r.week === planningWeek(now));
}

function LastWeek() {
  const sessions = useProfile((s) => s.sessions);
  const reminders = useProfile((s) => s.reminders);
  const { checkins, water } = useExtras();
  const now = useNow();
  const stats = useMemo(() => {
    const days = new Set(Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - i); return dateKey(d); }));
    const s = sessions.filter((x) => days.has(x.day));
    const c = checkins.filter((x) => days.has(x.day));
    const weekAgo = now - 7 * 86_400_000;
    return {
      minutes: s.reduce((n, x) => n + x.minutes, 0),
      sessions: s.length,
      activeDays: new Set(s.map((x) => x.day)).size,
      mood: c.length ? (c.reduce((n, x) => n + x.mood, 0) / c.length).toFixed(1) : null,
      checkins: c.length,
      done: reminders.filter((r) => r.done && r.dueAt >= weekAgo && r.dueAt <= now).length,
      water: [...days].reduce((n, d) => n + (water[d] ?? 0), 0),
    };
  }, [sessions, reminders, checkins, water, now]);
  const tiles = [
    ['Studied', fmtMinutes(stats.minutes), plural(stats.sessions, 'session')],
    ['Days you studied', `${stats.activeDays} of 7`, ''],
    ['Average mood', stats.mood ? `${stats.mood} / 5` : 'No check-ins', stats.checkins ? plural(stats.checkins, 'check-in') : ''],
    ['Deadlines done', String(stats.done), ''],
    ['Water', plural(stats.water, 'glass', 'glasses'), ''],
  ];
  return (
    <Card className="lg:col-span-12">
      <CardHeader title="Your last 7 days" />
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map(([label, value, note]) => (
          <div key={label} className="rounded-xl bg-surface-3 p-4">
            <p className="text-[14px] text-muted">{label}</p>
            <p className="tnum mt-1 font-display text-[24px] leading-8">{value}</p>
            {note && <p className="text-[13px] text-muted">{note}</p>}
          </div>
        ))}
      </div>
    </Card>
  );
}

export function ResetPage({ embedded = false }: { embedded?: boolean } = {}) {
  const x = useExtras();
  const reminders = useProfile((s) => s.reminders);
  const week = planningWeek();
  const existing = x.resets.find((r) => r.week === week);
  const previous = x.resets.filter((r) => r.week < week).sort((a, b) => b.week.localeCompare(a.week))[0];
  const [form, setForm] = useState(() => existing ?? { wentWell: '', gotInWay: '', change: '', intentions: ['', '', ''] });
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const weekLabel = new Date(`${week}T12:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });

  const save = () => {
    const entry: WeeklyReset = { week, wentWell: form.wentWell.trim(), gotInWay: form.gotInWay.trim(), change: form.change.trim(), intentions: form.intentions.map((i) => i.trim()).filter(Boolean), at: Date.now() };
    x.update({ resets: [entry, ...x.resets.filter((r) => r.week !== week)].slice(0, 60) });
    toast('Weekly reset saved.');
  };

  const plan = () => {
    const [y, m, d] = week.split('-').map(Number);
    const start = Math.max(Date.now(), new Date(y, m - 1, d).getTime());
    const end = new Date(y, m - 1, d + 7).getTime();
    const out = suggestBlocks({ reminders, blocks: x.studyBlocks, busy: busyTimes(x.calendarFeeds), prefs: x.planPrefs, windDown: x.windDown, now: start, horizonDays: Math.ceil((end - start) / 86_400_000) + 7 }).filter((p) => p.start < end);
    setProposals(out);
    if (!out.length) toast('Nothing new to plan for that week. Add deadlines in Planner or connect Canvas.');
  };

  return (
    <>
      {!embedded && <PageHeader title="Weekly reset" description={`Ten minutes to look back, decide what to change, and plan the week of ${weekLabel}. Sunday evening works well for most people.`} />}
      <div className="grid gap-5 lg:grid-cols-12 [&>*]:min-w-0">
        <LastWeek />
        <Card className="lg:col-span-7">
          <CardHeader title="Look back" />
          <Field label="What went well?" htmlFor="rsWell" className="mt-0"><Textarea id="rsWell" rows={2} maxLength={400} value={form.wentWell} onChange={(e) => setForm({ ...form, wentWell: e.target.value })} placeholder="Finished the lab report two days early" /></Field>
          <Field label="What got in the way?" htmlFor="rsWay"><Textarea id="rsWay" rows={2} maxLength={400} value={form.gotInWay} onChange={(e) => setForm({ ...form, gotInWay: e.target.value })} placeholder="Stayed up late Wednesday and lost Thursday" /></Field>
          <Field label="What will you change?" htmlFor="rsChange"><Textarea id="rsChange" rows={2} maxLength={400} value={form.change} onChange={(e) => setForm({ ...form, change: e.target.value })} placeholder="Wind down at 11 on weeknights" /></Field>
          <h3 className="mt-6 text-[18px]">Three intentions for the week</h3>
          <div className="mt-2 grid gap-2">
            {form.intentions.map((v, i) => (
              <Input key={i} aria-label={`Intention ${i + 1}`} maxLength={120} value={v} placeholder={['Start the STAT400 problem set by Tuesday', 'Two library sessions with my study group', 'One full rest day'][i]} onChange={(e) => setForm({ ...form, intentions: form.intentions.map((x, j) => (j === i ? e.target.value : x)) })} />
            ))}
          </div>
          <Button className="mt-5" onClick={save}>{existing ? 'Update reset' : 'Save reset'}</Button>
        </Card>
        <div className="grid content-start gap-5 lg:col-span-5">
          <Card>
            <CardHeader title="Plan the week" description="Suggests study blocks for the week around your classes and due dates." action={<Button variant="secondary" onClick={plan}>Suggest blocks</Button>} />
            {proposals ? (proposals.length ? <ProposalList key={String(proposals[0].start)} proposals={proposals} onDone={() => setProposals(null)} /> : <Empty>Nothing new to plan.</Empty>) : <p className="text-[14px] text-muted">See everything on your <Link href="/calendar" className="font-medium text-accent-ink underline underline-offset-4">calendar</Link>.</p>}
          </Card>
          {previous && (
            <Card>
              <CardHeader title="Last week you planned to" />
              {previous.intentions.length ? <ul className="grid list-disc gap-1 pl-5 text-[15px] leading-6">{previous.intentions.map((i) => <li key={i}>{i}</li>)}</ul> : <Empty>No intentions written.</Empty>}
              {previous.change && <p className="mt-3 text-[14px] text-ink-2"><span className="text-muted">You wanted to change: </span>{previous.change}</p>}
            </Card>
          )}
        </div>
      </div>
      <p className="mt-6 text-[13px] text-muted">Saved in this browser only. Today is {new Date(`${todayKey()}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long' })}.</p>
    </>
  );
}
