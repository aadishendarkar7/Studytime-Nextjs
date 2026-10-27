import type { Metadata } from 'next';
import { Overview } from '@/features/overview/overview';

// The app shell renders pages after browser data loads, so they opt out of instant-navigation checks.
export const instant = false;

export const metadata: Metadata = { title: { absolute: 'Studytime | Focus timer, planner and AI tutor' } };

export default function Page() {
  return <Overview />;
}
