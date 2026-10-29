'use client';
import { DailyLadder } from '@/features/rewards/daily-ladder';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { readiness, type Topic } from '@/features/calendar/exam-prep';
import { isPastWindDown } from '@/features/calendar/sync';
import { useDropComposer } from '@/features/drop/composer';
import { PrimaryAction } from '@/features/drop/drop-sheet';
import { useDrops, whenLabel } from '@/features/drop/live';
import { hotSpots } from '@/features/drop/logic';
import { minutesOn, weekMinutes } from '@/features/focus/logic';
import { PetCompanion, useGarden } from '@/features/garden/garden-page';
import { logWater } from '@/features/wellbeing/water';
import { useExtras } from '@/lib/stores/extras';
import { useProfile } from '@/lib/stores/profile';
import { useNow } from '@/lib/use-now';
import { cn, dateKey, fmtMinutes, plural, todayKey } from '@/lib/utils';
import { ExamMode } from './exam-mode';
import { Nudges } from './nudges';

function greeting(h: number) {
  return h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function Ring({ frac, children }: { frac: number; children: React.ReactNode }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-[116px] shrink-0">
      <svg viewBox="0 0 108 108" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="54" cy="54" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="8" />
        <circle cx="54" cy="54" r={r} fill="none" stroke="var(--accent-fill)" strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, frac))} style={{ transition: 'stroke-dashoffset 600ms ease' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

/** The one thing to do now: start a focus session. Today's progress and water sit beside it. */
function FocusHero() {
  const p = useProfile();
  const router = useRouter();
  const windDown = useExtras((s) => s.windDown);
  const glasses = useExtras((s) => s.water[todayKey()] ?? 0);
  const waterGoal = useExtras((s) => s.waterGoal);
  const today = minutesOn(p.sessions, todayKey());
  const start = (min?: number) => {
    if (p.timer.mode !== 'ready') return router.push('/focus');
    if (isPastWindDown(windDown) && !confirm(`It is past your wind-down time (${windDown}). Start anyway?`)) return;
    if (min) p.setDuration(min);
    p.startOrPause();
    router.push('/focus');
  };
  return (
    <section className="relative overflow-hidden rounded-xl border border-line bg-surface p-6 max-sm:p-5 lg:col-span-7">
      <div className="pointer-events-none absolute -top-24 -left-20 size-64 rounded-full bg-accent-soft opacity-70" aria-hidden="true" />
      <div className="relative flex flex-wrap items-center gap-6">
        <Ring frac={today / Math.max(1, p.dailyGoal)}>
          <div>
            <p className="tnum text-[20px] leading-6 font-semibold">{fmtMinutes(today)}</p>
            <p className="text-[11px] text-muted">of {fmtMinutes(p.dailyGoal)}</p>
          </div>
        </Ring>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-muted">{p.timer.mode === 'running' ? 'Focusing now' : p.timer.mode === 'paused' ? 'Paused' : 'Ready when you are'}</p>
          <p className="tnum text-[44px] leading-[48px] font-semibold tracking-tight">{clock(p.timer.remaining)}</p>
          <p className="truncate text-[13px] text-muted">{p.subject || 'No subject picked'}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => start()}>{p.timer.mode === 'ready' ? 'Start focus' : 'Open timer'}</Button>
            {p.timer.mode === 'ready' && <Button variant="secondary" onClick={() => start(5)}>Just 5 minutes</Button>}
          </div>
        </div>
      </div>
      <div className="relative mt-5 flex items-center gap-3 border-t border-line pt-4 text-[13px]">
        <Icon name="drop" className="size-4 text-accent" />
        <span className="flex-1 text-ink-2"><span className="tnum font-semibold">{glasses}</span> of {waterGoal} glasses of water</span>
        <Button size="sm" variant="ghost" onClick={() => logWater(1)}>+ 1 glass</Button>
      </div>
    </section>
  );
}

/** Who is out studying right now, top three, with one tap to join or drop your own spot. */
function OutNow() {
  const drops = useDrops((s) => s.drops);
  const now = useNow(60_000);
  const live = drops.filter((d) => d.startsAt <= now);
  const people = live.reduce((n, d) => n + 1 + d.joiners.length, 0);
  const hot = hotSpots(drops, now)[0];
  const show = useDropComposer.getState().show;
  const list = [...live, ...drops.filter((d) => d.startsAt > now)].slice(0, 3);
  return (
    <section className="flex flex-col rounded-xl border border-line bg-surface p-5 max-sm:p-4 lg:col-span-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-sans text-[15px] leading-6 font-semibold">Out studying now</h2>
          <p className="truncate text-[12px] text-muted">{live.length ? <><span className="mr-1 inline-block size-1.5 rounded-full bg-ok align-middle" />{plural(people, 'person', 'people')} at {plural(live.length, 'spot')}{hot && hot.people > 1 ? ` · busiest: ${hot.name}` : ''}</> : 'No one is out yet. Be the first.'}</p>
        </div>
        <Link href="/drop"><Button size="sm" variant="ghost">Map</Button></Link>
      </div>
      {list.length ? (
        <ul className="mt-2 flex-1 divide-y divide-line">
          {list.map((d) => (
            <li key={d.id} className="flex items-center gap-3 py-2.5">
              <Avatar name={d.name} size={30} />
              <Link href={`/drop?d=${d.id}`} className="min-w-0 flex-1">
                <span className="block truncate text-[14px]"><span className="font-semibold">{d.name}</span> <span className="text-muted">at</span> {d.spotName}</span>
                <span className="tnum block truncate text-[12px] text-muted">{d.startsAt <= now ? <span className="font-medium text-ok">Live · </span> : null}{whenLabel(d, now)}</span>
              </Link>
              <PrimaryAction d={d} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex-1 py-4 text-[13px] leading-5 text-muted">Drop where you are studying and classmates can pull up a chair.</p>
      )}
      <Button className="mt-3" block onClick={() => show()}><Icon name="pin" className="size-4" /> Drop a spot</Button>
    </section>
  );
}

/** Deadlines and planned study blocks, merged and in order. Four at most. */
function UpNext() {
  const reminders = useProfile((s) => s.reminders);
  const blocks = useExtras((s) => s.studyBlocks);
  const preps = useExtras((s) => s.examPreps);
  const now = useNow(60_000);
  const items = [
    ...reminders.filter((r) => !r.done && r.dueAt > now).map((r) => ({ id: r.id, at: r.dueAt, title: r.title, kind: r.type === 'exam' ? 'Exam' : 'Due', href: r.type === 'exam' ? `/calendar?plan=exams&exam=${r.id}` : '/calendar', ready: r.type === 'exam' ? readiness((preps[r.id]?.topics ?? []) as Topic[], blocks, r.id) : null })),
    ...blocks.filter((b) => !b.done && b.end > now).map((b) => ({ id: b.id, at: b.start, title: b.title, kind: 'Study', href: '/calendar', ready: null })),
  ].sort((a, b) => a.at - b.at).slice(0, 4);
  const when = (t: number) => {
    const d = Math.round((new Date(t).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 86_400_000);
    const time = new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    return d <= 0 ? `Today ${time}` : d === 1 ? `Tomorrow ${time}` : new Date(t).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };
  return (
    <section className="rounded-xl border border-line bg-surface p-5 max-sm:p-4 lg:col-span-7">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-sans text-[15px] leading-6 font-semibold">Up next</h2>
        <Link href="/calendar"><Button size="sm" variant="ghost">Calendar</Button></Link>
      </div>
      {items.length ? (
        <ul className="mt-1 divide-y divide-line">
          {items.map((i) => (
            <li key={i.id}>
              <Link href={i.href} className="flex items-center gap-3 py-2.5">
                <span className={cn('w-12 shrink-0 rounded-md py-0.5 text-center text-[11px] font-semibold', i.kind === 'Exam' ? 'bg-danger-soft text-danger' : i.kind === 'Due' ? 'bg-warn-soft text-warn' : 'bg-accent-soft text-accent-ink')}>{i.kind}</span>
                <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{i.title}</span>
                {i.kind === 'Exam' && <span className={cn('tnum shrink-0 text-[12px] font-medium', i.ready === null ? 'text-accent-ink' : 'text-ink-2')}>{i.ready === null ? 'Plan prep' : `${i.ready}% ready`}</span>}
                <span className="tnum shrink-0 text-[12px] text-muted">{when(i.at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-3 text-[13px] text-muted">Nothing coming up. Connect Canvas or add a deadline in <Link href="/calendar" className="font-medium text-accent-ink underline underline-offset-4">Calendar</Link>.</p>
      )}
    </section>
  );
}

/** This week at a glance: one bar per day, and a nudge toward rewards waiting to be opened. */
function WeekStrip() {
  const sessions = useProfile((s) => s.sessions);
  const now = useNow(60_000);
  const g = useGarden();
  const d = new Date(now);
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    return { key: dateKey(day), label: day.toLocaleDateString(undefined, { weekday: 'narrow' }), min: minutesOn(sessions, dateKey(day)) };
  });
  const max = Math.max(30, ...days.map((x) => x.min));
  const todayK = todayKey();
  return (
    <section className="rounded-xl border border-line bg-surface p-5 max-sm:p-4 lg:col-span-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-sans text-[15px] leading-6 font-semibold">This week</h2>
        <span className="tnum text-[13px] text-muted">{fmtMinutes(weekMinutes(sessions, d))}</span>
      </div>
      <div className="mt-3 flex h-[72px] items-end gap-2" role="img" aria-label="Focus minutes for each day this week">
        {days.map((x) => (
          <div key={x.key} className="flex flex-1 flex-col items-center gap-1">
            <span className={cn('w-full rounded-[4px]', x.key === todayK ? 'bg-accent-fill' : x.min ? 'bg-accent/45' : 'bg-surface-3')} style={{ height: `${Math.max(4, (x.min / max) * 56)}px` }} title={`${fmtMinutes(x.min)}`} />
            <span className={cn('text-[11px]', x.key === todayK ? 'font-semibold text-ink' : 'text-muted')}>{x.label}</span>
          </div>
        ))}
      </div>
      <Link href="/leaderboard?tab=garden" className="mt-4 flex items-center gap-2 border-t border-line pt-3 text-[13px] text-ink-2 hover:text-ink">
        <Icon name={g.packs ? 'rewards' : 'sparkle'} className="size-4 text-accent" />
        <span className="flex-1">{g.packs ? `${plural(g.packs, 'mystery pack')} waiting` : `Your tree: ${g.tree.name}${g.tree.next ? `, ${fmtMinutes(g.tree.next.need)} to ${g.tree.next.name}` : ''}`}</span>
        <Icon name="chevron" className="size-4 text-muted" />
      </Link>
    </section>
  );
}

/** Shown until today's check-in reward is collected. */
function TodayReward() {
  const claimed = useExtras((s) => s.rewardDays.includes(todayKey()));
  if (claimed) return null;
  return <DailyLadder checkInHref="/you" className="lg:col-span-12" />;
}

export function Overview() {
  const name = useProfile((s) => s.name);
  const now = useNow(60_000);
  const first = name && name !== 'Student' ? `, ${name.split(' ')[0]}` : '';
  return (
    <>
      <header className="mt-4 mb-6 flex flex-wrap items-end justify-between gap-4 max-sm:mt-2">
        <div>
          <h1 className="text-[28px] leading-9 max-sm:text-[22px]">{greeting(new Date(now).getHours())}{first}</h1>
          <p className="text-[13px] text-muted">{new Date(now).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
        <PetCompanion className="max-sm:hidden" />
      </header>
      <div className="grid gap-4 lg:grid-cols-12 [&>*]:min-w-0">
        <ExamMode />
        <Nudges />
        <TodayReward />
        <FocusHero />
        <OutNow />
        <UpNext />
        <WeekStrip />
      </div>
    </>
  );
}
