import type { Metadata } from 'next';
import { SolveTool } from '@/features/ai/solve';

// The app shell renders pages after browser data loads, so they opt out of instant-navigation checks.
export const instant = false;

export const metadata: Metadata = { title: 'Snap & solve' };

export default function Page() {
  return <SolveTool />;
}
