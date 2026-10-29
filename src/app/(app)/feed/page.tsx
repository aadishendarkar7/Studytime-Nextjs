import type { Metadata } from 'next';
import { FeedPage } from '@/features/feed/feed-page';

// The app shell renders pages after browser data loads, so they opt out of instant-navigation checks.
export const instant = false;

export const metadata: Metadata = { title: 'Feed' };

export default function Page() {
  return <FeedPage />;
}
