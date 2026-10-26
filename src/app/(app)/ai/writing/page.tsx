import type { Metadata } from 'next';
import { WritingTool } from '@/features/ai/writing';

export const metadata: Metadata = { title: 'Writing assistant' };

export default function Page() {
  return <WritingTool />;
}
