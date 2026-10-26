import type { Metadata } from 'next';
import { SolveTool } from '@/features/ai/solve';

export const metadata: Metadata = { title: 'Snap & solve' };

export default function Page() {
  return <SolveTool />;
}
