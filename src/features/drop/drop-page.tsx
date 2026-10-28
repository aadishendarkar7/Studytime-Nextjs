'use client';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { Empty } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox, Select } from '@/components/ui/field';
import { Icon } from '@/components/ui/icons';
import { Tabs } from '@/components/ui/segmented';
import type { MapPin } from '@/features/spots/spot-map';
import { PartnersPage } from '@/features/partners/partners-page';
import { RoomsPage } from '@/features/rooms/rooms-page';
import { ChatPage } from '@/features/chat/chat-page';
import { useUnreadDms } from '@/features/chat/live';
import { FriendsPage } from '@/features/social/friends-page';
import { PactCard } from '@/features/pact/pact-card';
import { Segmented } from '@/components/ui/segmented';
import { api } from '@/lib/api';
import { useExtras } from '@/lib/stores/extras';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import { CATEGORIES, type DropView, type DropVibe } from '@/lib/types';
import { useNow } from '@/lib/use-now';
import { cn, fmtMinutes, plural } from '@/lib/utils';
import { useDropComposer } from './composer';
import { EventsTab } from './events-tab';
import { DropSheet, Initial, PrimaryAction, seatsLeft } from './drop-sheet';
import { refreshDrops, useDrops, whenLabel } from './live';
import { distanceKm, dropStats, fmtDistance, hotSpots, recentPlaces, VIBES, vibeLabel } from './logic';

const SpotMap = dynamic(() => import('@/features/spots/spot-map').then((m) => m.SpotMap), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center bg-surface-3 text-[14px] text-muted">Loading map</div>,
});

type Tab = 'live' | 'events' | 'yours' | 'rooms' | 'partners' | 'friends';
const TABS: { value: Tab; label: string }[] = [
  { value: 'live', label: 'Live map' },
  { value: 'friends', label: 'Friends' },
  { value: 'events', label: 'Events' },
  { value: 'yours', label: 'Your drops' },
  { value: 'rooms', label: 'Study rooms' },
  { value: 'partners', label: 'Find partners' },
];
type Point = { lat: number; lng: number };
const useMiles = () => typeof navigator !== 'undefined' && /-(US|LR|MM)$/i.test(navigator.language);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={cn('inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-medium transition-colors', on ? 'border-accent-fill bg-accent-fill text-white' : 'border-line bg-surface text-ink-2 hover:border-line-strong/60 hover:text-ink')}>
      {children}
    </button>
  );
}

function DropRow({ d, me, onOpen, selected }: { d: DropView; me: Point | null; onOpen: () => void; selected: boolean }) {
  const now = useNow(30_000);
  const mine = useExtras((s) => s.myDrops.some((m) => m.id === d.id));
  const miles = useMiles();
  const live = d.startsAt <= now;
  const left = seatsLeft(d);
  const dist = me && d.lat !== null && d.lng !== null ? fmtDistance(distanceKm(me, { lat: d.lat, lng: d.lng }), miles) : null;
  const here = d.joiners.filter((j) => j.status === 'here').length;
  return (
    <article id={`drop-${d.id}`} className={cn('transition-colors', selected ? 'bg-accent-soft' : 'hover:bg-surface-2')}>
      <button type="button" onClick={onOpen} className="flex w-full items-start gap-3 px-4 pt-3.5 pb-2 text-left">
        <Initial name={d.name} host={mine} className={cn('size-9 text-[14px]', !mine && 'bg-[#3f3f46] text-white')} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] leading-5"><strong className="font-semibold text-ink">{mine ? 'You' : d.name}</strong> <span className="text-muted">{live ? 'at' : 'later at'}</span> <span className="font-medium">{d.spotName}</span></span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] text-muted">
            {live ? <span className="inline-flex items-center gap-1 font-semibold text-ok"><span className="size-1.5 rounded-full bg-ok" />Live</span> : null}
            <span className="tnum">{whenLabel(d, now)}</span>
            {d.subject && <span>· {d.subject}</span>}
            <span>· {vibeLabel(d.vibe)}</span>
            {d.category && d.category !== 'Anything goes' && <span>· {d.category}</span>}
            {dist && <span className="tnum">· {dist}</span>}
          </span>
        </span>
        {d.messages.length > 0 && <span className="tnum mt-1 flex items-center gap-1 text-[12px] font-semibold text-muted"><Icon name="ai" className="size-3.5" />{d.messages.length}</span>}
      </button>
      <div className="flex flex-wrap items-center justify-between gap-2 py-2 pr-4 pl-16">
        <span className="flex items-center gap-2 text-[12px] text-muted">
          {d.joiners.length ? (
            <>
              <span className="flex -space-x-2">{d.joiners.slice(0, 4).map((j) => <Initial key={j.id} name={j.name} className="size-6 border-2 border-surface text-[11px]" />)}</span>
              {here ? `${here} here` : ''}{here && d.joiners.length > here ? ', ' : ''}{d.joiners.length > here ? `${d.joiners.length - here} coming` : ''}
            </>
          ) : 'No one yet'}
          {left !== null && <span className={cn('tnum', left === 0 && 'font-semibold text-warn')}>· {left === 0 ? 'full' : plural(left, 'seat') + ' left'}</span>}
        </span>
        <PrimaryAction d={d} />
      </div>
    </article>
  );
}

