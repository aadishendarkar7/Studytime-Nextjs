import type { Metadata } from 'next';
import { LeaderboardPage } from '@/features/leaderboard/leaderboard-page';

// The app shell renders pages after browser data loads, so they opt out of instant-navigation checks.
export const instant = false;

export const metadata: Metadata = { title: 'Leaderboards' };

export default function Page() {
  return <LeaderboardPage />;
}
