'use client';
import { FriendsWeek } from './friends-week';
import { useCallback, useEffect, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/field';
import { Icon, type IconName } from '@/components/ui/icons';
import { Segmented } from '@/components/ui/segmented';
import { Sheet } from '@/components/ui/sheet';
import { useAccount } from '@/features/auth/account';
import { toneFor } from '@/features/chat/live';
import { TAGLINE } from '@/features/wrapped/wrapped-page';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/lib/stores/ui';
import type { FeedPost, PersonView } from '@/lib/types';
import { cn, fmtMinutes } from '@/lib/utils';
import { InviteCard, inviteLink } from '@/features/auth/invite-card';
import { YourClasses } from '@/features/classes/your-classes';
import { useDropComposer } from '@/features/drop/composer';
import { useDrops } from '@/features/drop/live';
import { ShareForm, VISIBILITY } from './share-form';

type Scope = 'foryou' | 'following' | 'mine';

const when = (at: number) => {
  const d = new Date(at);
  const today = new Date();
  const y = new Date(Date.now() - 86_400_000);
  const day = d.toDateString() === today.toDateString() ? 'Today' : d.toDateString() === y.toDateString() ? 'Yesterday' : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  return `${day} · ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
};

const shareText = (p: FeedPost, me: string | undefined) => {
  const who = p.userId === me ? 'I' : p.name.split(' ')[0];
  const crew = (p.crew ?? []).filter((c) => c.id !== me).map((c) => c.name.split(' ')[0]);
  const withWho = crew.length ? ` with ${crew.join(' and ')}` : '';
  return `${who} studied ${fmtMinutes(p.minutes)}${p.subject ? ` of ${p.subject}` : ''}${withWho} on Studytime.`;
};

/** The post as a 1080×1350 image: the photo on top if there is one, then the time and what was studied. */
async function highlightImage(p: FeedPost) {
  const c = document.createElement('canvas');
  c.width = 1080;
  c.height = 1350;
  const g = c.getContext('2d')!;
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#2f5bd3';
  const font = (size: number, weight = 600) => `${weight} ${size}px "Lexend Variable", system-ui, sans-serif`;
  const fit = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
  g.fillStyle = '#09090b';
  g.fillRect(0, 0, 1080, 1350);
  let photo: ImageBitmap | null = null;
  if (p.photo) photo = await fetch(`/api/feed/${p.id}/photo`).then((r) => (r.ok ? r.blob() : null)).then((b) => (b ? createImageBitmap(b) : null)).catch(() => null);
  const names = [p.name, ...(p.crew ?? []).map((x) => x.name)].map((n) => n.split(' ')[0]).join(', ');
  const date = new Date(p.at).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  if (photo) {
    const h = 780;
    const s = Math.max(1080 / photo.width, h / photo.height);
    const w = photo.width * s;
    const ph = photo.height * s;
    g.save();
    g.beginPath();
    g.rect(0, 0, 1080, h);
    g.clip();
    g.drawImage(photo, (1080 - w) / 2, (h - ph) / 2, w, ph);
    g.restore();
    photo.close();
    g.fillStyle = '#a1a1aa';
    g.font = font(32, 500);
    g.fillText(fit(`${names} · ${date}`, 52), 80, 860);
    g.fillStyle = '#fafafa';
    g.font = font(130, 700);
    g.fillText(fmtMinutes(p.minutes), 80, 1010);
    g.font = font(48, 650);
    g.fillText(fit(p.subject || 'Study session', 34), 80, 1090);
    if (p.place) {
      g.fillStyle = '#a1a1aa';
      g.font = font(36, 500);
      g.fillText(fit(p.place, 44), 80, 1160);
    }
  } else {
    g.fillStyle = accent;
    g.fillRect(80, 120, 72, 8);
    g.fillStyle = '#a1a1aa';
    g.font = font(34, 500);
    g.fillText(fit(`${names} · ${date}`, 50), 80, 200);
    g.fillStyle = '#fafafa';
    g.font = font(64, 700);
    g.fillText(fit(p.subject || 'Study session', 26), 80, 282);
    g.font = font(150, 700);
    g.fillText(fmtMinutes(p.minutes), 80, 470);
    let y = 590;
    const row = (k: string, v: string) => {
      g.fillStyle = '#a1a1aa';
      g.font = font(30, 500);
      g.fillText(k, 80, y);
      g.fillStyle = '#fafafa';
      g.font = font(46, 650);
      g.fillText(fit(v, 32), 80, y + 56);
      y += 120;
    };
    if (p.place) row('Where', p.place);
    if (p.with.length) row('Studied with', p.with.join(', '));
    if (p.topics.length) row('Covered', p.topics.slice(0, 4).join(', '));
  }
  g.fillStyle = accent;
  g.font = font(34, 600);
  g.fillText(TAGLINE, 80, 1270);
  return new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'));
}

/** Share a post like on Instagram: as an image to any app, or as a message with a link. */
function ShareMenu({ post }: { post: FeedPost }) {
  const me = useAccount((s) => s.user?.id);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const url = me ? inviteLink(me) : location.origin;
  const text = shareText(post, me);
  const msg = `${text} ${url}`;
  const asImage = async () => {
    setBusy(true);
    try {
      const blob = await highlightImage(post);
      if (!blob) return toast('Could not make the image.', 'error');
      const file = new File([blob], 'studytime.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text });
          return;
        } catch {
          return; // closed the share sheet
        }
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'studytime.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      toast('Image saved. Post it from your photos.');
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };
  const go = (href: string) => (window.open(href, '_blank', 'noopener'), setOpen(false));
  const items: { label: string; icon: IconName; run: () => void }[] = [
    { label: busy ? 'Making image' : 'Instagram and more', icon: 'camera', run: () => void asImage() },
    { label: 'WhatsApp', icon: 'chat', run: () => go(`https://wa.me/?text=${encodeURIComponent(msg)}`) },
    { label: 'Messages', icon: 'send', run: () => go(`sms:?&body=${encodeURIComponent(msg)}`) },
    { label: 'X', icon: 'arrow', run: () => go(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`) },
    { label: 'Copy link', icon: 'copy', run: () => void navigator.clipboard?.writeText(msg).then(() => toast('Copied.'), () => toast('Could not copy.', 'error')).finally(() => setOpen(false)) },
  ];
  return (
    <div className="relative">
      <button type="button" aria-label="Share" title="Share" aria-expanded={open} onClick={() => setOpen(!open)} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-3 hover:text-ink"><Icon name="send" className="size-4" /></button>
      {open && (
        <div role="menu" className="absolute top-9 right-0 z-30 w-60 rounded-xl border border-line bg-surface p-1 shadow-lg">
          {items.map((it) => (
            <button key={it.label} type="button" role="menuitem" disabled={busy} onClick={it.run} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] hover:bg-surface-3 disabled:opacity-60">
              <Icon name={it.icon} className="size-4 text-muted" /> {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const REASONS = [
  { value: 'spam', label: 'Spam or ads' },
  { value: 'mean', label: 'Mean or bullying' },
  { value: 'inappropriate', label: 'Inappropriate' },
  { value: 'fake', label: 'Fake session' },
  { value: 'other', label: 'Something else' },
] as const;

/** Report a highlight or block its author. */
function MoreMenu({ post, onGone }: { post: FeedPost; onGone: () => void }) {
  const [open, setOpen] = useState<'' | 'menu' | 'report'>('');
  const report = async (reason: (typeof REASONS)[number]['value']) => {
    try {
      await api.feed.report(post.id, reason);
      toast('Thanks. We hid it for you, and it will be reviewed.');
      onGone();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const blockIt = async () => {
    if (!confirm(`Block ${post.name}? You will stop seeing each other on Studytime.`)) return;
    try {
      await api.people.block(post.userId, true);
      toast(`${post.name} is blocked. You can undo this in Settings.`);
      onGone();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  return (
    <div className="relative">
      <button type="button" aria-label="More options" aria-expanded={Boolean(open)} onClick={() => setOpen(open ? '' : 'menu')} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-3 hover:text-ink"><Icon name="menu" className="size-4" /></button>
      {open && (
        <div role="menu" className="absolute top-9 right-0 z-30 w-52 rounded-xl border border-line bg-surface p-1 shadow-lg">
          {open === 'menu' ? (
            <>
              <button type="button" role="menuitem" className="block w-full rounded-lg px-3 py-2 text-left text-[13px] hover:bg-surface-3" onClick={() => setOpen('report')}>Report this highlight</button>
              <button type="button" role="menuitem" className="block w-full rounded-lg px-3 py-2 text-left text-[13px] text-danger hover:bg-surface-3" onClick={() => (setOpen(''), void blockIt())}>Block {post.name}</button>
            </>
          ) : (
            <>
              <p className="px-3 pt-1.5 pb-1 text-[11px] font-semibold text-muted">What is wrong with it?</p>
              {REASONS.map((x) => <button key={x.value} type="button" role="menuitem" className="block w-full rounded-lg px-3 py-2 text-left text-[13px] hover:bg-surface-3" onClick={() => (setOpen(''), void report(x.value))}>{x.label}</button>)}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** One session recap. Quiet on purpose: stats first, one "Nice work", no comment threads. */
export function HighlightCard({ post, onChange, onOpenPerson }: { post: FeedPost; onChange: (p: FeedPost | null) => void; onOpenPerson?: (id: string) => void }) {
  const me = useAccount((s) => s.user?.id);
  const mine = post.userId === me;
  const cheered = me ? post.kudos.includes(me) : false;
  const [busy, setBusy] = useState(false);
  const cheer = async () => {
    setBusy(true);
    try {
      onChange((await api.feed.kudos(post.id)).post);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not send.', 'error');
    } finally {
      setBusy(false);
    }
  };
  const others = post.kudosNames.filter((_, i) => post.kudos[i] !== me);
  // Turn a highlight into the next session: join them if they are out now, or drop a spot there.
  const theirDrop = useDrops((s) => s.drops.find((d) => d.name === post.name && d.endsAt > Date.now()));
  const together = () => {
    if (theirDrop) location.href = `/drop?d=${theirDrop.id}`;
    else useDropComposer.getState().show({ subject: post.subject, spotName: post.place });
  };
  const inCrew = (post.crew ?? []).some((c) => c.id === me);
  const people = [{ id: post.userId, full: post.name, name: mine ? 'You' : post.name }, ...(post.crew ?? []).map((c) => ({ id: c.id, full: c.name, name: c.id === me ? 'you' : c.name.split(' ')[0] }))];
  const names = people.length === 1 ? people[0].name : `${people.slice(0, -1).map((p) => p.name).join(', ')} and ${people[people.length - 1].name}`;
  const details = [post.place, post.with.filter((w) => !(post.crew ?? []).some((c) => c.name === w)).length ? `with ${post.with.filter((w) => !(post.crew ?? []).some((c) => c.name === w)).join(', ')}` : ''].filter(Boolean).join(' · ');
  return (
    <article className="min-w-0 rounded-xl border border-line bg-surface p-4">
      <header className="flex items-center gap-2.5">
        <span className="flex -space-x-2">{people.slice(0, 4).map((p) => <span key={p.id} className="rounded-full ring-2 ring-surface"><Avatar name={p.full} color={toneFor(p.id)} size={32} /></span>)}</span>
        <div className="min-w-0 flex-1">
          <button type="button" disabled={!onOpenPerson || mine} onClick={() => onOpenPerson?.(post.userId)} className="block truncate text-left text-[14px] font-semibold enabled:hover:underline">{names}</button>
          <p className="truncate text-[12px] text-muted">{when(post.at)}{post.school ? ` · ${post.school}` : ''}</p>
        </div>
        <ShareMenu post={post} />
        {!mine && <MoreMenu post={post} onGone={() => onChange(null)} />}
        {mine && <button type="button" aria-label="Delete post" title="Delete" onClick={() => confirm('Delete this post?') && api.feed.remove(post.id).then(() => onChange(null), () => toast('Could not delete.', 'error'))} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-3 hover:text-danger"><Icon name="trash" className="size-4" /></button>}
      </header>
      {post.photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/feed/${post.id}/photo`} alt={post.subject ? `Photo: ${post.subject}` : 'Study photo'} loading="lazy" className="-mx-4 mt-3 block max-h-[560px] w-[calc(100%+2rem)] max-w-none bg-surface-3 object-cover" onDoubleClick={() => !mine && !inCrew && !cheered && void cheer()} />
      )}
      <div className="mt-3 flex min-w-0 items-baseline gap-3">
        <p className="tnum shrink-0 font-display text-[34px] leading-10 font-semibold tracking-tight">{fmtMinutes(post.minutes)}</p>
        <p className="min-w-0 truncate text-[15px] text-ink-2">{people.length > 1 ? 'together' : ''}{post.subject ? `${people.length > 1 ? ' · ' : ''}${post.subject}` : people.length > 1 ? '' : 'studying'}</p>
      </div>
      {details && <p className="mt-0.5 flex items-center gap-1 truncate text-[13px] text-muted"><Icon name="pin" className="size-3.5 shrink-0" />{details}</p>}
      {post.topics.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Topics covered">
          {post.topics.map((t) => <li key={t} className="rounded-md border border-line px-2 py-0.5 text-[12px] text-ink-2">{t}</li>)}
        </ul>
      )}
      {post.note && <p className="mt-3 text-[14px] leading-5 text-ink-2">{post.note}</p>}
      <footer className="mt-3 flex items-center gap-3 border-t border-line pt-3">
        {!mine && !inCrew && (
          <button type="button" disabled={busy} onClick={cheer} aria-pressed={cheered} className={cn('inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-medium transition-colors', cheered ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line text-ink-2 hover:border-line-strong hover:text-ink')}>
            <Icon name="star" className="size-3.5" /> {cheered ? 'Cheered' : 'Nice work'}
          </button>
        )}
        {!mine && !inCrew && (
          <button type="button" onClick={together} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-[13px] font-medium text-ink-2 hover:border-line-strong hover:text-ink" title={theirDrop ? `Join ${post.name} at ${theirDrop.spotName}` : 'Drop a spot there for next time'}>
            <Icon name="pin" className="size-3.5" /> {theirDrop ? 'Join them now' : 'Study together'}
          </button>
        )}
        <span className="min-w-0 truncate text-[12px] text-muted">
          {mine
            ? post.kudos.length ? `${post.kudosNames.slice(0, 2).join(' and ')}${post.kudos.length > 2 ? ` and ${post.kudos.length - 2} more` : ''} said nice work` : VISIBILITY.find((v) => v.value === post.visibility)?.label
            : others.length ? `${others.slice(0, 2).join(', ')}${others.length > 2 ? ` +${others.length - 2}` : ''} cheered` : inCrew ? `Posted by ${post.name.split(' ')[0]}` : ''}
        </span>
      </footer>
    </article>
  );
}

