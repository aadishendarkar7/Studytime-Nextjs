import type { Metadata } from 'next';
import { Suspense } from 'react';
import { StudyPage } from '@/features/study/study-page';

// The app shell renders pages after browser data loads, so they opt out of instant-navigation checks.
export const instant = false;

export const metadata: Metadata = { title: 'Study' };

export default function Page() {
  return (
    <Suspense>
      <StudyPage />
    </Suspense>
  );
}
