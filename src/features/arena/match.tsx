'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import CountUp from '@/components/bits/CountUp';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { api } from '@/lib/api';
import { TIER_COLOR, tierOf, type ArenaQuestion, type ArenaResult, type ArenaRunView } from '@/lib/arena/types';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import { cn } from '@/lib/utils';

const MAX_SCORE = 1500;
const TOPIC_NAME: Record<string, string> = { math: 'Math', science: 'Science', general: 'General' };
const KEYS = ['1', '2', '3', '4'];

/** One lane of the race: a name, a bar, a score. */
function Lane({ name, sub, score, you, color }: { name: string; sub?: string; score: number; you?: boolean; color: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)_56px] items-center gap-3 max-sm:grid-cols-[minmax(0,90px)_minmax(0,1fr)_48px]">
      <span className="min-w-0">
        <strong className={cn('block truncate text-[13px]', you ? 'font-semibold' : 'font-medium')}>{name}</strong>
        {sub && <span className="block truncate text-[11px] text-muted">{sub}</span>}
      </span>
      <span className="h-2.5 overflow-hidden rounded-full bg-surface-3">
        <span className="block h-full rounded-full transition-[width] duration-500 ease-out" style={{ width: `${Math.min(100, (score / MAX_SCORE) * 100)}%`, background: color }} />
      </span>
      <span className="tnum text-right text-[14px] font-semibold">{score}</span>
    </div>
  );
}

/** A finished match: who won, the score, the rating change and points earned. */
function ResultView({ run, result, onExit, onAgain }: { run: ArenaRunView; result: ArenaResult; onExit: () => void; onAgain?: () => void }) {
  const o = run.opponent;
  const delta = result.ratingAfter - result.ratingBefore;
  const title = run.mode === 'daily'
    ? result.dailyRank ? `#${result.dailyRank} today` : 'Daily done'
    : result.outcome === 'win' ? 'You won' : result.outcome === 'loss' ? 'You lost' : result.outcome === 'tie' ? 'A tie' : result.outcome === 'pending' ? `Sent to ${o?.name.split(' ')[0] ?? 'them'}` : 'Match done';
  const sub = run.mode === 'daily'
    ? `${result.dailyPlayers ?? 1} ${result.dailyPlayers === 1 ? 'player' : 'players'} so far today${result.streak && result.streak > 1 ? `, ${result.streak} day streak` : ''}`
    : result.outcome === 'pending' ? 'They play the same ten questions. You will see who won here.' : o ? `${o.name}: ${result.opponentScore ?? 0}` : '';
  const before = tierOf(result.ratingBefore).name;
  const after = tierOf(result.ratingAfter).name;
  return (
    <div className="st-rise grid gap-5">
      <div className={cn('rounded-[10px] px-6 py-7 text-center text-white max-sm:px-4', result.outcome === 'loss' ? 'bg-[#3d3f46]' : 'bg-accent-fill')}>
        <p className="text-[13px] font-medium text-white/75">{run.mode === 'daily' ? 'Daily challenge' : o ? `vs ${o.name}` : 'Arena'}</p>
        <h2 className="mt-1 text-[34px] leading-10 font-bold tracking-tight max-sm:text-[28px]">{title}</h2>
        <p className="mt-1 text-[14px] text-white/80">{sub}</p>
        <p className="tnum mt-5 text-[56px] leading-none font-bold tracking-tight max-sm:text-[46px]"><CountUp to={result.score} duration={1.2} separator="," /></p>
        <p className="mt-2 text-[14px] text-white/80">{result.correct} of {result.total} right</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[10px] border border-line bg-surface p-4">
          <p className="text-[12px] font-semibold text-muted">Rating</p>
          <p className="tnum mt-1 text-[24px] leading-8 font-semibold"><CountUp from={result.ratingBefore} to={result.ratingAfter} duration={1.4} delay={0.4} /></p>
          <p className={cn('tnum text-[13px] font-semibold', delta > 0 ? 'text-ok' : delta < 0 ? 'text-danger' : 'text-muted')}>{delta > 0 ? `+${delta}` : delta < 0 ? delta : 'No change'}{before !== after && <span className="ml-1 font-medium" style={{ color: TIER_COLOR[after] }}>Now {after}</span>}</p>
        </div>
        <div className="rounded-[10px] border border-line bg-surface p-4">
          <p className="text-[12px] font-semibold text-muted">Points earned</p>
          <p className="tnum mt-1 text-[24px] leading-8 font-semibold">+<CountUp to={result.pointsEarned} duration={1.2} delay={0.6} /></p>
          <p className="text-[13px] text-muted">Added to your points</p>
        </div>
        <div className="rounded-[10px] border border-line bg-surface p-4">
          <p className="text-[12px] font-semibold text-muted">Question by question</p>
          <div className="mt-2 grid gap-1.5">
            <div className="flex gap-1">{run.answers.map((a, i) => <span key={i} className={cn('h-2 flex-1 rounded-full', a.ok ? 'bg-accent-fill' : 'bg-danger/70')} title={`Q${i + 1}: ${a.pts}`} />)}</div>
            {o?.timeline && <div className="flex gap-1">{o.timeline.map((a, i) => <span key={i} className={cn('h-2 flex-1 rounded-full', a.ok ? 'bg-ink/60' : 'bg-ink/15')} />)}</div>}
          </div>
          <p className="mt-2 text-[12px] text-muted">{o?.timeline ? `You on top, ${o.name.split(' ')[0]} below` : 'Green is right'}</p>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {onAgain && <Button size="lg" onClick={onAgain}>{run.mode === 'quick' ? 'Play another match' : run.mode === 'daily' ? 'Play a quick match' : 'Play again'}</Button>}
        <Button size="lg" variant="secondary" onClick={onExit}>Back to Arena</Button>
      </div>
    </div>
  );
}

