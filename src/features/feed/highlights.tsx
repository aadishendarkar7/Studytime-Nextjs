'use client';
import { useCallback, useEffect, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/field';
import { Icon } from '@/components/ui/icons';
import { Segmented } from '@/components/ui/segmented';
import { Sheet } from '@/components/ui/sheet';
import { useAccount } from '@/features/auth/account';
import { toneFor } from '@/features/chat/live';
import { TAGLINE } from '@/features/wrapped/wrapped-page';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/lib/stores/ui';
import type { FeedPost, PersonView } from '@/lib/types';
import { useNow } from '@/lib/use-now';
import { cn, fmtMinutes, plural } from '@/lib/utils';
import { ShareForm, VISIBILITY } from './share-form';

type Scope = 'following' | 'school' | 'mine';

const when = (at: number) => {
  const d = new Date(at);
  const today = new Date();
  const y = new Date(Date.now() - 86_400_000);
  const day = d.toDateString() === today.toDateString() ? 'Today' : d.toDateString() === y.toDateString() ? 'Yesterday' : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  return `${day} · ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
};

/** A recap card as an image, to send or post anywhere. */
async function shareHighlight(p: FeedPost) {
  const c = document.createElement('canvas');
  c.width = 1080;
  c.height = 1350;
  const g = c.getContext('2d')!;
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#2f5bd3';
  const font = (size: number, weight = 600) => `${weight} ${size}px "Inter Variable", system-ui, sans-serif`;
  const fit = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
  g.fillStyle = '#09090b';
  g.fillRect(0, 0, 1080, 1350);
  g.fillStyle = accent;
  g.fillRect(80, 120, 72, 8);
  g.fillStyle = '#a1a1aa';
  g.font = font(34, 500);
  g.fillText(`${p.name} · ${new Date(p.at).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}`, 80, 200);
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
  if (p.topics.length) {
    g.fillStyle = '#a1a1aa';
    g.font = font(30, 500);
    g.fillText('Covered', 80, y);
    y += 30;
    g.font = font(34, 600);
    let x = 80;
    for (const t of p.topics.slice(0, 6)) {
      const w = g.measureText(fit(t, 28)).width + 44;
      if (x + w > 1000) {
        x = 80;
        y += 70;
      }
      if (y > 1150) break;
      g.fillStyle = '#27272a';
      g.beginPath();
      g.roundRect(x, y, w, 56, 12);
      g.fill();
      g.fillStyle = '#fafafa';
      g.fillText(fit(t, 28), x + 22, y + 39);
      x += w + 14;
    }
  }
  g.fillStyle = accent;
  g.font = font(34, 600);
  g.fillText(TAGLINE, 80, 1270);
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'));
  if (!blob) return toast('Could not make the image.', 'error');
  const file = new File([blob], 'studytime-highlight.png', { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Study session', text: TAGLINE });
      return;
    } catch {
      /* closed the share sheet */
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'studytime-highlight.png';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium text-muted">{label}</dt>
      <dd className="truncate text-[15px] font-semibold">{value}</dd>
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
  return (
    <article className="rounded-xl border border-line bg-surface p-4">
      <header className="flex items-center gap-2.5">
        <Avatar name={post.name} color={toneFor(post.userId)} size={32} />
        <div className="min-w-0 flex-1">
          <button type="button" disabled={!onOpenPerson || mine} onClick={() => onOpenPerson?.(post.userId)} className="block truncate text-left text-[14px] font-semibold enabled:hover:underline">{mine ? 'You' : post.name}</button>
          <p className="truncate text-[12px] text-muted">{when(post.at)}{post.school ? ` · ${post.school}` : ''}</p>
        </div>
        <button type="button" aria-label="Share as image" title="Share as image" onClick={() => void shareHighlight(post)} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-3 hover:text-ink"><Icon name="download" className="size-4" /></button>
        {mine && <button type="button" aria-label="Delete highlight" title="Delete" onClick={() => confirm('Delete this highlight?') && api.feed.remove(post.id).then(() => onChange(null), () => toast('Could not delete.', 'error'))} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-3 hover:text-danger"><Icon name="trash" className="size-4" /></button>}
      </header>
      <h3 className="mt-3 font-sans text-[17px] leading-6 font-semibold">{post.subject || 'Study session'}</h3>
      <dl className="mt-2 grid grid-cols-3 gap-3 rounded-lg bg-surface-2 px-3 py-2.5">
        <Stat label="Time" value={fmtMinutes(post.minutes)} />
        <Stat label="Where" value={post.place || 'Not shared'} />
        <Stat label="With" value={post.with.length ? post.with.join(', ') : 'Solo'} />
      </dl>
      {post.topics.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Topics covered">
          {post.topics.map((t) => <li key={t} className="rounded-md border border-line px-2 py-0.5 text-[12px] text-ink-2">{t}</li>)}
        </ul>
      )}
      {post.note && <p className="mt-3 text-[14px] leading-5 text-ink-2">{post.note}</p>}
      <footer className="mt-3 flex items-center gap-3 border-t border-line pt-3">
        {!mine && (
          <button type="button" disabled={busy} onClick={cheer} aria-pressed={cheered} className={cn('inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-medium transition-colors', cheered ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line text-ink-2 hover:border-line-strong hover:text-ink')}>
            <Icon name="star" className="size-3.5" /> {cheered ? 'Cheered' : 'Nice work'}
          </button>
        )}
        <span className="min-w-0 truncate text-[12px] text-muted">
          {mine
            ? post.kudos.length ? `${post.kudosNames.slice(0, 2).join(' and ')}${post.kudos.length > 2 ? ` and ${post.kudos.length - 2} more` : ''} said nice work` : VISIBILITY.find((v) => v.value === post.visibility)?.label
            : others.length ? `${others.slice(0, 2).join(', ')}${others.length > 2 ? ` +${others.length - 2}` : ''} cheered` : ''}
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

/** Study highlights: recaps of sessions from you and the people you follow. */
export function HighlightsTab() {
  const [scope, setScope] = useState<Scope>('following');
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [writing, setWriting] = useState(false);
  const [person, setPerson] = useState<string | null>(null);
  const load = useCallback((s: Scope) => api.feed.list(s).then((r) => setPosts(r.posts), (e) => (toast((e as Error).message, 'error'), setPosts([]))), []);
  useEffect(() => {
    void load(scope);
  }, [scope, load]);
  const replace = (id: string, p: FeedPost | null) => setPosts((l) => (l ? (p ? l.map((x) => (x.id === id ? p : x)) : l.filter((x) => x.id !== id)) : l));
  const now = useNow(60_000);
  const week = (posts ?? []).filter((p) => p.at > now - 7 * 86_400_000);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] [&>*]:min-w-0">
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Segmented wrap={false} label="Whose highlights" value={scope} onChange={setScope} options={[{ value: 'following', label: 'Following' }, { value: 'school', label: 'My school' }, { value: 'mine', label: 'Mine' }]} />
          <span className="flex-1" />
          <Button size="sm" onClick={() => setWriting(true)}><Icon name="plus" className="size-4" /> Add a session</Button>
        </div>
        {posts === null ? (
          <p className="py-6 text-[13px] text-muted">Loading</p>
        ) : posts.length ? (
          <div className="grid gap-3">{posts.map((p) => <HighlightCard key={p.id} post={p} onChange={(np) => replace(p.id, np)} onOpenPerson={setPerson} />)}</div>
        ) : (
          <div className="rounded-xl border border-dashed border-line px-5 py-8 text-center">
            <p className="text-[15px] font-semibold">{scope === 'mine' ? 'No highlights yet' : 'Nothing here yet'}</p>
            <p className="mx-auto mt-1 max-w-[360px] text-[13px] text-muted">{scope === 'following' ? 'Follow classmates to see where and what they study. Your own sessions show up here too.' : 'After a focus session, save it as a highlight: what you covered, where, and who you studied with.'}</p>
          </div>
        )}
      </div>
      <aside className="grid content-start gap-4">
        {scope !== 'mine' && week.length > 0 && (
          <section className="rounded-xl border border-line bg-surface p-4">
            <p className="text-[12px] font-medium text-muted">In this list this week</p>
            <p className="tnum mt-0.5 text-[20px] font-semibold">{fmtMinutes(week.reduce((n, p) => n + p.minutes, 0))}</p>
            <p className="text-[12px] text-muted">{plural(week.length, 'session')} by {plural(new Set(week.map((p) => p.userId)).size, 'person', 'people')}</p>
          </section>
        )}
        <FindPeople onOpen={setPerson} />
      </aside>
      <Dialog open={writing} onClose={() => setWriting(false)} title="Add a study session">
        {writing && <ShareForm onDone={(p) => { setWriting(false); if (p) setPosts((l) => [p, ...(l ?? [])]); }} />}
      </Dialog>
      <PersonSheet id={person} onClose={() => setPerson(null)} />
    </div>
  );
}
