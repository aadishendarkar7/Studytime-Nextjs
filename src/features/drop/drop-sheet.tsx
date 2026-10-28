'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { Sheet } from '@/components/ui/sheet';
import { useExtras } from '@/lib/stores/extras';
import { useProfile } from '@/lib/stores/profile';
import type { DropView } from '@/lib/types';
import { useNow } from '@/lib/use-now';
import { cn } from '@/lib/utils';
import { dropActions } from './actions';
import { fmtTime, markMessagesSeen, whenLabel } from './live';
import { vibeLabel } from './logic';

export const directions = (d: { lat: number | null; lng: number | null; spotName: string }) =>
  d.lat !== null && d.lng !== null ? `https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.spotName)}`;

export function Initial({ name, className, host }: { name: string; className?: string; host?: boolean }) {
  return <span className={cn('grid shrink-0 place-items-center rounded-full font-semibold', host ? 'bg-accent-fill text-white' : 'bg-surface-3 text-ink-2', className)}>{name[0]?.toUpperCase() || '?'}</span>;
}

/** Seats left, or null when the table has no limit. */
export const seatsLeft = (d: DropView) => (d.seats === null ? null : Math.max(0, d.seats - d.joiners.length));

/** Your role on a drop and the one button that matters most for it. */
export function useRole(d: DropView) {
  const mine = useExtras((s) => s.myDrops.some((m) => m.id === d.id));
  const joined = useExtras((s) => s.joinedDrops.find((j) => j.dropId === d.id));
  const me = joined ? d.joiners.find((j) => j.id === joined.joinerId) : undefined;
  return { mine, joined: !!joined, here: me?.status === 'here' };
}

export function PrimaryAction({ d, size = 'sm' }: { d: DropView; size?: 'sm' | 'md' }) {
  const { mine, joined, here } = useRole(d);
  const now = useNow(30_000);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    await fn();
    setBusy(false);
  };
  const full = seatsLeft(d) === 0;
  if (mine) return <Button size={size} variant="secondary" loading={busy} onClick={() => run(() => dropActions.extend(d))}>+1 hour</Button>;
  if (joined && d.startsAt <= now && !here) return <Button size={size} loading={busy} onClick={() => run(() => dropActions.arrive(d))}><Icon name="check" className="size-4" /> I&rsquo;m here</Button>;
  if (joined) return <Button size={size} variant="secondary" disabled>{here ? 'You are here' : 'You are going'}</Button>;
  return <Button size={size} loading={busy} disabled={full} onClick={() => run(() => dropActions.join(d))}>{full ? 'Table is full' : 'I’m coming'}</Button>;
}