/** A match in progress: question, timer, the race against the other player, and the result. */
export function Match({ initial, onExit, onAgain }: { initial: ArenaRunView; onExit: () => void; onAgain?: () => void }) {
  const [run, setRun] = useState(initial);
  const [shown, setShown] = useState<ArenaQuestion | null>(null);
  const [shownAt, setShownAt] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [reveal, setReveal] = useState<{ answer: number; ok: boolean; pts: number } | null>(null);
  const [finished, setFinished] = useState(Boolean(initial.result));
  const [now, setNow] = useState(() => Date.now());
  const [frozen, setFrozen] = useState(0);
  const [pops, setPops] = useState<{ id: number; pts: number }[]>([]);
  const pickedRef = useRef<number | null>(null);
  const credited = useRef(Boolean(initial.result));

  // Show each question when the server says it starts, after the last answer has been on screen.
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
      if (res.pts) setPops((p) => [...p, { id: Date.now(), pts: res.pts }]);
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

  // The clock, and a timeout answer when it runs out.
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
  const left = Math.max(0, total - elapsed);
  const idx = shown?.index ?? run.index;
  const tl = o?.timeline;
  // The other player's score at the same moment in their own run.
  const ghost = tl ? tl.slice(0, idx).reduce((n, a) => n + a.pts, 0) + (tl[idx] && (picked !== null || elapsed >= tl[idx].ms) ? tl[idx].pts : 0) : 0;

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => confirm('Leave this match? Unanswered questions count as wrong.') && onExit()} className="flex items-center gap-1 text-[13px] font-medium text-muted hover:text-ink"><Icon name="close" className="size-3.5" />Leave</button>
        <p className="mx-auto text-[13px] font-semibold">{run.mode === 'daily' ? 'Daily challenge' : o ? `vs ${o.name}` : 'Match'}{o && <span className="ml-1.5 font-medium" style={{ color: TIER_COLOR[o.tier] }}>{o.tier} {o.rating}</span>}</p>
        <span className="tnum text-[13px] font-semibold text-muted">{Math.min(idx + 1, run.total)}/{run.total}</span>
      </div>

      <div className="flex gap-1" aria-hidden>
        {Array.from({ length: run.total }, (_, i) => {
          const a = run.answers[i];
          return <span key={i} className={cn('h-1.5 flex-1 rounded-full transition-colors duration-300', a ? (a.ok ? 'bg-accent-fill' : 'bg-danger/70') : i === idx ? 'bg-ink' : 'bg-surface-3')} />;
        })}
      </div>

      <div className="grid gap-2 rounded-[10px] border border-line bg-surface p-4">
        <div className="relative">
          <Lane name="You" score={run.score} you color="var(--accent-fill)" />
          {pops.map((p) => <span key={p.id} onAnimationEnd={() => setPops((l) => l.filter((x) => x.id !== p.id))} className="st-score-pop tnum pointer-events-none absolute right-0 -top-3 text-[13px] font-bold text-accent-ink">+{p.pts}</span>)}
        </div>
        {o && (tl
          ? <Lane name={o.name} sub={o.kind === 'bot' ? 'Practice opponent' : o.kind === 'ghost' ? 'Their earlier run' : 'Played first'} score={ghost} color="var(--ink)" />
          : <p className="text-[12px] text-muted">{o.name} plays the same questions after you.</p>)}
      </div>

      {shown ? (
        <div key={shown.index} className="st-rise rounded-[10px] border border-line bg-surface p-5 max-sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12px] font-semibold text-muted">{TOPIC_NAME[shown.topic] ?? 'Question'}</span>
            <span className={cn('tnum text-[14px] font-bold', picked === null ? (left < 5000 ? 'text-danger' : 'text-ink') : reveal?.ok ? 'text-accent-ink' : 'text-danger')}>{picked === null ? `${Math.ceil(left / 1000)}s` : reveal ? (reveal.ok ? `+${reveal.pts}` : 'Missed') : 'Checking'}</span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-3">
            <div className={cn('h-full rounded-full', left < 5000 ? 'bg-danger' : 'bg-ink')} style={{ width: `${((picked === null ? left : frozen) / total) * 100}%`, transition: 'width 100ms linear' }} />
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
                    'flex min-h-14 items-center gap-3 rounded-[8px] border px-4 py-3 text-left text-[15px] font-medium transition-[background-color,border-color,transform,color] duration-200 active:scale-[0.98]',
                    right ? 'border-accent-fill bg-accent-fill text-white' : wrong ? 'border-danger bg-danger text-white' : picked === i ? 'border-ink bg-surface-3' : picked !== null ? 'border-line text-muted' : 'border-line hover:border-ink hover:bg-surface-2',
                  )}
                >
                  <span className={cn('tnum grid size-6 shrink-0 place-items-center rounded text-[12px] font-bold', right || wrong ? 'bg-white/20' : 'bg-surface-3 text-ink-2')}>{i + 1}</span>
                  <span className="min-w-0 flex-1">{c}</span>
                  {right && <Icon name="check" className="size-4" />}
                </button>
              );
            })}
          </div>
          {picked === -1 && reveal && <p className="mt-3 text-[13px] font-medium text-danger">Time ran out.</p>}
        </div>
      ) : (
        <div className="grid place-items-center rounded-[10px] border border-line bg-surface py-16 text-center">
          <p className="text-[13px] font-semibold text-muted">{run.result ? 'Adding up your score' : 'Get ready'}</p>
          <p className="mt-1 text-[22px] font-semibold">{run.result ? '' : 'Ten questions, fifteen seconds each'}</p>
          <p className="mt-1 text-[13px] text-muted">Use 1 to 4 on your keyboard to answer fast.</p>
        </div>
      )}
    </div>
  );
}
