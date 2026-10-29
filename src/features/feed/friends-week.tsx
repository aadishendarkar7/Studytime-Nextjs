'use client';
import { useEffect, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { toneFor } from '@/features/chat/live';
import { api } from '@/lib/api';
import { useProfile } from '@/lib/stores/profile';
import { useNow } from '@/lib/use-now';
import { cn, fmtMinutes } from '@/lib/utils';

/** You against friends who follow you back: focus time over the last 7 days, as bars. */
export function FriendsWeek({ onOpen }: { onOpen?: (id: string) => void }) {
  const [friends, setFriends] = useState<{ id: string; name: string; minutes: number }[] | null>(null);
  const sessions = useProfile((s) => s.sessions);
  const name = useProfile((s) => s.name);
  const now = useNow(60_000);
  useEffect(() => {
    let live = true;
    const load = () => api.people.week().then((r) => live && setFriends(r.friends)).catch(() => live && setFriends([]));
    void load();
    const id = setInterval(load, 5 * 60_000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, []);
  if (!friends?.length) return null;
  const mine = sessions.filter((s) => new Date(s.at).getTime() > now - 7 * 86_400_000).reduce((n, s) => n + s.minutes, 0);
  const rows = [...friends, { id: 'me', name, minutes: mine }].sort((a, b) => b.minutes - a.minutes).slice(0, 8);
  const top = Math.max(1, ...rows.map((r) => r.minutes));
  const myRank = rows.findIndex((r) => r.id === 'me');
  const ahead = myRank > 0 ? rows[myRank - 1] : null;
  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <p className="text-[13px] font-semibold">You vs friends</p>
        <p className="text-[12px] text-muted">Last 7 days</p>
      </div>
      <ol className="grid gap-2.5">
        {rows.map((r) => {
          const me = r.id === 'me';
          return (
            <li key={r.id}>
              <button type="button" disabled={me || !onOpen} onClick={() => onOpen?.(r.id)} className="flex w-full items-center gap-2.5 text-left disabled:cursor-default">
                <Avatar name={r.name} color={toneFor(r.id)} size={24} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2 text-[13px]">
                    <span className={cn('truncate', me ? 'font-semibold' : 'font-medium')}>{me ? 'You' : r.name.split(' ')[0]}</span>
                    <span className="tnum shrink-0 text-muted">{fmtMinutes(r.minutes)}</span>
                  </span>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface-3"><span className={cn('block h-full rounded-full transition-[width] duration-700', me ? 'bg-accent' : 'bg-line-strong')} style={{ width: `${(r.minutes / top) * 100}%` }} /></span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {ahead && <p className="mt-3 border-t border-line pt-2.5 text-[12px] text-ink-2">{fmtMinutes(ahead.minutes - mine + 1)} more to pass {ahead.name.split(' ')[0]}</p>}
    </section>
  );
}
