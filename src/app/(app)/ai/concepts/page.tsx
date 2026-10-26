import type { Metadata } from 'next';
import { ConceptsTool } from '@/features/ai/concepts';

export const metadata: Metadata = { title: 'Concept cards' };

export default function Page() {
  return <ConceptsTool />;
}
