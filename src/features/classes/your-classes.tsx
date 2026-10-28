'use client';
import Link from 'next/link';
import { allEvents } from '@/features/calendar/sync';
import { useExtras } from '@/lib/stores/extras';
import { useProfile } from '@/lib/stores/profile';
import { cn } from '@/lib/utils';
import { myClasses } from './logic';

/** Links to each of your class pages, including classes found in your calendars. */
export function YourClasses({ className }: { className?: string }) {
  const courses = useProfile((s) => s.courses);
  const reminders = useProfile((s) => s.reminders);
  const feeds = useExtras((s) => s.calendarFeeds);
  const list = myClasses(courses, [...reminders.map((r) => r.title), ...allEvents(feeds).map((e) => e.title)]).slice(0, 10);
  return (
    <section className={cn('rounded-xl border border-line bg-surface p-4', className)}>
      <h2 className="font-sans text-[15px] font-semibold">Your classes</h2>
      {list.length ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {list.map((c) => (
            <li key={c.code}><Link href={`/class/${encodeURIComponent(c.code)}`} className="inline-block rounded-lg border border-line px-2.5 py-1 text-[13px] font-medium hover:border-accent hover:text-accent-ink" title={c.fromCalendar ? 'Found in your calendar' : undefined}>{c.code}{c.fromCalendar ? <span className="ml-1 text-muted">·</span> : null}</Link></li>
          ))}
        </ul>
      ) : <p className="mt-1 text-[12px] text-muted">Add your classes in You › Profile, or connect Canvas in Calendar, to get a page for each class.</p>}
    </section>
  );
}
