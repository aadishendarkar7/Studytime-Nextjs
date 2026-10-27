import type { Metadata } from 'next';
import { FocusPage } from '@/features/focus/focus-page';

// The app shell renders pages after browser data loads, so they opt out of instant-navigation checks.
export const instant = false;

export const metadata: Metadata = { title: 'Focus timer' };

export default function Page() {
  return <FocusPage />;
}
