'use client';
import { useCallback, useEffect, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Tabs } from '@/components/ui/segmented';
import { InviteCard } from '@/features/auth/invite-card';
import { SignInGate } from '@/features/auth/sign-in-gate';
import { ChatPage } from '@/features/chat/chat-page';
import { toneFor, useUnreadDms } from '@/features/chat/live';
import { YourClasses } from '@/features/classes/your-classes';
import { FindPeople, FollowButton, PersonSheet } from '@/features/feed/highlights';
import { api } from '@/lib/api';
import type { PersonView } from '@/lib/types';
import { fmtMinutes } from '@/lib/utils';

type Tab = 'friends' | 'find' | 'messages';

function PersonRow({ p, onOpen, onChange }: { p: PersonView; onOpen: (id: string) => void; onChange: (p: PersonView) => void }) {
  return (
    <li className="flex items-center gap-3 py-3">
      <Avatar name={p.name} color={toneFor(p.id)} size={40} />
      <button type="button" onClick={() => onOpen(p.id)} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[15px] font-medium hover:underline">{p.name}</span>
        <span className="block truncate text-[13px] text-muted">{[p.major, p.school].filter(Boolean).join(' · ') || 'Studytime'}{p.followsYou && p.following ? ' · Friends' : p.followsYou ? ' · Follows you' : ''}</span>
      </button>
      <span className="tnum hidden text-[13px] text-muted sm:block">{fmtMinutes(p.weekMinutes)} this week</span>
      <FollowButton person={p} onChange={onChange} />
    </li>
  );
}

/** People you follow and people who follow you. */
function YourFriends({ onOpen }: { onOpen: (id: string) => void }) {
  const [data, setData] = useState<{ following: PersonView[]; followers: PersonView[] } | null>(null);
  const load = useCallback(() => api.people.mine().then(setData, () => setData({ following: [], followers: [] })), []);
  useEffect(() => {
    void load();
  }, [load]);
  const patch = (np: PersonView) => setData((d) => d && { following: d.following.map((x) => (x.id === np.id ? np : x)), followers: d.followers.map((x) => (x.id === np.id ? np : x)) });
  if (!data) return <p className="py-6 text-[13px] text-muted">Loading</p>;
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] [&>*]:min-w-0">
      <div className="grid grid-cols-1 content-start gap-6 [&>*]:min-w-0">
        <section>
          <h2 className="mb-1 font-sans text-[15px] font-semibold">Following · {data.following.length}</h2>
          {data.following.length ? <ul className="divide-y divide-line panel px-4">{data.following.map((p) => <PersonRow key={p.id} p={p} onOpen={onOpen} onChange={patch} />)}</ul> : <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-[14px] text-muted">You are not following anyone yet. Find classmates or send your invite link.</p>}
        </section>
        {data.followers.length > 0 && (
          <section>
            <h2 className="mb-1 font-sans text-[15px] font-semibold">Follow back · {data.followers.length}</h2>
            <ul className="divide-y divide-line panel px-4">{data.followers.map((p) => <PersonRow key={p.id} p={p} onOpen={onOpen} onChange={patch} />)}</ul>
          </section>
        )}
      </div>
      <aside className="grid content-start gap-4">
        <InviteCard />
        <YourClasses />
      </aside>
    </div>
  );
}

/** Friends: the people you follow, finding classmates, and messages. Nothing else. */
export function FriendsPage() {
  const unread = useUnreadDms();
  const [tab, setTab] = useState<Tab>(() => {
    const t = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('tab') : null;
    return t === 'find' || t === 'messages' ? t : 'friends';
  });
  const [person, setPerson] = useState<string | null>(null);
  const go = (t: Tab) => (setTab(t), history.replaceState(null, '', t === 'friends' ? '/friends' : `/friends?tab=${t}`));
  return (
    <>
      <header className="mt-4 mb-4 max-sm:mt-2">
        <h1 className="text-[26px] leading-8 max-sm:text-[22px]">Friends</h1>
      </header>
      <SignInGate title="Sign in to add friends" icon="friends">
        <Tabs className="mb-5" label="Friends" value={tab} onChange={go} options={[{ value: 'friends', label: 'Your friends' }, { value: 'find', label: 'Find classmates' }, { value: 'messages', label: 'Messages', count: unread }]} />
        {tab === 'friends' && <YourFriends onOpen={setPerson} />}
        {tab === 'find' && <div className="max-w-2xl"><FindPeople onOpen={setPerson} /></div>}
        {tab === 'messages' && <ChatPage />}
        <PersonSheet id={person} onClose={() => setPerson(null)} />
      </SignInGate>
    </>
  );
}
