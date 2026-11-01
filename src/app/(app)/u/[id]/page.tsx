import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ProfileView } from '@/features/people/profile-view';

// The app shell renders pages after browser data loads, so they opt out of instant-navigation checks.
export const instant = false;

export const metadata: Metadata = { title: 'Profile' };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ProfileView />
    </Suspense>
  );
}
