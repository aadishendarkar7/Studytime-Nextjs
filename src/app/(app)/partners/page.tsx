import type { Metadata } from 'next';
import { PartnersPage } from '@/features/partners/partners-page';

// The app shell renders pages after browser data loads, so they opt out of instant-navigation checks.
export const instant = false;

export const metadata: Metadata = { title: 'Study partners' };

export default function Page() {
  return <PartnersPage />;
}
