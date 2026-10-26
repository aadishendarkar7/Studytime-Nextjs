import type { Metadata } from 'next';
import { GamesPage } from '@/features/games/games-page';

export const metadata: Metadata = { title: 'Study games' };

export default function Page() {
  return <GamesPage />;
}
