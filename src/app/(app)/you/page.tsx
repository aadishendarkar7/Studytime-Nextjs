import type { Metadata } from 'next';
import { YouPage } from '@/features/you/you-page';

// The app shell renders pages after browser data loads, so they opt out of instant-navigation checks.
export const instant = false;

export const metadata: Metadata = { title: 'You' };

export default function Page() {
  return <YouPage />;
}
