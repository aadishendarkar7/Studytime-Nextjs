import type { Metadata } from 'next';
import { FriendsPage } from '@/features/friends/friends-page';

// The app shell renders pages after browser data loads, so they opt out of instant-navigation checks.
export const instant = false;

export const metadata: Metadata = { title: 'Friends' };

export default function Page() {
  return <FriendsPage />;
}
