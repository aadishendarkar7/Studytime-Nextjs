import type { Metadata } from 'next';
import { GradesPage } from '@/features/grades/grades-page';

// The app shell renders pages after browser data loads, so they opt out of instant-navigation checks.
export const instant = false;

export const metadata: Metadata = { title: 'Grades and GPA' };

export default function Page() {
  return <GradesPage />;
}
