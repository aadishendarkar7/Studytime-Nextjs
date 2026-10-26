'use client';
import { Icon } from '@/components/ui/icons';
import type { Reminder, Session } from '@/lib/types';
import { useNow } from '@/lib/use-now';
import { cn, shortDate } from '@/lib/utils';

export const REMINDER_TYPES = { homework: 'Homework', exam: 'Exam', assignment: 'Assignment' } as const;
export const LEAD_NAMES: Record<number, string> = { 0: 'at the due time', 60: '1 hour before', 1440: '1 day before', 10080: '1 week before' };

export const CALMING_THOUGHTS = [
  'You only need to focus on the next small step.',
  'It is okay to pause. Take one breath, then begin again.',
  'A difficult chapter does not mean you are not capable.',
  'Progress still counts when it feels slow.',
  'You can learn at your own pace. One idea at a time.',
  'You have handled hard moments before. Be patient with this one.',
];

export function SessionRow({ s }: { s: Session }) {
  return (
    <div className="flex items-center gap-3 border-b border-line py-3 last:border-0">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-ink"><Icon name="clock" className="size-4" /></span>
      <span className="min-w-0 flex-1">
        <strong className="block truncate text-sm text-ink">{s.subject || 'Study session'}</strong>
        <small className="text-xs text-muted">{shortDate(s.at)} · {s.minutes} min{s.location ? ` · ${s.location}` : ''}</small>
      </span>
      <span className="text-xs font-bold text-accent-ink">+{s.points} pts</span>
    </div>
  );
}

export function ReminderRow({ r, actions }: { r: Reminder; actions?: React.ReactNode }) {
  const now = useNow();
  const overdue = !r.done && r.dueAt < now;
  const due = new Date(r.dueAt).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  return (
    <div className={cn('flex flex-wrap items-center gap-3 border-b border-line py-3 last:border-0', r.done && 'opacity-55')}>
      <span className={cn('rounded-lg px-2 py-1 text-[11px] font-bold', r.type === 'exam' ? 'bg-warn-soft text-warn' : 'bg-accent-soft text-accent-ink')}>{REMINDER_TYPES[r.type]}</span>
      <span className="min-w-0 flex-1">
        <strong className={cn('block text-sm text-ink', r.done && 'line-through')}>{r.title}</strong>
        <small className={cn('text-xs', overdue ? 'font-semibold text-danger' : 'text-muted')}>
          {overdue ? 'Overdue · ' : 'Due '}
          {due} · Remind {LEAD_NAMES[r.lead] ?? 'at the due time'}
        </small>
      </span>
      {actions}
    </div>
  );
}
