import type { Metadata } from 'next';
import { AssignmentTool } from '@/features/ai/assignments';

export const metadata: Metadata = { title: 'Assignment helper' };

export default function Page() {
  return <AssignmentTool />;
}
