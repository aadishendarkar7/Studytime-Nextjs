import type { Metadata } from 'next';
import { ChatTool } from '@/features/ai/chat';

// The app shell renders pages after browser data loads, so they opt out of instant-navigation checks.
export const instant = false;

export const metadata: Metadata = { title: 'Tutor chat' };

export default function Page() {
  return <ChatTool />;
}
