import type { Metadata } from 'next';
import { GamesPage } from '@/features/games/games-page';

// The app shell renders pages after browser data loads, so they opt out of instant-navigation checks.
export const instant = false;

export const metadata: Metadata = { title: 'Study games' };

export default function Page() {
  return <GamesPage />;
}
