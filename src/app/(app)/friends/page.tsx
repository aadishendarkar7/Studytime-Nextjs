import type { Metadata } from 'next';
import { FriendsPage } from '@/features/social/friends-page';

export const metadata: Metadata = { title: 'Friends & classmates' };

export default function Page() {
  return <FriendsPage />;
}
