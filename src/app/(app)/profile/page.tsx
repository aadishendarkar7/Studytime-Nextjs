import type { Metadata } from 'next';
import { ProfilePage } from '@/features/profile/profile-page';

// The app shell renders pages after browser data loads, so they opt out of instant-navigation checks.
export const instant = false;

export const metadata: Metadata = { title: 'Profile' };

export default function Page() {
  return <ProfilePage />;
}
