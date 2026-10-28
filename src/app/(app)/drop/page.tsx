import type { Metadata } from 'next';
import { DropPage } from '@/features/drop/drop-page';

// The app shell renders pages after browser data loads, so they opt out of instant-navigation checks.
export const instant = false;

export const metadata: Metadata = { title: 'Drop a Spot' };

export default function Page() {
  return <DropPage />;
}
