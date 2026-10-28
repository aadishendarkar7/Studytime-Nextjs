'use client';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { toneFor } from '@/features/chat/live';
import { useExtras } from '@/lib/stores/extras';
import { useProfile } from '@/lib/stores/profile';
import { useNow } from '@/lib/use-now';
import { cn } from '@/lib/utils';
import { BUDDY_BONUS, leaveBuddy, optInNow, useBuddy } from './buddy';

const clock = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** A countdown ring: how much of the session is left. */
function Ring({ start, end, now, label, sub, status, color }: { start: number; end: number; now: number; label: string; sub: string; status: string; color: string }) {
  const total = Math.max(1, end - start);
  const left = Math.max(0, end - now);
  const frac = status === 'focusing' ? left / total : 0;
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center text-center">
      <div className="relative size-[88px]">
        <svg viewBox="0 0 80 80" className="size-full -rotate-90" aria-hidden="true">
          <circle cx="40" cy="40" r={r} fill="none" stroke="var(--line)" strokeWidth="5" />
          <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} style={{ transition: 'stroke-dashoffset 1s linear' }} />
        </svg>
        <span className="tnum absolute inset-0 grid place-items-center text-[15px] font-semibold">{status === 'focusing' ? clock(left) : status === 'done' ? 'Done' : 'Left'}</span>
      </div>
      <p className="mt-2 max-w-full truncate text-[14px] font-semibold">{label}</p>
      <p className="max-w-full truncate text-[12px] text-muted">{sub || 'Focusing'}</p>
    </div>
  );
}

export function BuddyPanel({ className }: { className?: string }) {
  const x = useExtras();
  const p = useProfile();
  const { me, buddy, sameCourse, error } = useBuddy();
  const now = useNow(1000);
  const active = Boolean(x.buddy);
  return (
    <section className={cn('rounded-xl border border-line bg-surface p-5 max-sm:p-4', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-sans text-[15px] leading-6 font-semibold">Focus Buddy</h2>
          <p className="max-w-[52ch] text-[13px] leading-5 text-muted">Get paired with someone focusing right now, ideally in your course. No camera and no chat: just their name, task and timer next to yours. Both finish and you each get +{BUDDY_BONUS} points.</p>
        </div>
        {!active && (
          <label className="flex shrink-0 items-center gap-2 text-[13px] font-medium">
            <input type="checkbox" className="size-4 accent-[var(--ink)]" checked={x.buddyOptIn} onChange={(e) => (e.target.checked ? optInNow() : x.update({ buddyOptIn: false }))} />
            Match me
          </label>
        )}
      </div>

      {active && me ? (
        <>
          <div className="mt-4 flex items-start gap-4 rounded-xl bg-surface-2 px-4 py-4">
            <Ring start={me.startedAt} end={me.endsAt} now={now} label="You" sub={me.task || p.subject} status={x.buddy?.done ? 'done' : me.status} color="var(--ink)" />
            {buddy ? (
              <Ring start={buddy.startedAt} end={buddy.endsAt} now={now} label={buddy.name} sub={buddy.task} status={buddy.status} color={toneFor(buddy.id)} />
            ) : (
              <div className="flex min-w-0 flex-1 flex-col items-center text-center">
                <div className="relative grid size-[88px] place-items-center">
                  <span className="buddy-search absolute inset-0 rounded-full border-[5px] border-dashed border-line" aria-hidden="true" />
                  <Avatar name="?" size={36} />
                </div>
                <p className="mt-2 text-[14px] font-semibold">Looking</p>
                <p className="text-[12px] text-muted">{p.subject ? `Checking ${p.subject} first` : 'Anyone focusing now'}</p>
              </div>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[13px] text-muted">
            <span>{buddy ? (sameCourse ? 'Same course.' : 'Different course, same goal.') : 'You will be matched as soon as someone starts.'} {x.buddy?.done && buddy?.status === 'focusing' ? `Waiting for ${buddy.name} to finish for the bonus.` : ''}</span>
            {!x.buddy?.done && <Button size="sm" variant="ghost" onClick={leaveBuddy}>Stop matching</Button>}
          </div>
        </>
      ) : x.buddyOptIn ? (
        <p className="mt-4 rounded-lg bg-surface-2 px-3 py-2.5 text-[13px] text-ink-2">Start your session and Studytime finds you a buddy.</p>
      ) : null}
      {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}
    </section>
  );
}
