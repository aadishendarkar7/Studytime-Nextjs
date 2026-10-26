import type { Metadata } from 'next';
import { NotesTool } from '@/features/ai/notes';

export const metadata: Metadata = { title: 'Notes & cheatsheets' };

export default function Page() {
  return <NotesTool />;
}
