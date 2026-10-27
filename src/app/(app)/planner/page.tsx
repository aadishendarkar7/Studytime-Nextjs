import type { Metadata } from 'next';
import { PlannerPage } from '@/features/planner/planner-page';

// The app shell renders pages after browser data loads, so they opt out of instant-navigation checks.
export const instant = false;

export const metadata: Metadata = { title: 'Planner' };

export default function Page() {
  return <PlannerPage />;
}
