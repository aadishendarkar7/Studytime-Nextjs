'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icons';
import { BlockRow } from '@/features/calendar/block-row';
import { isCrunch, startOfDay, weekLoads } from '@/features/calendar/plan';
import { upcomingExams } from '@/features/calendar/exam-prep';
import { missedBlocks } from '@/features/calendar/routine';
import { allEvents, isPastWindDown } from '@/features/calendar/sync';
import { resetDue } from '@/features/reset/reset-page';
import { strainCheck } from '@/features/wellbeing/logic';
import { useExtras } from '@/lib/stores/extras';
import { useProfile } from '@/lib/stores/profile';
import { cn, todayKey } from '@/lib/utils';

function Nudge({ icon, title, body, href, action, tone = 'default' }: { icon: IconName; title: string; body: string; href: string; action: string; tone?: 'default' | 'warn' }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3', tone === 'warn' ? 'border-warn/25 bg-warn-soft' : 'border-line bg-surface')}>
      <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', tone === 'warn' ? 'bg-surface text-warn' : 'bg-surface-3 text-ink-2')}><Icon name={icon} className="size-4" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold">{title}</p>
        <p className="text-[13px] leading-5 text-muted">{body}</p>
      </div>
      <Link href={href}><Button size="sm" variant="secondary">{action}</Button></Link>
    </div>
  );
}

/** Only the nudges that apply right now, most important first. Home shows only the top one so it stays calm. */
export function Nudges() {
  const p = useProfile();
  const x = useExtras();
  const [now] = useState(() => new Date());
  const today = todayKey();
  const list: React.ReactNode[] = [];

  const strain = strainCheck({ sessions: p.sessions, checkins: x.checkins, today });
  if (strain.kind !== 'none') list.push(<Nudge key="strain" tone="warn" icon="heart" title="Go easy on yourself this week" body={strain.kind === 'low' ? 'Your check-ins show a heavy week. Rest counts too.' : 'You are studying a lot more while your mood is dropping. Plan a rest day.'} href="/help" action="Support" />);
  const exam = upcomingExams({ reminders: p.reminders, events: allEvents(x.calendarFeeds), now: now.getTime() }).find((e) => e.at - now.getTime() < 14 * 86_400_000 && !x.examPreps[e.key]?.topics.length);
  if (exam) {
    const days = Math.max(0, Math.round((startOfDay(exam.at) - startOfDay(now.getTime())) / 86_400_000));
    list.push(<Nudge key="exam" icon="calendar" title={`${exam.title} is ${days <= 1 ? (days ? 'tomorrow' : 'today') : `in ${days} days`}`} body="List what is on it and get a study plan that finishes the day before." href={`/calendar?plan=exams&exam=${encodeURIComponent(exam.key)}`} action="Plan prep" />);
  }
  const missed = missedBlocks(x.studyBlocks, now.getTime()).length;
  if (missed) list.push(<Nudge key="missed" icon="clock" title={`${missed} missed study block${missed === 1 ? '' : 's'}`} body="Happens to everyone. Move them to your next free time in one tap." href="/calendar?plan=routine" action="Catch up" />);
  if (isPastWindDown(x.windDown, now)) list.push(<Nudge key="wind" icon="clock" title="Time to wind down" body="Sleep is when your brain stores what you studied. Tomorrow's plan is on your calendar." href="/calendar" action="See tomorrow" />);
  if (!x.checkins.some((c) => c.day === today)) list.push(<Nudge key="checkin" icon="heart" title="How are you today?" body="Thirty seconds on mood, stress and sleep. Over time it shows what helps." href="/you" action="Check in" />);
  if (resetDue(x.resets, now)) list.push(<Nudge key="reset" icon="reset" title="Weekly reset" body="Look back at this week and plan the next one. About ten minutes." href="/you?tab=reset" action="Start reset" />);
  const crunch = weekLoads({ reminders: p.reminders, events: allEvents(x.calendarFeeds), now: now.getTime(), weeks: 3 }).find((w) => isCrunch(w) && w.weekStart > now.getTime());
  if (crunch) list.push(<Nudge key="crunch" tone="warn" icon="calendar" title={`Busy week ahead: ${new Date(crunch.weekStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`} body={`${crunch.items.map((i) => i.title).slice(0, 3).join(', ')}. Start preparing this week.`} href="/calendar?plan=busy" action="Plan prep" />);

  if (!list.length) return null;
  return <div className="grid gap-2 lg:col-span-12">{list[0]}</div>;
}

export function NextUp({ className }: { className?: string }) {
  const { studyBlocks } = useExtras();
  const reminders = useProfile((s) => s.reminders);
  const [now] = useState(() => Date.now());
  const tomorrowEnd = startOfDay(now) + 2 * 86_400_000;
  const blocks = studyBlocks.filter((b) => !b.done && b.end > now && b.start < tomorrowEnd).slice(0, 4);
  const exams = reminders.filter((r) => !r.done && r.type === 'exam' && r.dueAt > now).sort((a, b) => a.dueAt - b.dueAt).slice(0, 2);
  return (
    <section className={cn('rounded-xl border border-line bg-surface p-5 max-sm:p-4', className)}>
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="font-sans text-[15px] leading-6 font-semibold">Next up</h2>
        <Link href="/calendar"><Button variant="ghost" size="sm">Calendar</Button></Link>
      </div>
      {blocks.length ? blocks.map((b) => <BlockRow key={b.id} b={b} compact />) : (
        <p className="py-2 text-[13px] text-muted">No study blocks today or tomorrow. <Link href="/calendar?plan=busy" className="font-medium text-accent-ink underline underline-offset-4">Plan some</Link> around your classes.</p>
      )}
      {exams.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {exams.map((e) => {
            const days = Math.round((startOfDay(e.dueAt) - startOfDay(now)) / 86_400_000);
            return <span key={e.id} className="rounded-md bg-danger-soft px-2 py-0.5 text-[12px] font-medium text-danger">{e.title}: {days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `${days} days`}</span>;
          })}
        </div>
      )}
    </section>
  );
}
