'use client';
import type { Reminder, Session } from '@/lib/types';
import { useNow } from '@/lib/use-now';
import { cn, shortDate } from '@/lib/utils';

export const REMINDER_TYPES = { homework: 'Homework', exam: 'Exam', assignment: 'Assignment' } as const;
export const LEAD_NAMES: Record<number, string> = { 0: 'at the due time', 60: '1 hour before', 1440: '1 day before', 10080: '1 week before' };

const clock = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });

/** One completed session, printed as a log line: date, time, length, subject, place, points. */
export function SessionRow({ s }: { s: Session }) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 border-b border-line py-2.5 text-[13px] leading-5 last:border-0 sm:grid-cols-[8.5rem_4.5rem_1fr_auto]">
      <span className="tnum text-muted max-sm:order-2 max-sm:col-span-2">{shortDate(s.at)}  {clock(s.at)}</span>
      <span className="tnum font-medium text-ink max-sm:order-3">{s.minutes} min</span>
      <span className="min-w-0 truncate text-ink max-sm:order-1">
        {s.subject || 'Study session'}
        {s.location && <span className="text-muted">  {s.location}</span>}
      </span>
      <span className="tnum text-right font-medium text-ink max-sm:order-4">+{s.points}</span>
    </div>
  );
}

export function ReminderRow({ r, actions }: { r: Reminder; actions?: React.ReactNode }) {
  const now = useNow();
  const overdue = !r.done && r.dueAt < now;
  const due = new Date(r.dueAt).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  return (
    <div className={cn('flex flex-wrap items-center gap-3 border-b border-line py-3 last:border-0', r.done && 'opacity-55')}>
      <span className={cn('w-24 shrink-0 border px-2 py-0.5 text-center text-[12px] leading-4 font-medium rounded-xl', r.type === 'exam' ? 'border-line bg-ink text-bg' : 'border-line text-ink-2')}>{REMINDER_TYPES[r.type]}</span>
      <span className="min-w-0 flex-1">
        <strong className={cn('block text-[14px] font-medium text-ink', r.done && 'line-through')}>{r.title}</strong>
        <small className={cn('tnum text-[12px]', overdue ? 'font-medium text-danger' : 'text-muted')}>
          {overdue ? 'Overdue. ' : 'Due '}
          {due}. Reminder {LEAD_NAMES[r.lead] ?? 'at the due time'}.
        </small>
      </span>
      {actions}
    </div>
  );
}
