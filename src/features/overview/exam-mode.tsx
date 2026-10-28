'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { useStartBlock, timeRange } from '@/features/calendar/block-row';
import { readiness, type Topic } from '@/features/calendar/exam-prep';
import { useExams } from '@/features/calendar/exam-prep-card';
import { startOfDay } from '@/features/calendar/plan';
import { useExtras } from '@/lib/stores/extras';
import { useLearning } from '@/lib/stores/learning';
import { useNow } from '@/lib/use-now';
import { cn } from '@/lib/utils';

const DAY = 86_400_000;

/** In the week before an exam, Home leads with it: countdown, today's prep, and the weakest topic. */
export function ExamMode() {
  const exams = useExams();
  const now = useNow(60_000);
  const preps = useExtras((s) => s.examPreps);
  const blocks = useExtras((s) => s.studyBlocks);
  const mistakes = useLearning((s) => s.mistakes.length);
  const start = useStartBlock();
  const exam = exams.find((e) => e.at - now < 7 * DAY);
  if (!exam) return null;
  const days = Math.round((startOfDay(exam.at) - startOfDay(now)) / DAY);
  const topics = (preps[exam.key]?.topics ?? []) as Topic[];
  const ready = readiness(topics, blocks, exam.key);
  const today = blocks.filter((b) => b.reminderId === exam.key && b.source === 'exam' && !b.done && startOfDay(b.start) === startOfDay(now));
  const weakest = topics.find((t) => t.conf === 'new') ?? topics.find((t) => t.conf === 'shaky');
  const quiz = `/study?tool=chat&ask=${encodeURIComponent(`Quiz me on ${weakest?.name ?? exam.title} for my ${exam.title}. One question at a time, at exam level, and tell me what I got wrong.`)}`;

  return (
    <section className="relative overflow-hidden rounded-xl border border-accent/30 bg-surface p-5 lg:col-span-12">
      <div className="pointer-events-none absolute -top-20 -right-16 size-56 rounded-full bg-accent-soft" aria-hidden="true" />
      <div className="relative flex flex-wrap items-start gap-5">
        <div className="min-w-[150px]">
          <p className="text-[12px] font-semibold tracking-wide text-accent-ink uppercase">Exam mode</p>
          <p className="tnum text-[40px] leading-[44px] font-semibold tracking-tight">{days <= 0 ? 'Today' : days === 1 ? '1 day' : `${days} days`}</p>
          <p className="max-w-[260px] truncate text-[14px] font-medium">{exam.title}</p>
          {ready !== null && (
            <div className="mt-2 w-40">
              <div className="flex justify-between text-[11px] text-muted"><span>Ready</span><span className="tnum">{ready}%</span></div>
              <span className="mt-0.5 block h-1.5 overflow-hidden rounded-full bg-surface-3"><span className={cn('block h-full rounded-full', ready >= 75 ? 'bg-ok' : 'bg-accent-fill')} style={{ width: `${ready}%` }} /></span>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold">Today</p>
          {today.length ? (
            <ul className="mt-1 grid gap-1.5">
              {today.map((b) => (
                <li key={b.id} className="flex items-center gap-2 text-[14px]">
                  <span className="min-w-0 flex-1 truncate">{b.title}</span>
                  <span className="tnum shrink-0 text-[12px] text-muted">{timeRange(b).split(', ').pop()}</span>
                  <Button size="sm" variant="secondary" onClick={() => start(b)}>Start</Button>
                </li>
              ))}
            </ul>
          ) : <p className="mt-1 text-[13px] text-muted">{topics.length ? 'No prep session planned for today.' : 'No plan yet. List the topics and get a schedule that finishes the day before.'}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {!topics.length ? <Link href={`/calendar?plan=exams&exam=${encodeURIComponent(exam.key)}`}><Button size="sm">Plan prep</Button></Link> : <Link href={quiz}><Button size="sm"><Icon name="sparkle" className="size-4" /> Quiz me{weakest ? ` on ${weakest.name}` : ''}</Button></Link>}
            {mistakes > 0 && <Link href="/study?tool=mistakes"><Button size="sm" variant="secondary">Review {mistakes} mistake{mistakes === 1 ? '' : 's'}</Button></Link>}
            {topics.length > 0 && <Link href={`/calendar?plan=exams&exam=${encodeURIComponent(exam.key)}`}><Button size="sm" variant="ghost">Topics</Button></Link>}
          </div>
        </div>
      </div>
    </section>
  );
}
