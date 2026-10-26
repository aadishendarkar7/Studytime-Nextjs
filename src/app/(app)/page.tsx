import type { Metadata } from 'next';
import { Overview } from '@/features/overview/overview';

export const metadata: Metadata = { title: { absolute: 'Studytime — AI study companion' } };

export default function Page() {
  return <Overview />;
}
