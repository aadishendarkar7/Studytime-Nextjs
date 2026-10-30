'use client';
import { useState } from 'react';
import { Badge, Card, CardHeader, Empty } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, FieldRow, Input, Note, Select } from '@/components/ui/field';
import { Icon } from '@/components/ui/icons';
import { Segmented } from '@/components/ui/segmented';
import { api } from '@/lib/api';
import { useExtras } from '@/lib/stores/extras';
import { useLearning } from '@/lib/stores/learning';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import { useNow } from '@/lib/use-now';
import { cn, copyText, plural } from '@/lib/utils';
import { BlockRow } from './block-row';
import { ProposalList } from './proposal-list';
import { buildRoutine } from './routine-card';
import { isCrunch, reviewPlan, startOfDay, suggestBlocks, weekLoads, type Proposal } from './plan';
import { addFeed, allEvents, busyTimes, feedUrl, guessKind, refreshFeed, syncOutgoing } from './sync';

const DAY = 86_400_000;

type Source = 'google' | 'canvas' | 'other';
const HOW_TO: Record<Source, { label: string; steps: string[]; placeholder: string }> = {
  google: {
    label: 'Google Calendar',
    placeholder: 'https://calendar.google.com/calendar/ical/.../basic.ics',
    steps: [
      'Open Google Calendar on a computer and click the gear, then Settings.',
      'On the left, under "Settings for my calendars", click the calendar you want.',
      'Scroll to "Integrate calendar" and copy "Secret address in iCal format".',
      'Paste it below. Keep this link private: anyone with it can see your calendar.',
    ],
  },
  canvas: {
    label: 'Canvas (ELMS)',
    placeholder: 'https://school.instructure.com/feeds/calendars/user_....ics',
    steps: [
      'Open Canvas in a browser and click Calendar in the left menu.',
      'At the bottom right, click "Calendar Feed".',
      'Copy the link it shows and paste it below.',
      'Every assignment, quiz and exam due date in your courses will flow into your planner.',
    ],
  },
  other: {
    label: 'Outlook or iCloud',
    placeholder: 'https://outlook.office365.com/owa/calendar/.../calendar.ics',
    steps: [
      'Outlook: Settings, Calendar, Shared calendars, Publish a calendar, then copy the ICS link.',
      'iCloud: in the Calendar app, share the calendar as a Public Calendar and copy the link.',
      'Paste it below. Links that start with webcal:// work too.',
    ],
  },
};

