import type { Metadata } from 'next';
import { ArenaPage } from '@/features/arena/arena-page';

// The app shell renders pages after browser data loads, so they opt out of instant-navigation checks.
export const instant = false;

export const metadata: Metadata = { title: 'Arena' };

export default function Page() {
  return <ArenaPage />;
}
