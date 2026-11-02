'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { api } from '@/lib/api';
import { TIER_COLOR, tierOf, type ArenaQuestion, type ArenaResult, type ArenaRunView } from '@/lib/arena/types';
import { askConfirm } from '@/lib/stores/ask';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import { cn } from '@/lib/utils';

const MAX_SCORE = 1500;
const TOPIC_NAME: Record<string, string> = { math: 'Math', science: 'Science', general: 'General' };
const KEYS = ['1', '2', '3', '4'];

/** One player's progress: name, a bar, the score. */
function Lane({ name, sub, score, you }: { name: string; sub?: string; score: number; you?: boolean }) {
  return (
    <div className="grid grid-cols-[minmax(0,120px)_minmax(0,1fr)_48px] items-center gap-3 max-sm:grid-cols-[minmax(0,80px)_minmax(0,1fr)_44px]">
      <span className="min-w-0">
        <strong className={cn('block truncate text-[13px]', you ? 'font-semibold' : 'font-medium text-ink-2')}>{name}</strong>
        {sub && <span className="block truncate text-[11px] text-muted">{sub}</span>}
      </span>
      <span className="h-2 overflow-hidden rounded-full bg-surface-3">
        <span className={cn('block h-full rounded-full transition-[width] duration-500 ease-out', you ? 'bg-accent-fill' : 'bg-ink/40')} style={{ width: `${Math.min(100, (score / MAX_SCORE) * 100)}%` }} />
      </span>
      <span className="tnum text-right text-[14px] font-semibold">{score}</span>
    </div>
  );
}

function ResultView({ run, result, onExit, onAgain }: { run: ArenaRunView; result: ArenaResult; onExit: () => void; onAgain?: () => void }) {
  const o = run.opponent;
  const delta = result.ratingAfter - result.ratingBefore;
  const title = run.mode === 'daily'
    ? result.dailyRank ? `#${result.dailyRank} today` : 'Daily done'
    : result.outcome === 'win' ? 'You won' : result.outcome === 'loss' ? 'You lost' : result.outcome === 'tie' ? 'It’s a tie' : result.outcome === 'pending' ? 'Challenge sent' : 'Match done';
  const sub = run.mode === 'daily'
    ? `${result.dailyPlayers ?? 1} ${result.dailyPlayers === 1 ? 'player' : 'players'} so far today${result.streak && result.streak > 1 ? `, ${result.streak} day streak` : ''}`
    : result.outcome === 'pending' ? `${o?.name.split(' ')[0] ?? 'They'} gets the same ten questions. You will see who won on the Arena page.` : o ? `${o.name} scored ${result.opponentScore ?? 0}` : '';
  const after = tierOf(result.ratingAfter).name;
  const promoted = tierOf(result.ratingBefore).name !== after && delta > 0;
  const win = result.outcome === 'win';
  return (
    <div className="st-rise grid gap-4">
      <section className={cn('rounded-[10px] px-6 py-7 text-center max-sm:px-4', win ? 'bg-accent-fill text-white' : 'border border-line bg-surface')}>
        <p className={cn('text-[13px] font-medium', win ? 'text-white/75' : 'text-muted')}>{run.mode === 'daily' ? 'Daily challenge' : o ? `vs ${o.name}` : 'Arena'}</p>
        <h2 className="mt-1 text-[30px] leading-9 font-semibold tracking-tight">{title}</h2>
        <p className={cn('mt-1 text-[14px]', win ? 'text-white/80' : 'text-ink-2')}>{sub}</p>
        <p className="tnum mt-5 text-[52px] leading-none font-semibold tracking-tight">{result.score.toLocaleString()}</p>
        <p className={cn('mt-2 text-[14px]', win ? 'text-white/80' : 'text-muted')}>{result.correct} of {result.total} right</p>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[10px] border border-line bg-surface p-4">
          <p className="text-[12px] font-medium text-muted">Rating</p>
          <p className="tnum mt-1 text-[24px] leading-8 font-semibold">{result.ratingAfter}</p>
          <p className={cn('tnum text-[13px] font-medium', delta > 0 ? 'text-ok' : delta < 0 ? 'text-danger' : 'text-muted')}>
            {delta > 0 ? `+${delta}` : delta < 0 ? delta : 'No change'}{promoted && <span className="ml-1.5" style={{ color: TIER_COLOR[after] }}>Now {after}</span>}
          </p>
        </div>
        <div className="rounded-[10px] border border-line bg-surface p-4">
          <p className="text-[12px] font-medium text-muted">Points earned</p>
          <p className="tnum mt-1 text-[24px] leading-8 font-semibold">+{result.pointsEarned}</p>
          <p className="text-[13px] text-muted">Added to your points</p>
        </div>
        <div className="rounded-[10px] border border-line bg-surface p-4">
          <p className="text-[12px] font-medium text-muted">Question by question</p>
          <div className="mt-2.5 grid gap-1.5">
            <div className="flex gap-1">{run.answers.map((a, i) => <span key={i} title={`Question ${i + 1}: ${a.pts}`} className={cn('h-2 flex-1 rounded-full', a.ok ? 'bg-accent-fill' : 'bg-danger/60')} />)}</div>
            {o?.timeline && <div className="flex gap-1">{o.timeline.map((a, i) => <span key={i} className={cn('h-2 flex-1 rounded-full', a.ok ? 'bg-ink/45' : 'bg-ink/10')} />)}</div>}
          </div>
          <p className="mt-2 text-[12px] text-muted">{o?.timeline ? `You on top, ${o.name.split(' ')[0]} below` : 'Green is right'}</p>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {onAgain && <Button size="lg" onClick={onAgain}>{run.mode === 'quick' ? 'Play another' : run.mode === 'daily' ? 'Play a quick match' : 'Play again'}</Button>}
        <Button size="lg" variant="secondary" onClick={onExit}>Back to Arena</Button>
      </div>
    </div>
  );
}

