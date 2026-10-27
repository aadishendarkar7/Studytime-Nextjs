import type { Metadata } from 'next';
import { WritingTool } from '@/features/ai/writing';

// The app shell renders pages after browser data loads, so they opt out of instant-navigation checks.
export const instant = false;

export const metadata: Metadata = { title: 'Writing assistant' };

export default function Page() {
  return <WritingTool />;
}
