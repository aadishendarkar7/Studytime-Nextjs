'use client';
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { toneFor } from '@/features/chat/live';
import { weekMinutes } from '@/features/focus/logic';
import { api, ApiError } from '@/lib/api';
import { useExtras } from '@/lib/stores/extras';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import type { PactView } from '@/lib/types';
import { cn, copyText, fmtMinutes } from '@/lib/utils';

export const PACT_BONUS = 100;
const usePact = create<{ pact: PactView | null; error: string }>()(() => ({ pact: null, error: '' }));

/** Sends your minutes this week and pulls your partner's. Awards the bonus once when you both hit the goal. */
export async function syncPact() {
  const x = useExtras.getState();
  if (!x.pact) return;
  const p = useProfile.getState();
  try {
    const v = await api.pacts.report(x.pact.code, x.pact.memberId, x.pact.token, { name: p.name, minutes: weekMinutes(p.sessions) });
    usePact.setState({ pact: v, error: '' });
    const both = v.members.length === 2 && v.members.every((m) => m.minutes >= v.goal);
    if (both && x.pact.awardedWeek !== v.week) {
      p.update({ points: p.points + PACT_BONUS });
      useExtras.getState().update({ pact: { ...x.pact, awardedWeek: v.week } });
      const other = v.members.find((m) => m.id !== x.pact!.memberId);
      toast(`You and ${other?.name ?? 'your partner'} both hit ${fmtMinutes(v.goal)} this week. +${PACT_BONUS} points each.`);
    }
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) {
      useExtras.getState().update({ pact: null });
      usePact.setState({ pact: null, error: '' });
    } else usePact.setState({ error: (e as Error).message });
  }
}

export function usePactSync() {
  const has = useExtras((s) => Boolean(s.pact));
  useEffect(() => {
    if (!has) return;
    void syncPact();
    const id = setInterval(() => void syncPact(), 60_000);
    const off = useProfile.subscribe((s, prev) => s.sessions.length !== prev.sessions.length && void syncPact());
    return () => (clearInterval(id), off());
  }, [has]);
}

function Setup() {
  const p = useProfile();
  const x = useExtras();
  const [hours, setHours] = useState(5);
  const [code, setCode] = useState(() => (typeof location !== 'undefined' ? new URLSearchParams(location.search).get('pact') ?? '' : ''));
  const [busy, setBusy] = useState(false);
  const start = async () => {
    setBusy(true);
    try {
      const r = await api.pacts.create(p.name, hours * 60);
      x.update({ pact: { code: r.code, memberId: r.memberId, token: r.token, awardedWeek: '' } });
      await syncPact();
      toast(`Pact made. Share code ${r.code} with your partner.`);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const join = async () => {
    if (!/^[a-f0-9]{6}$/i.test(code.trim())) return toast('Pact codes are 6 letters and numbers.', 'error');
    setBusy(true);
    try {
      const r = await api.pacts.join(code.trim().toUpperCase(), p.name);
      x.update({ pact: { code: code.trim().toUpperCase(), memberId: r.memberId, token: r.token, awardedWeek: '' } });
      usePact.setState({ pact: r.pact });
      await syncPact();
      toast('You are in. Good luck this week.');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-4 grid gap-3">
      <div className="rounded-xl border border-line p-3.5">
        <p className="text-[13px] font-semibold">Start a pact</p>
        <div className="mt-2 flex gap-2">
          <Select aria-label="Weekly goal" value={hours} onChange={(e) => setHours(Number(e.target.value))} className="flex-1">
            {[2, 3, 5, 8, 10, 15, 20].map((h) => <option key={h} value={h}>{h} hours each</option>)}
          </Select>
          <Button loading={busy} onClick={start}>Start</Button>
        </div>
      </div>
      <form className="rounded-xl border border-line p-3.5" onSubmit={(e) => (e.preventDefault(), void join())}>
        <p className="text-[13px] font-semibold">Join with a code</p>
        <div className="mt-2 flex gap-2">
          <Input aria-label="Pact code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="A1B2C3" className="tnum flex-1 uppercase" />
          <Button type="submit" variant="secondary" loading={busy}>Join</Button>
        </div>
      </form>
    </div>
  );
}

/** Weekly accountability pact: two people, one weekly focus goal, a bonus only if you both make it. */
export function PactCard({ className }: { className?: string }) {
  const x = useExtras();
  const me = useProfile();
  const { pact, error } = usePact();
  const mine = x.pact;
  const leave = async () => {
    if (!mine || !confirm('Leave this pact? Your partner keeps their progress.')) return;
    await api.pacts.leave(mine.code, mine.memberId, mine.token).catch(() => {});
    x.update({ pact: null });
    usePact.setState({ pact: null });
  };
  const both = pact && pact.members.length === 2 && pact.members.every((m) => m.minutes >= pact.goal);
  return (
    <section className={cn('rounded-xl border border-line bg-surface p-5 max-sm:p-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-sans text-[15px] leading-6 font-semibold">Weekly pact</h2>
          <p className="text-[13px] leading-5 text-muted">Two of you commit to a weekly focus goal and see each other&rsquo;s progress. Both hit it: +{PACT_BONUS} points each. If either misses, neither gets it.</p>
        </div>
        {mine && <Button size="sm" variant="ghost" onClick={leave}>Leave</Button>}
      </div>
      {!mine ? <Setup /> : !pact ? <p className="mt-4 text-[13px] text-muted">Loading your pact</p> : (
        <div className="mt-4 grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
            <span className="text-muted">Goal: <strong className="font-semibold text-ink">{fmtMinutes(pact.goal)}</strong> each this week</span>
            {both ? <span className="rounded-md bg-ok-soft px-1.5 font-medium text-ok">Both made it</span> : null}
          </div>
          {pact.members.map((m) => {
            const isMe = m.id === mine.memberId;
            const pct = Math.min(100, Math.round((m.minutes / pact.goal) * 100));
            return (
              <div key={m.id} className="flex items-center gap-3">
                <Avatar name={isMe ? me.name : m.name} color={isMe ? undefined : toneFor(m.id)} size={30} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2 text-[13px]">
                    <span className="truncate font-medium">{isMe ? 'You' : m.name}</span>
                    <span className="tnum text-muted">{fmtMinutes(m.minutes)} · {pct}%</span>
                  </div>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface-3"><span className={cn('block h-full rounded-full', pct >= 100 ? 'bg-ok' : isMe ? 'bg-ink' : 'bg-accent')} style={{ width: `${pct}%` }} /></span>
                </div>
              </div>
            );
          })}
          {pact.members.length < 2 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-2 px-3 py-2.5 text-[13px]">
              <span className="text-ink-2">Waiting for your partner. Code</span>
              <strong className="tnum tracking-wider">{pact.code}</strong>
              <Button size="sm" variant="secondary" className="ml-auto" onClick={async () => toast((await copyText(`Join my Studytime pact: ${fmtMinutes(pact.goal)} each this week. ${location.origin}/drop?tab=friends&view=pact&pact=${pact.code} (code ${pact.code})`)) ? 'Invite copied.' : 'Could not copy.')}>Copy invite</Button>
            </div>
          )}
        </div>
      )}
      {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}
    </section>
  );
}
