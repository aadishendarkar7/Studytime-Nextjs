import type { Metadata } from 'next';
import { ResetPage } from '@/features/auth/reset-page';

export const metadata: Metadata = { title: 'Choose a new password' };

export default function Page() {
  return <ResetPage />;
}