/** A match in progress: a short countdown, the question, the timer, both scores, then the result. */
export function Match({ initial, onExit, onAgain }: { initial: ArenaRunView; onExit: () => void; onAgain?: () => void }) {
  const [run, setRun] = useState(initial);
  const [shown, setShown] = useState<ArenaQuestion | null>(null);
  const [shownAt, setShownAt] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [frozen, setFrozen] = useState(0);
  const [reveal, setReveal] = useState<{ answer: number; ok: boolean; pts: number } | null>(null);
  const [finished, setFinished] = useState(Boolean(initial.result));
  const [now, setNow] = useState(() => Date.now());
  const [count, setCount] = useState<number | null>(() => (initial.index === 0 && initial.question && initial.question.startsIn > 1500 ? 3 : null));
  const pickedRef = useRef<number | null>(null);
  const credited = useRef(Boolean(initial.result));

  useEffect(() => {
    if (count === null) return;
    const t = setTimeout(() => setCount(count > 1 ? count - 1 : null), 900);
    return () => clearTimeout(t);
  }, [count]);

  // Show each question when the server says it starts.
  useEffect(() => {
    const q = run.question;
    if (!q || q.index === shown?.index) return;
    const t = setTimeout(() => {
      pickedRef.current = null;
      setShown(q);
      setShownAt(Date.now());
      setPicked(null);
      setReveal(null);
    }, q.startsIn);
    return () => clearTimeout(t);
  }, [run.question, shown?.index]);

  const submit = useCallback(async (choice: number) => {
    if (pickedRef.current !== null || !shown) return;
    pickedRef.current = choice;
    setFrozen(Math.max(0, shown.seconds * 1000 - (Date.now() - shownAt)));
    setPicked(choice);
    try {
      const res = await api.arena.answer(run.id, choice);
      setReveal({ answer: res.answer, ok: res.ok, pts: res.pts });
      setRun(res.run);
      if (res.run.result) {
        if (!credited.current) {
          credited.current = true;
          const p = useProfile.getState();
          p.update({ points: p.points + res.run.result.pointsEarned });
        }
        setTimeout(() => setFinished(true), 1200);
      }
    } catch (e) {
      toast((e as Error).message, 'error');
      pickedRef.current = null;
      setPicked(null);
    }
  }, [run.id, shown, shownAt]);

  useEffect(() => {
    if (!shown || finished) return;
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (pickedRef.current === null && n - shownAt > shown.seconds * 1000) void submit(-1);
    }, 100);
    return () => clearInterval(t);
  }, [shown, shownAt, finished, submit]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const i = KEYS.indexOf(e.key);
      if (i >= 0 && shown && pickedRef.current === null) void submit(i);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shown, submit]);

  if (finished && run.result) return <ResultView run={run} result={run.result} onExit={onExit} onAgain={onAgain} />;

  const o = run.opponent;
  const elapsed = shown ? Math.max(0, now - shownAt) : 0;
  const total = (shown?.seconds ?? 15) * 1000;
  const left = picked === null ? Math.max(0, total - elapsed) : frozen;
  const low = left < 5000 && picked === null;
  const idx = shown?.index ?? run.index;
  const tl = o?.timeline;
  const ghost = tl ? tl.slice(0, idx).reduce((n, a) => n + a.pts, 0) + (tl[idx] && (picked !== null || elapsed >= tl[idx].ms) ? tl[idx].pts : 0) : 0;
  const leave = async () => (await askConfirm('Leave this match? Questions you have not answered count as wrong.', { ok: 'Leave match', danger: true })) && onExit();

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => void leave()} className="flex items-center gap-1 text-[13px] font-medium text-muted hover:text-ink"><Icon name="close" className="size-3.5" />Leave</button>
        <p className="mx-auto truncate text-[14px] font-semibold">
          {run.mode === 'daily' ? 'Daily challenge' : o ? `vs ${o.name}` : 'Match'}
          {o && <span className="ml-1.5 font-medium" style={{ color: TIER_COLOR[o.tier] }}>{o.tier}</span>}
        </p>
        <span className="tnum text-[13px] font-semibold text-muted">{Math.min(idx + 1, run.total)} of {run.total}</span>
      </div>

      <div className="flex gap-1" aria-hidden>
        {Array.from({ length: run.total }, (_, i) => {
          const a = run.answers[i];
          return <span key={i} className={cn('h-1.5 flex-1 rounded-full transition-colors duration-300', a ? (a.ok ? 'bg-accent-fill' : 'bg-danger/60') : i === idx ? 'bg-ink' : 'bg-surface-3')} />;
        })}
      </div>

      <div className="grid gap-2 rounded-[10px] border border-line bg-surface p-4">
        <Lane name="You" score={run.score} you />
        {o && (tl
          ? <Lane name={o.name} sub={o.kind === 'bot' ? 'Practice opponent' : o.kind === 'ghost' ? 'Their earlier run' : 'Played first'} score={ghost} />
          : <p className="text-[12px] text-muted">{o.name} plays the same questions after you.</p>)}
      </div>

      {count !== null ? (
        <div className="grid min-h-[320px] place-items-center rounded-[10px] border border-line bg-surface text-center">
          <div>
            <p className="text-[13px] font-medium text-muted">Starting in</p>
            <p key={count} className="st-rise tnum mt-1 text-[72px] leading-none font-semibold">{count}</p>
            <p className="mt-3 text-[13px] text-muted">Press 1 to 4 to answer.</p>
          </div>
        </div>
      ) : shown ? (
        <div key={shown.index} className="st-rise rounded-[10px] border border-line bg-surface p-5 max-sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12px] font-medium text-muted">{TOPIC_NAME[shown.topic] ?? 'Question'}</span>
            <span className={cn('tnum text-[14px] font-semibold', picked === null ? (low ? 'text-danger' : 'text-ink') : reveal?.ok ? 'text-ok' : 'text-danger')}>
              {picked === null ? `${Math.ceil(left / 1000)}s` : reveal ? (reveal.ok ? `+${reveal.pts}` : picked === -1 ? 'Out of time' : 'Not quite') : ''}
            </span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-3">
            <div className={cn('h-full rounded-full', low ? 'bg-danger' : 'bg-ink')} style={{ width: `${(left / total) * 100}%`, transition: 'width 100ms linear' }} />
          </div>
          <h2 className="mt-5 text-[22px] leading-8 font-semibold tracking-tight max-sm:text-[19px] max-sm:leading-7">{shown.prompt}</h2>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {shown.choices.map((c, i) => {
              const right = reveal && i === reveal.answer;
              const wrong = reveal && i === picked && !reveal.ok;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={picked !== null}
                  onClick={() => void submit(i)}
                  className={cn(
                    'flex min-h-14 items-center gap-3 rounded-[8px] border px-4 py-3 text-left text-[15px] font-medium transition-colors duration-150',
                    right ? 'border-accent-fill bg-accent-fill text-white' : wrong ? 'border-danger bg-danger text-white' : picked === i ? 'border-ink bg-surface-3' : picked !== null ? 'border-line text-muted' : 'border-line hover:border-ink hover:bg-surface-2',
                  )}
                >
                  <span className={cn('tnum grid size-6 shrink-0 place-items-center rounded text-[12px] font-semibold', right || wrong ? 'bg-white/20' : 'bg-surface-3 text-ink-2')}>{i + 1}</span>
                  <span className="min-w-0 flex-1">{c}</span>
                  {right && <Icon name="check" className="size-4" />}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid min-h-[320px] place-items-center rounded-[10px] border border-line bg-surface">
          <p className="text-[14px] text-muted">{run.result ? 'Adding up your score' : 'Next question'}</p>
        </div>
      )}
    </div>
  );
}
