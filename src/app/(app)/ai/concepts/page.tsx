import type { Metadata } from 'next';
import { ConceptsTool } from '@/features/ai/concepts';

// The app shell renders pages after browser data loads, so they opt out of instant-navigation checks.
export const instant = false;

export const metadata: Metadata = { title: 'Concept cards' };

export default function Page() {
  return <ConceptsTool />;
}
