'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { useAccount } from '@/features/auth/account';
import { InviteCard } from '@/features/auth/invite-card';
import { allEvents } from '@/features/calendar/sync';
import { toneFor } from '@/features/chat/live';
import { useDropComposer } from '@/features/drop/composer';
import { PrimaryAction } from '@/features/drop/drop-sheet';
import { useDrops, whenLabel } from '@/features/drop/live';
import { HighlightCard } from '@/features/feed/highlights';
import { api } from '@/lib/api';
import { courseChannel } from '@/lib/chat-ids';
import { useExtras } from '@/lib/stores/extras';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import type { FeedPost } from '@/lib/types';
import { useNow } from '@/lib/use-now';
import { cn, fmtMinutes, plural } from '@/lib/utils';
import { courseKey, isFor } from './logic';

type Data = Awaited<ReturnType<typeof api.courses.get>>;
const DAY = 86_400_000;

/** One class: what is due, who is studying it right now, classmates, and their highlights. */
export function ClassPage() {
  const code = decodeURIComponent(String(useParams<{ code: string }>().code ?? ''));
  const key = courseKey(code);
  const p = useProfile();
  const feeds = useExtras((s) => s.calendarFeeds);
  const drops = useDrops((s) => s.drops);
  const user = useAccount((s) => s.user);
  const now = useNow(60_000);
  const [data, setData] = useState<Data | null>(null);
  useEffect(() => {
    api.courses.get(key).then(setData, (e) => (toast((e as Error).message, 'error'), setData({ course: key, members: [], posts: [] })));
  }, [key]);
  const onProfile = p.courses.some((c) => courseKey(c) === key);

  const due = [
    ...p.reminders.filter((r) => !r.done && r.dueAt > now && isFor(r.title, key)).map((r) => ({ id: r.id, title: r.title, at: r.dueAt, exam: r.type === 'exam' })),
    ...allEvents(feeds).filter((e) => e.start > now && e.start < now + 30 * DAY && isFor(e.title, key) && (e.allDay || /\b(exam|midterm|final|quiz|test|due|assignment|homework|hw|project|paper|lab)\b/i.test(e.title))).map((e) => ({ id: e.uid, title: e.title, at: e.start, exam: /\b(exam|midterm|final|quiz|test)\b/i.test(e.title) })),
  ].filter((x, i, all) => all.findIndex((y) => y.title.toLowerCase() === x.title.toLowerCase() && Math.abs(y.at - x.at) < DAY) === i).sort((a, b) => a.at - b.at).slice(0, 8);
  const live = drops.filter((d) => d.endsAt > now && isFor(d.subject, key));
  const days = (at: number) => { const d = Math.round((new Date(at).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / DAY); return d <= 0 ? 'Today' : d === 1 ? 'Tomorrow' : `in ${d} days`; };
  const others = (data?.members ?? []).filter((m) => !m.me);

  return (
    <>
      <header className="mt-4 mb-5 flex flex-wrap items-end justify-between gap-3 max-sm:mt-2">
        <div>
          <Link href="/drop?tab=highlights" className="text-[12px] font-medium text-muted hover:text-ink">Classes</Link>
          <h1 className="text-[28px] leading-9 max-sm:text-[22px]">{key}</h1>
          <p className="text-[13px] text-muted">{data ? `${plural(others.length, 'classmate')} on Studytime${p.school ? ` at ${p.school}` : ''}` : 'Loading'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!onProfile && <Button variant="secondary" onClick={() => (p.update({ courses: [...p.courses, key].slice(0, 12) }), toast(`${key} added to your classes.`))}><Icon name="plus" className="size-4" /> Add to my classes</Button>}
          <Link href={`/drop?tab=friends&channel=${encodeURIComponent(courseChannel(p.school, key))}`}><Button variant="secondary"><Icon name="chat" className="size-4" /> Class chat</Button></Link>
          <Button onClick={() => useDropComposer.getState().show({ subject: key })}><Icon name="pin" className="size-4" /> Drop a spot for {key}</Button>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] [&>*]:min-w-0">
        <div className="grid content-start gap-4">
          <section className="rounded-xl border border-line bg-surface p-5">
            <div className="flex items-center justify-between"><h2 className="font-sans text-[15px] font-semibold">Coming up</h2><Link href="/calendar?plan=exams"><Button size="sm" variant="ghost">Exam prep</Button></Link></div>
            {due.length ? (
              <ul className="mt-1 divide-y divide-line">
                {due.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 py-2.5">
                    <span className={cn('w-12 shrink-0 rounded-md py-0.5 text-center text-[11px] font-semibold', d.exam ? 'bg-danger-soft text-danger' : 'bg-warn-soft text-warn')}>{d.exam ? 'Exam' : 'Due'}</span>
                    <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{d.title}</span>
                    <span className="tnum shrink-0 text-[12px] text-muted">{days(d.at)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-1 text-[13px] text-muted">Nothing due for {key} in the next month. Connect Canvas in Calendar to bring in assignments and exams.</p>}
          </section>

          {live.length > 0 && (
            <section className="rounded-xl border border-line bg-surface p-5">
              <h2 className="font-sans text-[15px] font-semibold">Studying {key} now</h2>
              <ul className="mt-1 divide-y divide-line">
                {live.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 py-2.5">
                    <Avatar name={d.name} size={30} />
                    <Link href={`/drop?d=${d.id}`} className="min-w-0 flex-1"><span className="block truncate text-[14px]"><span className="font-semibold">{d.name}</span> <span className="text-muted">at</span> {d.spotName}</span><span className="tnum block text-[12px] text-muted">{whenLabel(d, now)}</span></Link>
                    <PrimaryAction d={d} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="mb-2 font-sans text-[15px] font-semibold">Highlights from {key}</h2>
            {data?.posts.length ? (
              <div className="grid gap-3">{data.posts.map((post) => <HighlightCard key={post.id} post={post} onChange={(np: FeedPost | null) => setData((d) => d && { ...d, posts: np ? d.posts.map((x) => (x.id === post.id ? np : x)) : d.posts.filter((x) => x.id !== post.id) })} />)}</div>
            ) : <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-[13px] text-muted">No highlights for {key} yet. When you save a session, put {key} in what you studied and it shows up here.</p>}
          </section>
        </div>

        <aside className="grid content-start gap-4">
          <section className="rounded-xl border border-line bg-surface p-4">
            <h2 className="font-sans text-[15px] font-semibold">Classmates this week</h2>
            <p className="text-[12px] text-muted">Ranked by highlighted study time in {key}.</p>
            {data && data.members.length ? (
              <ol className="mt-2 divide-y divide-line">
                {data.members.slice(0, 15).map((m, i) => (
                  <li key={m.id} className={cn('flex items-center gap-2.5 py-2', m.me && 'font-semibold')}>
                    <span className="tnum w-5 text-[12px] text-muted">{i + 1}</span>
                    <Avatar name={m.name} color={toneFor(m.id)} size={26} />
                    <span className="min-w-0 flex-1 truncate text-[13px]">{m.name}</span>
                    <span className="tnum text-[12px] text-muted">{fmtMinutes(m.weekMinutes)}</span>
                    {!m.me && !m.following && user && <button type="button" className="text-[12px] font-medium text-accent-ink hover:underline" onClick={() => api.people.follow(m.id, true).then(() => setData((d) => d && { ...d, members: d.members.map((x) => (x.id === m.id ? { ...x, following: true } : x)) }), (e) => toast((e as Error).message, 'error'))}>Follow</button>}
                  </li>
                ))}
              </ol>
            ) : <p className="mt-2 text-[13px] text-muted">{data ? 'No classmates yet. Share your invite link in the class group chat.' : 'Loading'}</p>}
          </section>
          <InviteCard />
        </aside>
      </div>
    </>
  );
}
