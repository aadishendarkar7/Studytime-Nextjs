import type { Metadata } from 'next';
import { PlannerPage } from '@/features/planner/planner-page';

export const metadata: Metadata = { title: 'Planner' };

export default function Page() {
  return <PlannerPage />;
}
