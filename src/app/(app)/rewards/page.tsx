import type { Metadata } from 'next';
import { RewardsPage } from '@/features/rewards/rewards-page';

// The app shell renders pages after browser data loads, so they opt out of instant-navigation checks.
export const instant = false;

export const metadata: Metadata = { title: 'Rewards' };

export default function Page() {
  return <RewardsPage />;
}
