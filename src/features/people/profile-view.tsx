'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icons';
import { useAccount } from '@/features/auth/account';
import { SignInGate } from '@/features/auth/sign-in-gate';
import { toneFor } from '@/features/chat/live';
import { FollowButton, HighlightCard } from '@/features/feed/highlights';
import { api } from '@/lib/api';
import { YEARS } from '@/lib/constants';
import type { FeedPost, PersonView } from '@/lib/types';
import { cn, fmtMinutes } from '@/lib/utils';

/** One square in the posts grid: the photo if there is one, otherwise what they studied. */
function Tile({ post, onOpen }: { post: FeedPost; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="group relative aspect-square overflow-hidden bg-surface-3 text-left" aria-label={`${post.subject || 'Study session'}, ${fmtMinutes(post.minutes)}`}>
      {post.photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- user photos are served by our own API at their real size
        <img src={`/api/feed/${encodeURIComponent(post.id)}/photo`} alt="" loading="lazy" className="size-full object-cover transition-opacity group-hover:opacity-90" />
      ) : (
        <span className="flex size-full flex-col justify-end p-3">
          <span className="tnum text-[22px] leading-7 font-semibold text-ink sm:text-[26px]">{fmtMinutes(post.minutes)}</span>
          <span className="line-clamp-2 text-[12px] leading-4 text-ink-2 sm:text-[13px]">{post.subject || 'Study session'}</span>
        </span>
      )}
    </button>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="text-center sm:text-left">
      <p className="tnum text-[17px] leading-6 font-semibold">{value}</p>
      <p className="text-[13px] text-muted">{label}</p>
    </div>
  );
}

/** A profile page like Instagram: picture, counts, follow button, and a grid of their posts. */
export function ProfileView() {
  const id = decodeURIComponent(String(useParams<{ id: string }>().id ?? ''));
  const router = useRouter();
  const user = useAccount((s) => s.user);
  const [data, setData] = useState<{ person: PersonView; posts: FeedPost[] } | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<FeedPost | null>(null);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const target = id === 'me' ? user?.id ?? '' : id;

  useEffect(() => {
    if (!user || !target) return;
    let stop = false;
    api.people.get(target).then((r) => !stop && (setData(r), setError('')), (e) => !stop && setError((e as Error).message));
    return () => void (stop = true);
  }, [user, target]);

  const shown = data && data.person.id === target ? data : null;
  const isMe = Boolean(user && target === user.id);
  const replace = (np: FeedPost | null, oldId: string) => shown && setData({ ...shown, posts: np ? shown.posts.map((p) => (p.id === np.id ? np : p)) : shown.posts.filter((p) => p.id !== oldId) });
  const p = shown?.person;
  const year = p ? YEARS.find((y) => y.value === p.year)?.label : '';

  return (
    <SignInGate title="Sign in to see profiles" icon="user">
      <div className="mx-auto mt-4 max-w-[760px] max-sm:mt-2">
        <button type="button" onClick={() => router.back()} className="mb-4 inline-flex items-center gap-1 text-[13px] font-medium text-muted hover:text-ink">
          <Icon name="chevron" className="size-3.5 rotate-180" /> Back
        </button>
        {error ? (
          <p className="py-10 text-[15px] text-muted">{error}</p>
        ) : !p ? (
          <p className="py-10 text-[14px] text-muted">Loading profile</p>
        ) : (
          <>
            <header className="flex gap-6 max-sm:gap-4">
              <Avatar name={p.name} color={toneFor(p.id)} size={112} userId={p.id} className="max-sm:hidden" />
              <Avatar name={p.name} color={toneFor(p.id)} size={76} userId={p.id} className="sm:hidden" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="truncate text-[22px] leading-8 font-semibold">{p.name}</h1>
                  {isMe ? (
                    <Link href="/you?tab=profile"><Button size="sm" variant="secondary">Edit profile</Button></Link>
                  ) : (
                    <FollowButton person={p} onChange={(person) => shown && setData({ ...shown, person: { ...person, followingCount: p.followingCount, courses: p.courses } })} />
                  )}
                  {!isMe && p.followsYou && <span className="text-[13px] text-muted">Follows you</span>}
                </div>
                <div className="mt-4 grid max-w-[420px] grid-cols-4 gap-2">
                  <Stat value={p.posts} label={p.posts === 1 ? 'post' : 'posts'} />
                  <Stat value={p.followers} label={p.followers === 1 ? 'follower' : 'followers'} />
                  <Stat value={p.followingCount ?? 0} label="following" />
                  <Stat value={fmtMinutes(p.weekMinutes)} label="this week" />
                </div>
                <div className="mt-4 text-[14px] leading-5">
                  {(p.major || year) && <p className="font-medium">{[p.major, year].filter(Boolean).join(', ')}</p>}
                  {p.school && <p className="text-ink-2">{p.school}</p>}
                  {p.courses && p.courses.length > 0 && <p className="mt-1 text-muted">Taking {p.courses.join(', ')}</p>}
                </div>
              </div>
            </header>

            <div className="mt-8 flex items-center justify-between border-t border-line">
              <div role="tablist" aria-label="Posts view" className="flex gap-6">
                {(['grid', 'list'] as const).map((v) => (
                  <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} className={cn('-mt-px border-t-2 py-3 text-[13px] font-semibold', view === v ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink')}>
                    {v === 'grid' ? 'Posts' : 'Details'}
                  </button>
                ))}
              </div>
            </div>

            {shown.posts.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-[16px] font-semibold">{isMe ? 'Share your first session' : 'No posts yet'}</p>
                <p className="mt-1 text-[14px] text-muted">{isMe ? 'After a focus session, post what you studied from the Feed.' : p.following ? 'When they post a study session, it shows up here.' : `Follow ${p.name.split(' ')[0]} to see their study sessions.`}</p>
                {isMe && <Link href="/feed"><Button className="mt-4" variant="secondary">Go to Feed</Button></Link>}
              </div>
            ) : view === 'grid' ? (
              <div className="grid grid-cols-3 gap-1">
                {shown.posts.map((post) => <Tile key={post.id} post={post} onOpen={() => setOpen(post)} />)}
              </div>
            ) : (
              <div className="grid gap-3 pt-1">
                {shown.posts.map((post) => <HighlightCard key={post.id} post={post} onChange={(np) => replace(np, post.id)} />)}
              </div>
            )}
          </>
        )}
      </div>
      <Dialog open={Boolean(open)} onClose={() => setOpen(null)} title={open?.subject || 'Study session'}>
        {open && <HighlightCard post={open} onChange={(np) => (replace(np, open.id), setOpen(np))} />}
      </Dialog>
    </SignInGate>
  );
}
