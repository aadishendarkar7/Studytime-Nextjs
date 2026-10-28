import type { Metadata } from 'next';
import { LeaderboardPage } from '@/features/ranks/ranks-page';

// The app shell renders pages after browser data loads, so they opt out of instant-navigation checks.
export const instant = false;

export const metadata: Metadata = { title: 'Leaderboard' };

export default function Page() {
  return <LeaderboardPage />;
}