function FollowButton({ person, onChange }: { person: PersonView; onChange: (p: PersonView) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button size="sm" variant={person.following ? 'secondary' : 'primary'} loading={busy} onClick={async () => {
      setBusy(true);
      try {
        await api.people.follow(person.id, !person.following);
        onChange({ ...person, following: !person.following, followers: person.followers + (person.following ? -1 : 1) });
      } catch (e) {
        toast(e instanceof ApiError ? e.message : 'Could not update.', 'error');
      } finally {
        setBusy(false);
      }
    }}>{person.following ? 'Following' : person.followsYou ? 'Follow back' : 'Follow'}</Button>
  );
}

function PersonSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const [data, setData] = useState<{ person: PersonView; posts: FeedPost[] } | null>(null);
  useEffect(() => {
    if (!id) return;
    let stop = false;
    api.people.get(id).then((r) => !stop && setData(r), (e) => toast((e as Error).message, 'error'));
    return () => void (stop = true);
  }, [id]);
  const shown = data && data.person.id === id ? data : null;
  return (
    <Sheet open={Boolean(id)} onClose={onClose} title={shown?.person.name ?? ''}>
      {shown ? (
        <>
          <div className="flex items-center gap-3">
            <Avatar name={shown.person.name} color={toneFor(shown.person.id)} size={48} />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold">{shown.person.name}</p>
              <p className="truncate text-[13px] text-muted">{[shown.person.major, shown.person.school].filter(Boolean).join(' · ') || 'Studytime'}</p>
            </div>
            <FollowButton person={shown.person} onChange={(person) => setData({ ...shown, person })} />
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-surface-2 py-2"><dt className="text-[11px] text-muted">This week</dt><dd className="tnum text-[15px] font-semibold">{fmtMinutes(shown.person.weekMinutes)}</dd></div>
            <div className="rounded-lg bg-surface-2 py-2"><dt className="text-[11px] text-muted">Highlights</dt><dd className="tnum text-[15px] font-semibold">{shown.person.posts}</dd></div>
            <div className="rounded-lg bg-surface-2 py-2"><dt className="text-[11px] text-muted">Followers</dt><dd className="tnum text-[15px] font-semibold">{shown.person.followers}</dd></div>
          </dl>
          <div className="mt-5 grid gap-3">
            {shown.posts.length ? shown.posts.map((p) => <HighlightCard key={p.id} post={p} onChange={(np) => setData({ ...shown, posts: np ? shown.posts.map((x) => (x.id === np.id ? np : x)) : shown.posts.filter((x) => x.id !== p.id) })} />) : <p className="text-[13px] text-muted">{shown.person.following ? 'No highlights to show yet.' : 'Follow to see their highlights.'}</p>}
          </div>
        </>
      ) : <p className="text-[13px] text-muted">Loading</p>}
    </Sheet>
  );
}

