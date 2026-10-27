import type { Metadata } from 'next';
import { AssignmentTool } from '@/features/ai/assignments';

// The app shell renders pages after browser data loads, so they opt out of instant-navigation checks.
export const instant = false;

export const metadata: Metadata = { title: 'Assignment helper' };

export default function Page() {
  return <AssignmentTool />;
}
