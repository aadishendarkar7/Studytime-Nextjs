import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ClassPage } from '@/features/classes/class-page';

// The app shell renders pages after browser data loads, so they opt out of instant-navigation checks.
export const instant = false;

export const metadata: Metadata = { title: 'Class' };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ClassPage />
    </Suspense>
  );
}