function FindPeople({ onOpen }: { onOpen: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [people, setPeople] = useState<PersonView[] | null>(null);
  useEffect(() => {
    let stop = false;
    const id = setTimeout(() => api.people.search(q).then((r) => !stop && setPeople(r.people), () => !stop && setPeople([])), q ? 300 : 0);
    return () => ((stop = true), clearTimeout(id));
  }, [q]);
  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <h2 className="font-sans text-[15px] font-semibold">Find classmates</h2>
      <p className="text-[12px] text-muted">People at your school and in your classes show up first.</p>
      <Input className="mt-3 h-9 text-[14px]" placeholder="Search by name, school or major" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search people" />
      <ul className="mt-2 divide-y divide-line">
        {(people ?? []).slice(0, 8).map((p) => (
          <li key={p.id} className="flex items-center gap-2.5 py-2">
            <Avatar name={p.name} color={toneFor(p.id)} size={28} />
            <button type="button" onClick={() => onOpen(p.id)} className="min-w-0 flex-1 text-left">
              <span className="block truncate text-[13px] font-medium hover:underline">{p.name}</span>
              <span className="block truncate text-[11px] text-muted">{[p.major, p.school].filter(Boolean).join(' · ') || 'Studytime'}</span>
            </button>
            <FollowButton person={p} onChange={(np) => setPeople((l) => (l ?? []).map((x) => (x.id === np.id ? np : x)))} />
          </li>
        ))}
      </ul>
      {people && !people.length && <p className="py-2 text-[13px] text-muted">{q ? 'No one found.' : 'No classmates yet. Invite friends and they will show up here.'}</p>}
    </section>
  );
}