export function ConnectCard() {
  const { calendarFeeds, update } = useExtras();
  const [source, setSource] = useState<Source>('google');
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [deadlines, setDeadlines] = useState(true);
  const [busy, setBusy] = useState(false);
  const [routine, setRoutine] = useState<Proposal[] | null>(null);
  const how = HOW_TO[source];

  const connect = async () => {
    if (!url.trim()) return toast('Paste your calendar link first.', 'error');
    setBusy(true);
    try {
      const { feed, added } = await addFeed(url, name, deadlines);
      toast(`Connected ${feed.name}: ${plural(feed.events.length, 'event')}${added ? `, ${plural(added, 'deadline')} added to your planner` : ''}.`);
      setUrl('');
      setName('');
      const r = buildRoutine();
      if (r.length) setRoutine(r);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card id="connect" className="lg:col-span-5">
      <CardHeader title="Connect your calendars" description="Studytime reads your classes and due dates, then plans study time around them. It refreshes every 15 minutes while the app is open." />
      <Segmented label="Calendar" value={source} onChange={(v) => (setSource(v), setDeadlines(v === 'canvas' || deadlines))} options={(Object.keys(HOW_TO) as Source[]).map((k) => ({ value: k, label: HOW_TO[k].label }))} />
      <ol className="mt-4 grid list-decimal gap-1.5 pl-5 text-[14px] leading-[22px] text-ink-2">
        {how.steps.map((s) => <li key={s}>{s}</li>)}
      </ol>
      <Field label="Calendar link" htmlFor="feedUrl"><Input id="feedUrl" value={url} placeholder={how.placeholder} onChange={(e) => setUrl(e.target.value)} /></Field>
      <Field label="Name" hint="optional" htmlFor="feedName"><Input id="feedName" maxLength={40} value={name} placeholder={guessKind(url) === 'canvas' ? 'Canvas' : 'Classes'} onChange={(e) => setName(e.target.value)} /></Field>
      <Checkbox label="Add due dates to my planner as deadlines" checked={deadlines} onChange={(e) => setDeadlines(e.target.checked)} />
      <Button className="mt-3" onClick={connect} loading={busy}>Connect</Button>
      {routine && (
        <div className="mt-5 rounded-xl border border-accent/30 bg-accent-soft p-4">
          <p className="text-[14px] font-semibold">Here is a week built around your classes</p>
          <p className="text-[13px] text-ink-2">A short review after each class and longer blocks on lighter days. Untick anything you do not want.</p>
          <ProposalList proposals={routine} onDone={() => setRoutine(null)} />
        </div>
      )}

      {calendarFeeds.length > 0 && (
        <ul className="mt-6 grid gap-2">
          {calendarFeeds.map((f) => (
            <li key={f.id} className="rounded-xl border border-line p-3">
              <div className="flex items-center gap-2.5">
                <span className="size-3 shrink-0 rounded-full" style={{ background: f.color }} aria-hidden="true" />
                <strong className="min-w-0 flex-1 truncate text-[15px] font-semibold">{f.name}</strong>
                <Badge>{plural(f.events.length, 'event')}</Badge>
              </div>
              <p className={cn('mt-1 text-[13px]', f.error ? 'text-danger' : 'text-muted')}>{f.error || (f.lastSync ? `Updated ${new Date(f.lastSync).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : 'Not loaded yet')}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => refreshFeed(f.id).then((n) => toast(n ? `Updated, ${plural(n, 'new deadline')}.` : 'Updated.'), (e) => toast((e as Error).message, 'error'))}>Refresh</Button>
                <Button size="sm" variant="ghost" onClick={() => update({ calendarFeeds: calendarFeeds.map((x) => (x.id === f.id ? { ...x, addDeadlines: !x.addDeadlines } : x)) })}>{f.addDeadlines ? 'Stop adding deadlines' : 'Add deadlines'}</Button>
                <Button size="sm" variant="ghost" className="text-danger" onClick={() => confirm(`Disconnect ${f.name}?`) && update({ calendarFeeds: calendarFeeds.filter((x) => x.id !== f.id) })}>Disconnect</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Note>Your calendar link is saved in this browser. The server uses it only to download the calendar and does not keep it.</Note>
    </Card>
  );
}

export function PlanCard() {
  const x = useExtras();
  const reminders = useProfile((s) => s.reminders);
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [showPrefs, setShowPrefs] = useState(false);
  const now = useNow();
  const upcoming = x.studyBlocks.filter((b) => b.end > now).slice(0, 8);
  const openDeadlines = reminders.filter((r) => !r.done && r.dueAt > now).length;
  const plan = (horizonDays = 14) => {
    const out = suggestBlocks({ reminders, blocks: x.studyBlocks, busy: busyTimes(x.calendarFeeds), prefs: x.planPrefs, windDown: x.windDown, now: Date.now(), horizonDays });
    setProposals(out);
    if (!out.length) toast(openDeadlines ? 'Every deadline in the next two weeks already has study time, or there was no free time before it.' : 'Add deadlines in Planner or connect Canvas first.');
  };
  const setPref = (k: keyof typeof x.planPrefs, v: string | number) => x.update({ planPrefs: { ...x.planPrefs, [k]: v } });
  return (
    <Card id="plan" className="lg:col-span-7">
      <CardHeader title="Plan my study time" description="Finds free time before each deadline and spreads the work over several days. Exams get 4 blocks, assignments 3, homework 1." action={<Button onClick={() => plan()}>Suggest blocks</Button>} />
      {proposals && <ProposalList key={proposals.length + String(proposals[0]?.start)} proposals={proposals} onDone={() => setProposals(null)} />}
      <button type="button" className="mt-4 text-[14px] font-medium text-accent-ink underline underline-offset-4" onClick={() => setShowPrefs(!showPrefs)} aria-expanded={showPrefs}>{showPrefs ? 'Hide' : 'Show'} planning preferences</button>
      {showPrefs && (
        <FieldRow>
          <Field label="Earliest start" htmlFor="ppStart"><Input id="ppStart" type="time" value={x.planPrefs.dayStart} onChange={(e) => setPref('dayStart', e.target.value)} /></Field>
          <Field label="Latest end" htmlFor="ppEnd"><Input id="ppEnd" type="time" value={x.planPrefs.dayEnd} onChange={(e) => setPref('dayEnd', e.target.value)} /></Field>
          <Field label="Block length" hint="minutes" htmlFor="ppLen"><Select id="ppLen" value={x.planPrefs.blockMinutes} onChange={(e) => setPref('blockMinutes', Number(e.target.value))}>{[25, 30, 45, 50, 60, 90].map((m) => <option key={m} value={m}>{m}</option>)}</Select></Field>
          <Field label="Most study per day" hint="minutes" htmlFor="ppMax"><Select id="ppMax" value={x.planPrefs.maxPerDay} onChange={(e) => setPref('maxPerDay', Number(e.target.value))}>{[60, 90, 120, 180, 240, 300].map((m) => <option key={m} value={m}>{m}</option>)}</Select></Field>
        </FieldRow>
      )}
      <h3 className="mt-6 mb-1 text-[18px]">Coming up</h3>
      {upcoming.length ? upcoming.map((b) => <BlockRow key={b.id} b={b} />) : <Empty>No study blocks yet. Press Suggest blocks to fill your week.</Empty>}
      {x.windDown && <Note>Blocks stop at your wind-down time ({x.windDown}).</Note>}
    </Card>
  );
}

export function CrunchCard() {
  const x = useExtras();
  const reminders = useProfile((s) => s.reminders);
  const [now] = useState(() => Date.now());
  const weeks = weekLoads({ reminders, events: allEvents(x.calendarFeeds), now });
  const max = Math.max(7, ...weeks.map((w) => w.score));
  const crunch = weeks.filter(isCrunch);
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const prep = (weekStart: number) => {
    const days = Math.ceil((weekStart + 7 * DAY - now) / DAY);
    setProposals(suggestBlocks({ reminders, blocks: x.studyBlocks, busy: busyTimes(x.calendarFeeds), prefs: x.planPrefs, windDown: x.windDown, now, horizonDays: days }).filter((p) => p.start < weekStart + 7 * DAY));
  };
  return (
    <Card className="lg:col-span-7">
      <CardHeader title="Busy weeks ahead" description="Exams count 3, assignments 2, homework 1. Two exams or a load of 7 in one week is a crunch week." />
      <div className="flex h-32 items-end gap-1.5" role="img" aria-label={`Workload for the next 12 weeks. ${crunch.length ? `${plural(crunch.length, 'crunch week')}.` : 'No crunch weeks.'}`}>
        {weeks.map((w, i) => (
          <div key={w.weekStart} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`Week of ${new Date(w.weekStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}: ${w.items.map((i) => i.title).join(', ') || 'nothing due'}`}>
            <div className={cn('w-full rounded-t-md', isCrunch(w) ? 'bg-danger' : w.score ? 'bg-accent' : 'bg-line')} style={{ height: w.score ? `${Math.max(8, (w.score / max) * 100)}%` : '3px' }} />
            <span className={cn('tnum text-[11px] whitespace-nowrap text-muted', i % 2 === 1 && 'max-sm:invisible')}>{new Date(w.weekStart).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}</span>
          </div>
        ))}
      </div>
      {crunch.length ? (
        <ul className="mt-4 grid gap-2">
          {crunch.slice(0, 3).map((w) => (
            <li key={w.weekStart} className="rounded-xl bg-danger-soft p-3 text-[14px]">
              <strong className="font-semibold text-danger">Week of {new Date(w.weekStart).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}</strong>
              <span className="text-ink-2">: {w.items.map((i) => i.title).join(', ')}. Start preparing the week before.</span>
              <div className="mt-2"><Button size="sm" variant="secondary" onClick={() => prep(w.weekStart)}>Plan prep for this week</Button></div>
            </li>
          ))}
        </ul>
      ) : <Note>No crunch weeks in the next 12 weeks based on your deadlines and calendars.</Note>}
      {proposals && (proposals.length ? <ProposalList key={String(proposals[0].start)} proposals={proposals} onDone={() => setProposals(null)} /> : <Note>Those deadlines already have study blocks.</Note>)}
    </Card>
  );
}

export function ReviewCard() {
  const x = useExtras();
  const reminders = useProfile((s) => s.reminders);
  const sets = useLearning((s) => s.sets);
  const now = useNow();
  const exams = reminders.filter((r) => !r.done && r.type === 'exam' && r.dueAt > now).sort((a, b) => a.dueAt - b.dueAt);
  const [examId, setExamId] = useState('');
  const [setId, setSetId] = useState('');
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const exam = exams.find((e) => e.id === examId) ?? exams[0];
  const set = sets.find((s) => s.id === setId) ?? sets[0];
  return (
    <Card className="lg:col-span-5">
      <CardHeader title="Flashcard reviews" description="Have a flashcard set for this exam? Short reviews spread over the days before it help you remember more than one long cram." />
      {exams.length ? (
        <>
          <ul className="grid gap-2">
            {exams.slice(0, 3).map((e) => {
              const days = Math.round((startOfDay(e.dueAt) - startOfDay(now)) / DAY);
              return (
                <li key={e.id} className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2">
                  <span className="min-w-0 truncate text-[15px] font-semibold">{e.title}</span>
                  <span className="tnum shrink-0 text-[14px] text-muted">{days <= 0 ? 'Today' : days === 1 ? 'Tomorrow' : `in ${days} days`}</span>
                </li>
              );
            })}
          </ul>
          <FieldRow>
            <Field label="Exam" htmlFor="rvExam"><Select id="rvExam" value={exam?.id} onChange={(e) => setExamId(e.target.value)}>{exams.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}</Select></Field>
            <Field label="Flashcard set" htmlFor="rvSet"><Select id="rvSet" value={set?.id} onChange={(e) => setSetId(e.target.value)}>{sets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
          </FieldRow>
          <Button className="mt-4" variant="secondary" disabled={!exam || !set} onClick={() => {
            const out = reviewPlan({ setName: set.name, setId: set.id, examAt: exam.dueAt, now: Date.now(), busy: busyTimes(x.calendarFeeds), planned: x.studyBlocks, prefs: x.planPrefs, windDown: x.windDown });
            setProposals(out);
            if (!out.length) toast('The exam is too soon to space out reviews. Study the set today.');
          }}>Plan reviews</Button>
          {proposals && <ProposalList key={proposals.length} proposals={proposals} onDone={() => setProposals(null)} />}
        </>
      ) : <Empty>No upcoming exams. Add one in Planner, or connect Canvas to bring them in.</Empty>}
    </Card>
  );
}

export function SubscribeCard() {
  const { outgoingFeed, update } = useExtras();
  const [busy, setBusy] = useState(false);
  const [app, setApp] = useState<'google' | 'apple' | 'outlook'>('google');
  const create = async () => {
    setBusy(true);
    try {
      const { token } = await api.calendar.saveFeed(null, []);
      update({ outgoingFeed: { token } });
      await syncOutgoing();
      toast('Subscribe link ready.');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const steps = {
    google: ['Open Google Calendar on a computer.', 'Next to "Other calendars" on the left, click + then "From URL".', 'Paste the link and click Add calendar. Google refreshes it every few hours.'],
    apple: ['On iPhone: Settings, Calendar, Accounts, Add Account, Other, Add Subscribed Calendar.', 'On Mac: Calendar app, File, New Calendar Subscription.', 'Paste the link and save.'],
    outlook: ['Open Outlook calendar on the web.', 'Click Add calendar, then Subscribe from web.', 'Paste the link and import.'],
  }[app];
  return (
    <Card className="lg:col-span-5">
      <CardHeader title="See your plan on your phone" description="Subscribe to Studytime from Google, Apple or Outlook Calendar. Study blocks and due dates show up there and stay in sync." />
      {outgoingFeed ? (
        <>
          <div className="flex gap-2">
            <Input readOnly aria-label="Subscribe link" value={feedUrl(outgoingFeed.token)} onFocus={(e) => e.target.select()} />
            <Button variant="secondary" onClick={() => copyText(feedUrl(outgoingFeed.token)).then(() => toast('Link copied.'))}><Icon name="copy" className="size-4" /> Copy</Button>
          </div>
          <div className="mt-4"><Segmented label="Calendar app" value={app} onChange={setApp} options={[{ value: 'google', label: 'Google' }, { value: 'apple', label: 'Apple' }, { value: 'outlook', label: 'Outlook' }]} /></div>
          <ol className="mt-3 grid list-decimal gap-1.5 pl-5 text-[14px] leading-[22px] text-ink-2">{steps.map((s) => <li key={s}>{s}</li>)}</ol>
          <Button variant="ghost" size="sm" className="mt-3 text-danger" onClick={async () => {
            if (!confirm('Turn off the subscribe link? Calendars subscribed to it will stop updating.')) return;
            await api.calendar.deleteFeed(outgoingFeed.token).catch(() => undefined);
            update({ outgoingFeed: null });
          }}>Turn off link</Button>
          <Note>Anyone with this link can see your study blocks and due dates, so keep it to yourself.</Note>
        </>
      ) : (
        <Button onClick={create} loading={busy}>Create my subscribe link</Button>
      )}
    </Card>
  );
}