function Thread({ d }: { d: DropView }) {
  const myName = useProfile((s) => s.name);
  const { mine, joined } = useRole(d);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    markMessagesSeen(d.id, d.messages.length);
    end.current?.scrollIntoView({ block: 'nearest' });
  }, [d.id, d.messages.length]);
  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setSending(true);
    if (await dropActions.message(d, t)) setText('');
    setSending(false);
  };
  return (
    <section className="mt-6">
      <h3 className="mb-2 font-sans text-[13px] font-semibold">Table talk</h3>
      <div className="max-h-72 overflow-y-auto rounded-xl border border-line bg-surface-2 p-3">
        {d.messages.length ? (
          <ul className="grid gap-2.5">
            {d.messages.map((m) => {
              const self = (mine && m.host) || (!mine && m.name === myName && !m.host);
              return (
                <li key={m.id} className={cn('flex gap-2', self && 'flex-row-reverse')}>
                  <Initial name={m.name} host={m.host} className="size-7 text-[12px]" />
                  <div className={cn('max-w-[80%] rounded-xl px-3 py-2 text-[14px] leading-5', self ? 'bg-accent-fill text-white' : 'bg-surface')}>
                    <p className={cn('mb-0.5 text-[12px] font-semibold', self ? 'opacity-70' : 'text-muted')}>{self ? 'You' : m.name}{m.host && !self ? ' · host' : ''} · {fmtTime(m.at)}</p>
                    {m.text}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-1 py-2 text-[14px] text-muted">{mine ? 'Post where exactly you are sitting, or when you are stepping out.' : 'Ask which table, or say you are running late.'}</p>
        )}
        <div ref={end} />
      </div>
      <form className="mt-2 flex gap-2" onSubmit={(e) => (e.preventDefault(), void send())}>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={280} aria-label="Message" placeholder={mine || joined ? 'Window table on the left' : 'Is there room for one more?'} className="h-11 min-w-0 flex-1 rounded-xl border border-line-strong bg-surface px-3.5 text-[15px] outline-none focus:border-accent" />
        <Button type="submit" loading={sending} aria-label="Send"><Icon name="send" className="size-4" /></Button>
      </form>
    </section>
  );
}

/** Everything about one drop: who is there, the thread, and what you can do. */
export function DropSheet({ d, onClose, distance }: { d: DropView | null; onClose: () => void; distance?: string }) {
  const now = useNow(30_000);
  const role = useRole(d ?? ({ id: '', joiners: [] } as unknown as DropView));
  if (!d) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>;
  const live = d.startsAt <= now;
  const left = seatsLeft(d);
  const here = d.joiners.filter((j) => j.status === 'here');
  const coming = d.joiners.filter((j) => j.status !== 'here');
  return (
    <Sheet open onClose={onClose} title={d.spotName}>
      <div className="flex items-center gap-3">
        <Initial name={d.name} host className="size-10 text-[16px]" />
        <div className="min-w-0">
          <p className="text-[15px] font-semibold">{role.mine ? 'Your drop' : `${d.name} ${live ? 'is studying here' : 'will study here'}`}</p>
          <p className="tnum text-[14px] text-muted">{whenLabel(d, now)}{distance ? ` · ${distance} away` : ''}</p>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-2 text-[13px]">
        <div className="rounded-xl bg-surface-2 px-3 py-2.5"><dt className="text-muted">Studying</dt><dd className="mt-0.5 truncate font-semibold">{d.subject || 'Anything'}</dd></div>
        <div className="rounded-xl bg-surface-2 px-3 py-2.5"><dt className="text-muted">Vibe</dt><dd className="mt-0.5 font-semibold">{vibeLabel(d.vibe)}</dd></div>
        <div className="rounded-xl bg-surface-2 px-3 py-2.5"><dt className="text-muted">Seats</dt><dd className="tnum mt-0.5 font-semibold">{left === null ? 'Open' : left === 0 ? 'Full' : `${left} left`}</dd></div>
      </dl>
      {d.note && <p className="mt-3 rounded-xl border border-line px-3.5 py-2.5 text-[14px] text-ink-2">{d.note}</p>}

      <div className="mt-5 flex flex-wrap gap-2">
        <PrimaryAction d={d} size="md" />
        <a href={directions(d)} target="_blank" rel="noreferrer"><Button variant="secondary">Directions</Button></a>
        <Button variant="secondary" onClick={() => dropActions.share(d)}>Invite</Button>
        <Button variant="ghost" onClick={() => dropActions.addToCalendar(d)}>Add to calendar</Button>
      </div>

      <section className="mt-6">
        <h3 className="mb-2 font-sans text-[13px] font-semibold">At the table</h3>
        <ul className="grid gap-1.5 text-[14px]">
          <li className="flex items-center gap-2.5"><Initial name={d.name} host className="size-8 text-[13px]" /><span className="flex-1 font-medium">{role.mine ? 'You' : d.name}</span><span className="text-[13px] text-muted">Host</span></li>
          {here.map((j) => <li key={j.id} className="flex items-center gap-2.5"><Initial name={j.name} className="size-8 text-[13px]" /><span className="flex-1 font-medium">{j.name}</span><span className="inline-flex items-center gap-1 text-[13px] font-semibold text-ok"><span className="size-1.5 rounded-full bg-ok" />Here</span></li>)}
          {coming.map((j) => <li key={j.id} className="flex items-center gap-2.5"><Initial name={j.name} className="size-8 text-[13px]" /><span className="flex-1 font-medium">{j.name}</span><span className="text-[13px] text-muted">On the way</span></li>)}
        </ul>
        {!d.joiners.length && <p className="mt-1 text-[13px] text-muted">No one has joined yet.</p>}
      </section>

      <Thread d={d} />

      <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-4">
        {role.mine && <Button variant="danger" onClick={() => dropActions.end(d).then(onClose)}>End drop</Button>}
        {role.joined && role.here && <Button variant="ghost" onClick={() => dropActions.arrive(d, false)}>Not there yet</Button>}
        {role.joined && <Button variant="ghost" onClick={() => dropActions.leave(d)}>I can&rsquo;t make it</Button>}
      </div>
    </Sheet>
  );
}
