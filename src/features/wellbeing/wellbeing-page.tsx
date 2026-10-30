'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, PageHeader } from '@/components/ui/card';
import { useExtras } from '@/lib/stores/extras';
import { useProfile } from '@/lib/stores/profile';
import { cn, todayKey } from '@/lib/utils';
import { CheckInForm } from './check-in';
import { DailyLadder } from '@/features/rewards/daily-ladder';
import { strainCheck } from './logic';

function StrainNotice() {
  const sessions = useProfile((s) => s.sessions);
  const checkins = useExtras((s) => s.checkins);
  const strain = strainCheck({ sessions, checkins, today: todayKey() });
  if (strain.kind === 'none') return null;
  return (
    <Card className="border-glow bg-warn-soft lg:col-span-12">
      <h2 className="text-[21px] leading-7">{strain.kind === 'low' ? 'This week looks heavy' : 'You are pushing hard'}</h2>
      <p className="mt-2 max-w-[68ch] text-[15px] leading-6 text-ink-2">
        {strain.kind === 'low'
          ? `Your last ${strain.days} check-ins show low mood and high stress. That happens, especially near exams. A rest day, a walk, or talking to someone you trust can help more than another hour of studying.`
          : 'You studied a lot more this week than last, and your mood dropped. Consider shorter sessions and a planned rest day.'}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/help"><Button variant="secondary">Support and resources</Button></Link>
      </div>
    </Card>
  );
}

export function WellbeingPage({ embedded = false }: { embedded?: boolean } = {}) {
  const checkedIn = useExtras((s) => s.checkins.some((c) => c.day === todayKey()));
  return (
    <>
      {!embedded && <PageHeader title="Check-in"  />}
      <div className="grid gap-5 lg:grid-cols-12 [&>*]:min-w-0">
        <StrainNotice />
        <Card className={cn('lg:col-span-7', !checkedIn && 'ring-2 ring-accent/30')}>
          <CardHeader title={checkedIn ? 'Today’s check-in' : 'Check in for today'} />
          <DailyLadder className="mb-4 border-0 bg-surface-2 p-2.5" />
          <CheckInForm />
        </Card>
      </div>
      <p className="mt-6 text-[14px] text-muted">Having a hard time? <Link href="/help" className="font-medium text-accent-ink underline underline-offset-4">Support and resources</Link></p>
    </>
  );
}
