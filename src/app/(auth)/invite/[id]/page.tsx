import { Suspense } from 'react';
import type { Metadata } from 'next';
import { InvitePage } from '@/features/auth/invite-page';

export const metadata: Metadata = { title: 'You are invited', description: 'Join your friend on Studytime: see where classmates are studying and study together.' };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <InvitePage />
    </Suspense>
  );
}
