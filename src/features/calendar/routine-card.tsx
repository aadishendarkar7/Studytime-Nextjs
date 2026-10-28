'use client';
import { useState } from 'react';
import { Card, CardHeader, Empty } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, FieldRow, Note, Select } from '@/components/ui/field';
import { Icon } from '@/components/ui/icons';
import { useExtras } from '@/lib/stores/extras';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import { useNow } from '@/lib/use-now';
import { fmtMinutes, plural, uid } from '@/lib/utils';
import { studyWindow, type Proposal } from './plan';
import { ProposalList } from './proposal-list';
import { catchUp, detectClasses, freeGaps, missedBlocks, routinePlan } from './routine';
import { allEvents, busyTimes } from './sync';

const clock = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/** A week of reviews and deep work around the classes in your connected calendars. */
export function buildRoutine(opts: { reviewMinutes?: number; deepPerCourse?: number } = {}): Proposal[] {
  const x = useExtras.getState();
  const now = Date.now();
  const classes = detectClasses(allEvents(x.calendarFeeds), now);
  return routinePlan({ classes, busy: busyTimes(x.calendarFeeds), planned: x.studyBlocks.filter((b) => b.end > now), win: studyWindow(x.planPrefs, x.windDown), maxPerDay: x.planPrefs.maxPerDay, blockMinutes: x.planPrefs.blockMinutes, now, ...opts });
}

/** Moves missed study blocks to the next free time. Returns how many moved. */
export function moveMissed() {
  const x = useExtras.getState();
  const now = Date.now();
  const missed = missedBlocks(x.studyBlocks, now);
  const moved = catchUp({ missed, busy: busyTimes(x.calendarFeeds), planned: x.studyBlocks.filter((b) => b.end > now), win: studyWindow(x.planPrefs, x.windDown), maxPerDay: x.planPrefs.maxPerDay, now });
  const by = new Map(moved.map((m) => [m.id, m]));
  x.update({ studyBlocks: x.studyBlocks.map((b) => (by.has(b.id) ? { ...b, ...by.get(b.id)! } : b)).sort((a, b) => a.start - b.start) });
  return moved.length;
}

export function RoutineCard({ onConnect }: { onConnect: () => void }) {
  const x = useExtras();
  const reminders = useProfile((s) => s.reminders);
  const now = useNow(60_000);
  const [review, setReview] = useState(25);
  const [deep, setDeep] = useState(2);
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const classes = detectClasses(allEvents(x.calendarFeeds), now);
  const win = studyWindow(x.planPrefs, x.windDown);
  const gaps = freeGaps({ now, win, busy: [...busyTimes(x.calendarFeeds), ...x.studyBlocks.filter((b) => b.end > now)] }).slice(0, 4);
  const missed = missedBlocks(x.studyBlocks, now);
  const urgent = reminders.filter((r) => !r.done && r.dueAt > now).sort((a, b) => a.dueAt - b.dueAt)[0];

  const fillGap = (g: { start: number; end: number }) => {
    const minutes = Math.min(x.planPrefs.blockMinutes, Math.round((g.end - g.start) / 60_000) - 5);
    const title = urgent ? `${urgent.type === 'exam' ? 'Prep' : 'Work on'}: ${urgent.title}` : classes[0] ? `Review: ${classes[0].name}` : 'Focus session';
    x.update({ studyBlocks: [...x.studyBlocks, { id: uid(), title, subject: urgent?.title ?? classes[0]?.name ?? '', start: g.start, end: g.start + minutes * 60_000, source: 'suggested' as const, reminderId: urgent?.id, done: false }].sort((a, b) => a.start - b.start) });
    toast(`Added ${fmtMinutes(minutes)} for ${title.replace(/^\w+( on)?: /, '')}.`);
  };

  if (!x.calendarFeeds.length)
    return (
      <Card>
        <CardHeader title="Your weekly routine" description="Connect your class calendar and Studytime builds a week of study around it: a short review after each class while it is fresh, and longer blocks for each course on your lighter days." />
        <Empty title="No calendar connected yet" action={<Button onClick={onConnect}>Connect Google or Canvas</Button>}>It takes about a minute. Your calendar link stays in this browser.</Empty>
      </Card>
    );

  return (
    <div className="grid gap-4">
      {missed.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warn/25 bg-warn-soft px-4 py-3">
          <Icon name="clock" className="size-4 text-warn" />
          <p className="min-w-0 flex-1 text-[14px]"><strong className="font-semibold">You missed {plural(missed.length, 'study block')}.</strong> <span className="text-ink-2">No problem. Move {missed.length === 1 ? 'it' : 'them'} to your next free time.</span></p>
          <Button size="sm" variant="secondary" onClick={() => { const n = moveMissed(); toast(n ? `Moved ${plural(n, 'block')}.` : 'No free time this week to move them to.'); }}>Move {missed.length === 1 ? 'it' : 'them'}</Button>
        </div>
      )}

      <Card>
        <CardHeader title="Your weekly routine" description="A short review the same day as each class, while it is fresh, plus longer blocks for each course on days you do not have it." action={<Button onClick={() => { const p = buildRoutine({ reviewMinutes: review, deepPerCourse: deep }); setProposals(p); if (!p.length) toast('Your week already has these blocks, or there is no free time left.'); }}><Icon name="sparkle" className="size-4" /> Build my week</Button>} />
        {classes.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {classes.map((c) => <li key={c.name} className="rounded-md border border-line bg-surface-2 px-2 py-1 text-[13px]"><span className="font-semibold">{c.name}</span> <span className="text-muted">· {c.perWeek}× a week</span></li>)}
          </ul>
        ) : <Note>No repeating classes found in the next two weeks. Check that your class calendar is connected, not only Canvas due dates.</Note>}
        <FieldRow>
          <Field label="Review after class" htmlFor="rtReview"><Select id="rtReview" value={review} onChange={(e) => setReview(Number(e.target.value))}>{[15, 20, 25, 30, 45].map((m) => <option key={m} value={m}>{m} minutes</option>)}</Select></Field>
          <Field label="Deep work per course" htmlFor="rtDeep"><Select id="rtDeep" value={deep} onChange={(e) => setDeep(Number(e.target.value))}>{[0, 1, 2, 3].map((m) => <option key={m} value={m}>{m === 0 ? 'None' : `${m} × ${x.planPrefs.blockMinutes} min a week`}</option>)}</Select></Field>
        </FieldRow>
        {proposals && <ProposalList key={proposals.length + String(proposals[0]?.start)} proposals={proposals} onDone={() => setProposals(null)} />}
      </Card>

      <Card>
        <CardHeader title="Free time today" description="Gaps between your classes and blocks. One tap fills a gap with your most urgent work." />
        {gaps.length ? (
          <ul className="divide-y divide-line">
            {gaps.map((g) => (
              <li key={g.start} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1"><span className="tnum block text-[14px] font-semibold">{clock(g.start)} to {clock(g.end)}</span><span className="text-[12px] text-muted">{fmtMinutes(Math.round((g.end - g.start) / 60_000))} free</span></span>
                <Button size="sm" variant="secondary" onClick={() => fillGap(g)}>Use it</Button>
              </li>
            ))}
          </ul>
        ) : <Empty>No free stretches of 30 minutes or more left today.</Empty>}
        {urgent && <Note>Gaps go to {urgent.title} first, since it is due soonest.</Note>}
      </Card>
    </div>
  );
}
