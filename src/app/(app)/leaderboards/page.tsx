import type { Metadata } from 'next';
import { LeaderboardPage } from '@/features/leaderboard/leaderboard-page';

export const metadata: Metadata = { title: 'Leaderboards' };

export default function Page() {
  return <LeaderboardPage />;
}
