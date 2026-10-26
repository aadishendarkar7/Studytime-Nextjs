import type { Metadata } from 'next';
import { FocusPage } from '@/features/focus/focus-page';

export const metadata: Metadata = { title: 'Focus timer' };

export default function Page() {
  return <FocusPage />;
}
