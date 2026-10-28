import type { Metadata } from 'next';
import { CalendarPage } from '@/features/calendar/calendar-page';

// The app shell renders pages after browser data loads, so they opt out of instant-navigation checks.
export const instant = false;

export const metadata: Metadata = { title: 'Calendar' };

export default function Page() {
  return <CalendarPage />;
}
