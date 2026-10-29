'use client';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { useExtras } from '@/lib/stores/extras';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import { useNow } from '@/lib/use-now';
import { cn, fmtMinutes } from '@/lib/utils';
import { challengeStates, type ChallengeState } from './logic';

const fmt = (s: ChallengeState, n: number) => (s.challenge.unit === 'min' ? fmtMinutes(n) : String(n));
const left = (ms: number) => {
  const h = Math.max(0, Math.round(ms / 3_600_000));
  return h >= 48 ? `${Math.round(h / 24)} days left` : `${h}h left`;
};

export function useChallengeStates() {
  const x = useExtras();
  const sessions = useProfile((s) => s.sessions);
  const now = useNow(60_000);
  return challengeStates(x.challenges, { sessions, dropLog: x.dropLog, rewardDays: x.rewardDays }, now);
}

function join(id: string) {
  const x = useExtras.getState();
  x.update({ challenges: [...x.challenges, { id, joinedAt: Date.now(), doneAt: null }] });
}
function leave(s: ChallengeState) {
  if (!s.entry || !confirm(`Leave ${s.challenge.title}?`)) return;
  const x = useExtras.getState();
  x.update({ challenges: x.challenges.filter((j) => j !== s.entry) });
}

/** Join a challenge, watch the bar fill, finish it for points and a trophy. */
export function ChallengesPanel() {
  const states = useChallengeStates();
  const now = useNow(60_000);

  // Record a finish once, and pay out its points.
  useEffect(() => {
    const finished = states.filter((s) => s.status === 'done' && s.entry && !s.entry.doneAt);
    if (!finished.length) return;
    const x = useExtras.getState();
    x.update({ challenges: x.challenges.map((j) => (finished.some((f) => f.entry === j) ? { ...j, doneAt: Date.now() } : j)) });
    const p = useProfile.getState();
    const pts = finished.reduce((n, f) => n + f.challenge.points, 0);
    p.update({ points: p.points + pts });
    toast(`${finished[0].challenge.title} complete. +${pts} points and a trophy`);
  }, [states]);


  const active = states.filter((s) => s.status === 'active');
  const rest = states.filter((s) => s.status !== 'active');
  return (
    <div className="grid gap-5">
      {active.length > 0 && (
        <section className="grid gap-2">
          {active.map((s) => (
            <div key={s.challenge.id} className="rounded-xl border border-accent/30 bg-surface p-4">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-fill text-white"><Icon name="target" className="size-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold">{s.challenge.title}</p>
                  <p className="text-[13px] text-muted">{s.challenge.detail}</p>
                </div>
                <span className="tnum shrink-0 text-[12px] text-muted">{left(s.endsAt - now)}</span>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <span className="block h-2.5 flex-1 overflow-hidden rounded-full bg-surface-3"><span className="block h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${(s.have / s.challenge.target) * 100}%` }} /></span>
                <span className="tnum w-28 text-right text-[13px] font-medium">{fmt(s, s.have)} / {fmt(s, s.challenge.target)}</span>
              </div>
              <button type="button" onClick={() => leave(s)} className="mt-2 text-[12px] text-muted hover:text-danger">Leave</button>
            </div>
          ))}
        </section>
      )}
      <ul className="grid gap-2 sm:grid-cols-2 [&>*]:min-w-0">
        {rest.map((s) => (
          <li key={s.challenge.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
            <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg', s.wins ? 'bg-[#e9b93a]/15 text-[#b8860b]' : 'bg-surface-3 text-muted')}><Icon name={s.wins ? 'trophy' : 'target'} className="size-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold">{s.challenge.title}{s.wins > 1 && <span className="ml-1 text-[12px] font-normal text-muted">×{s.wins}</span>}</p>
              <p className="truncate text-[12px] text-muted">{s.challenge.detail}</p>
            </div>
            <span className="tnum shrink-0 text-[12px] text-muted">+{s.challenge.points}</span>
            <Button size="sm" variant={s.status === 'missed' ? 'secondary' : 'primary'} onClick={() => join(s.challenge.id)}>{s.status === 'missed' ? 'Retry' : s.wins ? 'Again' : 'Join'}</Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