/** The feed: study sessions people post. Seeing friends put in the hours is the point. */
export function HighlightsTab() {
  const [scope, setScope] = useState<Scope>('foryou');
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [writing, setWriting] = useState(false);
  const [person, setPerson] = useState<string | null>(null);
  const load = useCallback((s: Scope) => api.feed.list(s).then((r) => setPosts(r.posts), (e) => (toast((e as Error).message, 'error'), setPosts([]))), []);
  useEffect(() => {
    void load(scope);
  }, [scope, load]);
  const replace = (id: string, p: FeedPost | null) => setPosts((l) => (l ? (p ? l.map((x) => (x.id === id ? p : x)) : l.filter((x) => x.id !== id)) : l));

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] [&>*]:min-w-0">
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Segmented wrap={false} label="Whose highlights" value={scope} onChange={setScope} options={[{ value: 'foryou', label: 'For you' }, { value: 'following', label: 'Friends' }, { value: 'mine', label: 'Mine' }]} />
          <span className="flex-1" />
          <Button onClick={() => setWriting(true)}><Icon name="plus" className="size-4" /> Post</Button>
        </div>
        {posts === null ? (
          <p className="py-6 text-[13px] text-muted">Loading</p>
        ) : posts.length ? (
          <div className="grid gap-3 [&>*]:min-w-0">{posts.map((p) => <HighlightCard key={p.id} post={p} onChange={(np) => replace(p.id, np)} onOpenPerson={setPerson} />)}</div>
        ) : (
          <div className="rounded-xl border border-dashed border-line px-5 py-8 text-center">
            <p className="text-[15px] font-semibold">{scope === 'mine' ? 'No posts yet' : 'Nothing here yet'}</p>
            <Button className="mt-3" onClick={() => setWriting(true)}><Icon name="plus" className="size-4" /> Post your first session</Button>
          </div>
        )}
      </div>
      <aside className="grid content-start gap-4">
        <FriendsWeek onOpen={setPerson} />
        <FindPeople onOpen={setPerson} />
        <YourClasses />
        <InviteCard />
      </aside>
      <Dialog open={writing} onClose={() => setWriting(false)} title="Post a study session">
        {writing && <ShareForm onDone={(p) => { setWriting(false); if (p) setPosts((l) => [p, ...(l ?? [])]); }} />}
      </Dialog>
      <PersonSheet id={person} onClose={() => setPerson(null)} />
    </div>
  );
}
