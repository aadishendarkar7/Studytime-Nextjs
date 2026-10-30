'use client';
import { DailyLadder } from '@/features/rewards/daily-ladder';
import Link from 'next/link';
import BlurText from '@/components/bits/BlurText';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { useDropComposer } from '@/features/drop/composer';
import { PrimaryAction } from '@/features/drop/drop-sheet';
import { useDrops, whenLabel } from '@/features/drop/live';
import { hotSpots } from '@/features/drop/logic';
import { minutesOn, weekMinutes } from '@/features/focus/logic';
import { PetCompanion, useGarden } from '@/features/garden/garden-page';
import { useExtras } from '@/lib/stores/extras';
import { useProfile } from '@/lib/stores/profile';
import { useNow } from '@/lib/use-now';
import { cn, dateKey, fmtMinutes, plural, todayKey } from '@/lib/utils';
import { FocusPanel } from '@/features/focus/focus-page';

function greeting(h: number) {
  return h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
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
    <section className="flex flex-col rounded-xl border border-line bg-surface p-5 max-sm:p-4">
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
    <section className="rounded-xl border border-line bg-surface p-5 max-sm:p-4">
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

/** How are you today: one tap to the check-in, and the reward ladder for coming back daily. */
function CheckInCard() {
  const checkedIn = useExtras((s) => s.checkins.some((c) => c.day === todayKey()));
  return (
    <section className="rounded-xl border border-line bg-surface p-5 max-sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-sans text-[15px] leading-6 font-semibold">{checkedIn ? 'Checked in today' : 'How are you today?'}</h2>
        {!checkedIn && <Link href="/you"><Button size="sm">Check in</Button></Link>}
      </div>
      <DailyLadder className="border-0 bg-transparent p-0" />
    </section>
  );
}

export function Overview() {
  const name = useProfile((s) => s.name);
  const now = useNow(60_000);
  const first = name && name !== 'Student' ? `, ${name.split(' ')[0]}` : '';
  return (
    <>
      <header className="mt-4 mb-6 flex flex-wrap items-end justify-between gap-4 max-sm:mt-2">
        <div>
          <h1 className="text-[28px] leading-9 max-sm:text-[22px]"><BlurText key={greeting(new Date(now).getHours())} text={`${greeting(new Date(now).getHours())}${first}`} trigger="load" delay={90} blur={8} distance={10} /></h1>
          <p className="text-[13px] text-muted">{new Date(now).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
        <PetCompanion className="max-sm:hidden" />
      </header>
      <div className="grid gap-4 lg:grid-cols-12 [&>*]:min-w-0">
        <FocusPanel className="lg:col-span-7 xl:col-span-8" />
        <div className="grid content-start gap-4 lg:col-span-5 xl:col-span-4">
          <CheckInCard />
          <WeekStrip />
          <OutNow />
        </div>
      </div>
    </>
  );
}
