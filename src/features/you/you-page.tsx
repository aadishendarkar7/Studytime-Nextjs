'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Hero, HeroButton, HeroStat } from '@/components/ui/hero';
import { streaks } from '@/features/focus/logic';
import { useExtras } from '@/lib/stores/extras';
import { fmtMinutes } from '@/lib/utils';
import { useAccount } from '@/features/auth/account';
import { Tabs } from '@/components/ui/segmented';
import { Activity } from '@/features/planner/planner-page';
import { ProfilePage, StatsCard } from '@/features/profile/profile-page';
import { WellbeingPage } from '@/features/wellbeing/wellbeing-page';
import { useProfile } from '@/lib/stores/profile';

type Tab = 'checkin' | 'progress' | 'profile';
const TABS: { value: Tab; label: string }[] = [
  { value: 'checkin', label: 'Check-in' },
  { value: 'progress', label: 'Progress' },
  { value: 'profile', label: 'Profile' },
];

/** Everything about you in one place: how you feel, how you are doing, and your details. */
export function YouPage() {
  const name = useProfile((s) => s.name);
  const sessions = useProfile((s) => s.sessions);
  const points = useProfile((s) => s.points);
  const restDays = useExtras((x) => x.restDays);
  const streak = streaks(sessions, undefined, restDays);
  const total = sessions.reduce((n, x) => n + x.minutes, 0);
  const signedIn = useAccount((s) => Boolean(s.user));
  const [tab, setTab] = useState<Tab>(() => {
    const t = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('tab') : null;
    return TABS.some((x) => x.value === t) ? (t as Tab) : 'checkin';
  });
  const go = (t: Tab) => (setTab(t), history.replaceState(null, '', t === 'checkin' ? '/you' : `/you?tab=${t}`));
  return (
    <>
      <h1 className="sr-only">{name && name !== 'Student' ? name : 'You'}</h1>
      <Hero
        className="mt-4 mb-5 max-sm:mt-2"
        title={name && name !== 'Student' ? name : 'You'}
        sub={streak.current ? `${streak.current}-day streak. Keep it going today.` : 'Finish a focus session today to start a streak.'}
        action={signedIn ? <Link href="/u/me"><HeroButton>View my profile</HeroButton></Link> : undefined}
      >
        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-white/20 pt-4 sm:grid-cols-4">
          <HeroStat value={fmtMinutes(total)} label="total focus" />
          <HeroStat value={`${streak.current} ${streak.current === 1 ? 'day' : 'days'}`} label={`streak, best ${streak.best}`} />
          <HeroStat value={sessions.length} label={sessions.length === 1 ? 'session' : 'sessions'} />
          <HeroStat value={points} label="points" />
        </div>
      </Hero>
      <Tabs className="mb-5" label="Sections" value={tab} onChange={go} options={TABS} />
      {tab === 'checkin' && <WellbeingPage embedded />}
      {tab === 'progress' && (
        <div className="grid gap-5 lg:grid-cols-12 [&>*]:min-w-0">
          <StatsCard />
          <div className="lg:col-span-12"><Activity /></div>
        </div>
      )}
      {tab === 'profile' && <ProfilePage embedded />}
    </>
  );
}