/** The drop you are hosting or heading to, pinned above everything else. */
function YourDropBar({ onOpen }: { onOpen: (id: string) => void }) {
  const drops = useDrops((s) => s.drops);
  const x = useExtras();
  const now = useNow(30_000);
  const mineIds = new Set(x.myDrops.map((m) => m.id));
  const joinedIds = new Set(x.joinedDrops.map((j) => j.dropId));
  const active = drops.filter((d) => (mineIds.has(d.id) || joinedIds.has(d.id)) && d.endsAt > now).sort((a, b) => a.startsAt - b.startsAt);
  if (!active.length) return null;
  return (
    <div className="mb-5 grid gap-2">
      {active.map((d) => {
        const mine = mineIds.has(d.id);
        const here = d.joiners.filter((j) => j.status === 'here').length;
        const live = d.startsAt <= now;
        return (
          <div key={d.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-accent/30 bg-accent-soft px-4 py-2.5">
            <span className="relative grid size-8 place-items-center rounded-lg bg-accent-fill text-white"><Icon name="pin" className="size-4" />{live && <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full border-2 border-surface bg-ok" />}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold text-ink">{mine ? (live ? `You are live at ${d.spotName}` : `You dropped ${d.spotName}`) : `Joining ${d.name} at ${d.spotName}`}</p>
              <p className="tnum text-[12px] text-ink-2">{whenLabel(d, now)}{mine ? ` · ${d.joiners.length ? `${here} here, ${d.joiners.length - here} coming` : 'waiting for people'}` : ''}{d.messages.length ? ` · ${plural(d.messages.length, 'message')}` : ''}</p>
            </div>
            <div className="flex gap-2">
              <PrimaryAction d={d} />
              <Button size="sm" variant="secondary" onClick={() => onOpen(d.id)}>Open</Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LiveTab({ openId, setOpenId }: { openId: string | null; setOpenId: (id: string | null) => void }) {
  const { drops, loaded, error } = useDrops();
  const x = useExtras();
  const p = useProfile();
  const now = useNow(30_000);
  const [vibe, setVibe] = useState<DropVibe | 'all'>('all');
  const [category, setCategory] = useState('all');
  const [myCourses, setMyCourses] = useState(false);
  const [me, setMe] = useState<Point | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lng: number; zoom?: number } | null>(() => {
    const d = useDrops.getState().drops.find((d) => d.lat !== null) ?? null;
    const s = useExtras.getState().spots[0];
    return d ? { lat: d.lat!, lng: d.lng!, zoom: 15 } : s ? { lat: s.lat, lng: s.lng, zoom: 15 } : null;
  });

  useEffect(
    () =>
      useDrops.subscribe((s) => {
        const d = s.drops.find((d) => d.lat !== null);
        if (d) setFocus((f) => f ?? { lat: d.lat!, lng: d.lng!, zoom: 16 });
      }),
    [],
  );

  const nearMe = () => {
    if (me) return setMe(null);
    if (!navigator.geolocation) return toast('This browser cannot share your location.', 'error');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const pt = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMe(pt);
        setFocus({ ...pt, zoom: 15 });
      },
      () => toast('Location was blocked, so drops stay in time order.', 'error'),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const courses = p.courses.map(norm).filter(Boolean);
  const shown = useMemo(() => {
    let list = drops.filter((d) => (vibe === 'all' || d.vibe === vibe) && (category === 'all' || d.category === category));
    if (myCourses && courses.length) list = list.filter((d) => courses.some((c) => norm(d.subject).includes(c)));
    if (me) {
      const dist = (d: DropView) => (d.lat !== null && d.lng !== null ? distanceKm(me, { lat: d.lat, lng: d.lng }) : Infinity);
      list = [...list].sort((a, b) => dist(a) - dist(b));
    }
    return list;
  }, [drops, vibe, category, myCourses, courses, me]);
  const nowList = shown.filter((d) => d.startsAt <= now);
  const later = shown.filter((d) => d.startsAt > now);
  const hot = hotSpots(drops, now).filter((h) => h.people > 1).slice(0, 4);
  const filtered = vibe !== 'all' || myCourses || category !== 'all';

  const pins = useMemo<MapPin[]>(() => {
    const mine = new Set(x.myDrops.map((m) => m.id));
    return [
      ...x.spots.map((s) => ({ id: `spot-${s.id}`, lat: s.lat, lng: s.lng, title: s.name, body: 'Your saved spot', kind: 'mine' as const })),
      ...shown.filter((d) => d.lat !== null && d.lng !== null).map((d) => ({ id: d.id, lat: d.lat!, lng: d.lng!, title: `${d.name} at ${d.spotName}`, body: `${whenLabel(d)} · ${vibeLabel(d.vibe)}${d.joiners.length ? ` · ${d.joiners.length + 1} people` : ''}`, kind: mine.has(d.id) ? ('mydrop' as const) : ('drop' as const), label: d.name })),
    ];
  }, [shown, x.spots, x.myDrops]);

  const open = (id: string) => {
    setOpenId(id);
    const d = drops.find((d) => d.id === id);
    if (d?.lat != null && d.lng != null) setFocus({ lat: d.lat, lng: d.lng, zoom: 17 });
  };

  return (
    <div className="grid gap-5 lg:grid-cols-12 [&>*]:min-w-0">
      <section className="relative self-start overflow-hidden rounded-xl border border-line bg-surface lg:sticky lg:top-6 lg:col-span-7">
        <SpotMap pins={pins} focus={focus} onSelect={(id) => !id.startsWith('spot-') && open(id)} onPick={(lat, lng) => useDropComposer.getState().show({ lat, lng })} className="h-[620px] max-sm:h-[380px]" />
        <div className="pointer-events-none absolute inset-x-3 top-3 z-[500] flex justify-end">
          <button type="button" onClick={nearMe} className={cn('pointer-events-auto inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium shadow-sm', me ? 'border-accent-fill bg-accent-fill text-white' : 'border-line bg-surface text-ink')}>
            <Icon name="locate" className="size-4" /> {me ? 'Nearest first' : 'Near me'}
          </button>
        </div>
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-[500] flex justify-between gap-2">
          <span className="pointer-events-auto rounded-lg border border-line bg-surface/95 px-2.5 py-1 text-[12px] font-medium text-ink-2">{nowList.length ? `${plural(nowList.length, 'drop')} live` : 'Quiet right now'}{later.length ? ` · ${later.length} later` : ''}</span>
          <span className="pointer-events-auto rounded-lg border border-line bg-surface/95 px-2.5 py-1 text-[12px] text-muted max-sm:hidden">Click anywhere on the map to drop there</span>
        </div>
      </section>

      <div className="grid content-start gap-5 lg:col-span-5">
        {error && <p className="rounded-xl bg-danger-soft px-4 py-3 text-[14px] text-danger">{error}</p>}

        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          <Chip on={vibe === 'all'} onClick={() => setVibe('all')}>All</Chip>
          {VIBES.map((v) => <Chip key={v.value} on={vibe === v.value} onClick={() => setVibe(vibe === v.value ? 'all' : v.value)}>{v.label}</Chip>)}
          {courses.length > 0 && <Chip on={myCourses} onClick={() => setMyCourses(!myCourses)}>My courses</Chip>}
          <Select aria-label="Category" className="h-8 w-auto shrink-0 text-[13px]" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </Select>
        </div>

        {hot.length > 0 && (
          <section>
            <h2 className="mb-1 font-sans text-[13px] font-semibold">Busy right now</h2>
            <ol className="grid gap-1.5">
              {hot.map((h, i) => (
                <li key={h.key}>
                  <button type="button" onClick={() => (h.lat !== null && h.lng !== null ? setFocus({ lat: h.lat, lng: h.lng, zoom: 17 }) : open(h.drops[0]))} className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-surface-3">
                    <span className="tnum w-4 text-[13px] font-semibold text-muted">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{h.name}</span>
                    <span className="flex items-end gap-0.5" aria-hidden="true">{Array.from({ length: Math.min(6, h.people) }, (_, k) => <span key={k} className="w-1 rounded-full bg-accent" style={{ height: 6 + k * 2 }} />)}</span>
                    <span className="tnum w-20 text-right text-[13px] text-muted">{plural(h.people, 'person', 'people')}</span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section>
          <h2 className="mb-2 font-sans text-[13px] font-semibold">Studying now</h2>
          <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface empty:hidden">
            {nowList.length ? nowList.map((d) => <DropRow key={d.id} d={d} me={me} selected={openId === d.id} onOpen={() => open(d.id)} />) : loaded && (
              <Empty title={filtered ? 'No drops match those filters' : 'No one has dropped a spot yet'}>
                {filtered ? 'Try All, or drop your own spot with this vibe.' : `${p.school ? `Be the first at ${p.school}. ` : ''}Drop where you are studying and your friends get a heads-up to come join.`}
              </Empty>
            )}
          </div>
        </section>
        {later.length > 0 && (
          <section>
            <h2 className="mb-2 font-sans text-[13px] font-semibold">Later</h2>
            <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">{later.map((d) => <DropRow key={d.id} d={d} me={me} selected={openId === d.id} onOpen={() => open(d.id)} />)}</div>
          </section>
        )}

        <section className="rounded-xl border border-line bg-surface p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-sans text-[13px] font-semibold">Saved spots</h2>
            <span className="text-[13px] text-muted">{x.spots.length} saved</span>
          </div>
          {x.spots.length ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {x.spots.map((s) => (
                <li key={s.id} className="flex items-center gap-1 rounded-lg bg-surface-3 py-1 pr-1 pl-2.5 text-[13px]">
                  <button type="button" className="font-medium hover:underline" onClick={() => setFocus({ lat: s.lat, lng: s.lng, zoom: 17 })}>{s.name}</button>
                  <button type="button" aria-label={`Drop at ${s.name}`} title="Drop here" onClick={() => useDropComposer.getState().show({ again: { id: s.id, spotName: s.name, subject: '', vibe: x.dropVibe, lat: s.lat, lng: s.lng, at: 0, minutes: 120, role: 'host', with: [] } })} className="grid size-6 place-items-center rounded text-muted hover:text-accent-ink"><Icon name="pin" className="size-3.5" /></button>
                  <button type="button" aria-label={`Remove ${s.name}`} onClick={() => x.update({ spots: x.spots.filter((y) => y.id !== s.id) })} className="grid size-6 place-items-center rounded text-muted hover:text-danger"><Icon name="close" className="size-3" /></button>
                </li>
              ))}
            </ul>
          ) : <p className="mt-1 text-[13px] text-muted">Places you drop with a location can be saved here for next time.</p>}
          <Checkbox label="Mute drop notifications" checked={x.dropQuiet} onChange={(e) => x.update({ dropQuiet: e.target.checked })} />
          <p className="text-[13px] text-muted">For days you want to study alone. You still see drops here.</p>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, note, small }: { label: string; value: string; note?: string; small?: boolean }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-surface p-4">
      <p className="text-[13px] text-muted">{label}</p>
      <p className={cn('tnum mt-1 truncate font-display', small ? 'text-[20px] leading-8' : 'text-[28px] leading-8')}>{value}</p>
      {note && <p className="mt-1 truncate text-[13px] text-muted">{note}</p>}
    </div>
  );
}

const ROLE: Record<'host' | 'joined' | 'solo', string> = { host: 'You hosted', joined: 'You joined', solo: 'Solo' };

function YoursTab() {
  const x = useExtras();
  const now = useNow(60_000);
  const s = dropStats(x.dropLog, now);
  const again = recentPlaces(x.dropLog, 6);
  const log = [...x.dropLog].filter((e) => e.at <= now).sort((a, b) => b.at - a.at).slice(0, 40);
  if (!x.dropLog.length)
    return (
      <Empty title="Your drops show up here" action={<Button onClick={() => useDropComposer.getState().show()}><Icon name="pin" className="size-4" /> Drop your first spot</Button>}>
        Every spot you drop, join, or study at solo is saved in this browser, with who you studied with.
      </Empty>
    );
  return (
    <div className="grid gap-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Drops this month" value={String(s.thisMonth)} note={`${s.total} all time`} />
        <Stat label="Time at spots" value={fmtMinutes(Math.round(s.minutes))} />
        <Stat label="People studied with" value={String(s.people)} note={s.withMost ? `Most with ${s.withMost.name}` : 'Drop to your friends to start'} />
        <Stat small label="Favorite spot" value={s.topSpot?.name ?? 'None yet'} note={s.topSpot ? plural(s.topSpot.count, 'visit') : undefined} />
      </div>

      {again.length > 0 && (
        <section>
          <h2 className="mb-2 font-sans text-[13px] font-semibold">Drop again</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {again.map((e) => (
              <button key={e.id} type="button" onClick={() => useDropComposer.getState().show({ again: e })} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-left hover:border-line-strong/60">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-3 text-ink-2"><Icon name="pin" className="size-4" /></span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-[14px] font-medium">{e.spotName}</strong>
                  <span className="block truncate text-[13px] text-muted">{[e.subject, vibeLabel(e.vibe)].filter(Boolean).join(' · ')}</span>
                </span>
                <Icon name="plus" className="size-4 text-muted" />
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="font-sans text-[13px] font-semibold">History</h2>
          <Button size="sm" variant="ghost" onClick={() => confirm('Clear your drop history from this browser?') && x.update({ dropLog: [] })}>Clear</Button>
        </div>
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {log.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
              <span className="tnum w-24 shrink-0 text-[13px] text-muted">{new Date(e.at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-[14px] font-medium">{e.spotName}</strong>
                <span className="block truncate text-[13px] text-muted">{ROLE[e.role]}{e.subject ? ` · ${e.subject}` : ''}{e.with.length ? ` · with ${e.with.slice(0, 3).join(', ')}${e.with.length > 3 ? ` +${e.with.length - 3}` : ''}` : ''}</span>
              </span>
              <span className="tnum text-[13px] text-muted">{fmtMinutes(Math.round(Math.min(e.minutes, (now - e.at) / 60_000)))}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Friends: chat with classmates and see who is online, or manage your circle and classes. */
function FriendsTab() {
  const [view, setView] = useState<'chat' | 'circle' | 'pact'>(() => (typeof location === 'undefined' ? 'chat' : /[?&](view=pact|pact=)/.test(location.search) ? 'pact' : /[?&](view=circle|circle=|class=)/.test(location.search) ? 'circle' : 'chat'));
  const unread = useUnreadDms();
  const toggle = <Segmented wrap={false} label="Friends view" value={view} onChange={setView} options={[{ value: 'chat', label: unread ? `Messages (${unread})` : 'Messages' }, { value: 'pact', label: 'Weekly pact' }, { value: 'circle', label: 'Circle & classes' }]} />;
  if (view === 'chat') return <ChatPage toolbar={toggle} />;
  return (
    <>
      <div className="mb-3">{toggle}</div>
      {view === 'pact' ? <PactCard className="max-w-2xl" /> : <FriendsPage embedded />}
    </>
  );
}

export function DropPage() {
  const unreadDms = useUnreadDms();
  const drops = useDrops((s) => s.drops);
  const now = useNow(60_000);
  const [tab, setTab] = useState<Tab>(() => {
    const t = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('tab') : null;
    return TABS.some((x) => x.value === t) ? (t as Tab) : 'live';
  });
  const [openId, setOpenId] = useState<string | null>(() => (typeof location !== 'undefined' ? new URLSearchParams(location.search).get('d') : null));
  // A drop opened from an invite link may not be in your list (another school, say).
  const [linked, setLinked] = useState<DropView | null>(null);
  const go = (t: Tab) => (setTab(t), history.replaceState(null, '', t === 'live' ? '/drop' : `/drop?tab=${t}`));

  useEffect(() => {
    void refreshDrops();
    const id = setInterval(() => void refreshDrops(), openId ? 8_000 : 20_000);
    return () => clearInterval(id);
  }, [openId]);

  const inList = openId ? drops.find((d) => d.id === openId) ?? null : null;
  const needsFetch = !!openId && !inList && useDrops.getState().loaded;
  useEffect(() => {
    if (!needsFetch || !openId) return;
    let stop = false;
    const load = () =>
      api.drops.get(openId).then(
        (r) => !stop && setLinked(r.drop),
        (e) => {
          if (stop) return;
          toast((e as Error).message, 'error');
          setOpenId(null);
        },
      );
    void load();
    const id = setInterval(load, 8_000);
    return () => ((stop = true), clearInterval(id));
  }, [needsFetch, openId]);

  const current = inList ?? (linked && linked.id === openId ? linked : null);
  const close = () => {
    setOpenId(null);
    setLinked(null);
    if (location.search.includes('d=')) history.replaceState(null, '', tab === 'live' ? '/drop' : `/drop?tab=${tab}`);
  };
  const live = drops.filter((d) => d.startsAt <= now);
  const people = live.reduce((n, d) => n + 1 + d.joiners.length, 0);

  return (
    <>
      <header className="mt-4 mb-4 flex flex-wrap items-end justify-between gap-4 max-sm:mt-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[12px] font-medium text-muted">
            <span className={cn('size-2 rounded-full', live.length ? 'bg-ok' : 'bg-line-strong')} />
            {live.length ? `${plural(people, 'person', 'people')} studying at ${plural(live.length, 'spot')} right now` : 'No one is out right now'}
          </p>
          <h1 className="mt-1 text-[26px] leading-8 max-sm:text-[22px]">Drop a Spot</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => useDropComposer.getState().show({ solo: true })}>Study solo</Button>
          <Button onClick={() => useDropComposer.getState().show()}><Icon name="pin" className="size-4" /> Drop a spot</Button>
        </div>
      </header>
      <YourDropBar onOpen={setOpenId} />
      <Tabs className="mb-5" label="Drop a Spot sections" value={tab} onChange={go} options={TABS.map((t) => (t.value === 'friends' ? { ...t, count: unreadDms } : t))} />
      {tab === 'live' && <LiveTab openId={openId} setOpenId={setOpenId} />}
      {tab === 'events' && <EventsTab />}
      {tab === 'yours' && <YoursTab />}
      {tab === 'rooms' && <RoomsPage embedded />}
      {tab === 'partners' && <PartnersPage embedded />}
      {tab === 'friends' && (
        <FriendsTab />
      )}
      <DropSheet d={current} onClose={close} />
    </>
  );
}

