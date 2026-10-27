import type { Metadata } from 'next';
import { SpotsPage } from '@/features/spots/spots-page';

// The app shell renders pages after browser data loads, so they opt out of instant-navigation checks.
export const instant = false;

export const metadata: Metadata = { title: 'Study spots' };

export default function Page() {
  return <SpotsPage />;
}
