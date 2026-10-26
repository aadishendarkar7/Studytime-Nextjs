import type { Metadata } from 'next';
import { ChatTool } from '@/features/ai/chat';

export const metadata: Metadata = { title: 'Tutor chat' };

export default function Page() {
  return <ChatTool />;
}
