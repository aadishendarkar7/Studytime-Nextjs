'use client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { useExtras, type StudyBlock } from '@/lib/stores/extras';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import { useNow } from '@/lib/use-now';
import { cn } from '@/lib/utils';
import type { Duration } from '@/features/focus/logic';

export const timeRange = (b: { start: number; end: number }) => {
  const day = new Date(b.start).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const t = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${day}, ${t(b.start)} to ${t(b.end)}`;
};

/** Closest timer length that fits inside the block. */
const lengthFor = (minutes: number): Duration => Math.max(5, Math.min(240, Math.round(minutes)));

export function useStartBlock() {
  const router = useRouter();
  const p = useProfile();
  return (b: StudyBlock) => {
    if (b.href) return router.push(b.href);
    if (p.timer.mode !== 'ready') return toast('Finish or reset the current session first.', 'error');
    p.update({ subject: b.subject.slice(0, 60) });
    p.setDuration(lengthFor((b.end - b.start) / 60_000));
    router.push('/focus');
  };
}

export function BlockRow({ b, compact }: { b: StudyBlock; compact?: boolean }) {
  const { studyBlocks, update } = useExtras();
  const start = useStartBlock();
  const set = (patch: Partial<StudyBlock>) => update({ studyBlocks: studyBlocks.map((x) => (x.id === b.id ? { ...x, ...patch } : x)) });
  const now = useNow(30_000);
  const live = now >= b.start && now <= b.end;
  return (
    <div className={cn('flex flex-wrap items-center gap-3 border-b border-line py-3 last:border-0', b.done && 'opacity-60')}>
      <span className={cn('h-10 w-1 shrink-0 rounded-full', b.source === 'review' || b.source === 'routine' ? 'bg-glow' : b.source === 'exam' ? 'bg-warn' : 'bg-accent')} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-[15px] font-semibold', b.done && 'line-through')}>{b.title}</p>
        <p className="tnum text-[13px] text-muted">{live ? 'Now, until ' + new Date(b.end).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : timeRange(b)}</p>
      </div>
      {!b.done && <Button size="sm" variant={live ? 'primary' : 'secondary'} onClick={() => start(b)}>{b.href ? 'Review' : 'Start'}</Button>}
      {!compact && (
        <>
          <Button size="sm" variant="ghost" onClick={() => set({ done: !b.done })}>{b.done ? 'Undo' : 'Done'}</Button>
          <button type="button" aria-label={`Remove ${b.title}`} onClick={() => update({ studyBlocks: studyBlocks.filter((x) => x.id !== b.id) })} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-3 hover:text-danger max-sm:size-11">
            <Icon name="trash" className="size-4" />
          </button>
        </>
      )}
    </div>
  );
}
