import type { Metadata } from 'next';
import { SoundsPage } from '@/features/sounds/sounds-page';

// The app shell renders pages after browser data loads, so they opt out of instant-navigation checks.
export const instant = false;

export const metadata: Metadata = { title: 'Focus sounds' };

export default function Page() {
  return <SoundsPage />;
}
