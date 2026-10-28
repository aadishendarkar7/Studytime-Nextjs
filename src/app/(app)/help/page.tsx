import type { Metadata } from 'next';
import { HelpPage } from '@/features/wellbeing/help-page';

// The app shell renders pages after browser data loads, so they opt out of instant-navigation checks.
export const instant = false;

export const metadata: Metadata = { title: 'Support and resources' };

export default function Page() {
  return <HelpPage />;
}
