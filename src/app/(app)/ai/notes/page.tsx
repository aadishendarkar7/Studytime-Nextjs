import type { Metadata } from 'next';
import { NotesTool } from '@/features/ai/notes';

// The app shell renders pages after browser data loads, so they opt out of instant-navigation checks.
export const instant = false;

export const metadata: Metadata = { title: 'Notes & cheatsheets' };

export default function Page() {
  return <NotesTool />;
}
