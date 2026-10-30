'use client';
import { useState } from 'react';
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
  const [tab, setTab] = useState<Tab>(() => {
    const t = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('tab') : null;
    return TABS.some((x) => x.value === t) ? (t as Tab) : 'checkin';
  });
  const go = (t: Tab) => (setTab(t), history.replaceState(null, '', t === 'checkin' ? '/you' : `/you?tab=${t}`));
  return (
    <>
      <header className="mt-4 mb-4 max-sm:mt-2">
        <h1 className="text-[26px] leading-8 max-sm:text-[22px]">{name && name !== 'Student' ? name : 'You'}</h1>
      </header>
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
