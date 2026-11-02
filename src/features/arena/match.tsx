'use client';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import CountUp from '@/components/bits/CountUp';
import { Icon } from '@/components/ui/icons';
import { api } from '@/lib/api';
import { TIER_COLOR, tierOf, type ArenaQuestion, type ArenaResult, type ArenaRunView } from '@/lib/arena/types';
import { askConfirm } from '@/lib/stores/ask';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import { cn } from '@/lib/utils';
import { Burst, C, CHOICE_COLORS, display, Emblem, Initial, SkewButton, Stage } from './arena-ui';

const MAX_SCORE = 1500;
const TOPIC_NAME: Record<string, string> = { math: 'Math', science: 'Science', general: 'General' };
const KEYS = ['1', '2', '3', '4'];

/** The race: a track per player, a marker that runs as the score grows. */
function Track({ name, score, color, sub }: { name: string; score: number; color: string; sub?: string }) {
  const pct = Math.min(100, (score / MAX_SCORE) * 100);
  return (
    <div className="grid grid-cols-[minmax(0,110px)_minmax(0,1fr)_52px] items-center gap-3 max-sm:grid-cols-[minmax(0,70px)_minmax(0,1fr)_44px]">
      <span className="min-w-0">
        <strong className={cn('block truncate text-[13px]', display)} style={{ color }}>{name}</strong>
        {sub && <span className="block truncate text-[11px]" style={{ color: C.muted }}>{sub}</span>}
      </span>
      <span className="relative h-8">
        <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2" style={{ backgroundImage: `repeating-linear-gradient(90deg, ${C.line} 0 10px, transparent 10px 18px)` }} />
        <span className="absolute top-1/2 left-0 h-1 -translate-y-1/2 rounded-full transition-[width] duration-700 ease-out" style={{ width: `${pct}%`, background: color, boxShadow: `0 0 12px ${color}` }} />
        <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-[left] duration-700 ease-out" style={{ left: `${pct}%` }}>
          <Initial name={name} color={color} size={26} className="ring-4 ring-[#0d1015]" />
        </span>
      </span>
      <span className="tnum text-right text-[17px] font-black">{score}</span>
    </div>
  );
}

/** The timer as a ring that drains and turns from lime to amber to coral. */
function Clock({ left, total, frozen }: { left: number; total: number; frozen?: string }) {
  const r = 22;
  const len = 2 * Math.PI * r;
  const f = left / total;
  const color = f > 0.5 ? C.lime : f > 0.25 ? C.amber : C.coral;
  return (
    <div className="relative grid size-14 shrink-0 place-items-center">
      <svg viewBox="0 0 52 52" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="26" cy="26" r={r} fill="none" stroke={C.line} strokeWidth="4" />
        <circle cx="26" cy="26" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - f)} style={{ transition: 'stroke-dashoffset 100ms linear, stroke 300ms' }} />
      </svg>
      <span className={cn('tnum text-[16px] font-black', f <= 0.25 && !frozen && 'st-live')} style={{ color }}>{frozen ?? Math.ceil(left / 1000)}</span>
    </div>
  );
}

function ResultView({ run, result, onExit, onAgain }: { run: ArenaRunView; result: ArenaResult; onExit: () => void; onAgain?: () => void }) {
  const o = run.opponent;
  const delta = result.ratingAfter - result.ratingBefore;
  const win = result.outcome === 'win' || (run.mode === 'daily' && result.dailyRank === 1);
  const tone = result.outcome === 'loss' ? C.coral : result.outcome === 'pending' ? C.sky : run.mode === 'daily' ? C.amber : C.lime;
  const title = run.mode === 'daily'
    ? result.dailyRank ? `#${result.dailyRank} today` : 'Daily done'
    : result.outcome === 'win' ? 'Victory' : result.outcome === 'loss' ? 'Defeat' : result.outcome === 'tie' ? 'Dead heat' : result.outcome === 'pending' ? 'Challenge sent' : 'Match done';
  const sub = run.mode === 'daily'
    ? `${result.dailyPlayers ?? 1} ${result.dailyPlayers === 1 ? 'player' : 'players'} so far today${result.streak && result.streak > 1 ? `. ${result.streak} day streak` : ''}`
    : result.outcome === 'pending' ? `${o?.name.split(' ')[0] ?? 'They'} gets the same ten questions. The winner shows up in your Arena.` : o ? `${o.name} scored ${result.opponentScore ?? 0}` : '';
  const after = tierOf(result.ratingAfter).name;
  const promoted = tierOf(result.ratingBefore).name !== after && delta > 0;
  return (
    <div className="grid gap-4">
      <Stage className="px-6 pt-8 pb-7 text-center max-sm:px-4">
        {win && <Burst />}
        <p className="text-[12px] font-bold tracking-[0.18em] uppercase" style={{ color: C.muted }}>{run.mode === 'daily' ? 'Daily challenge' : o ? `vs ${o.name}` : 'Arena'}</p>
        <h2 className={cn('st-slam mt-2 text-[56px] leading-[0.95] max-sm:text-[42px]', display)} style={{ color: tone }}>{title}</h2>
        <p className="mt-3 text-[14px] text-white/75">{sub}</p>
        <p className="tnum mt-6 text-[76px] leading-none font-black tracking-tight max-sm:text-[60px]"><CountUp to={result.score} duration={1.3} separator="," /></p>
        <p className="mt-1 text-[13px] font-semibold tracking-[0.14em] uppercase" style={{ color: C.muted }}>{result.correct} of {result.total} right</p>
        <div className="mx-auto mt-5 flex max-w-[360px] gap-1">
          {run.answers.map((a, i) => <span key={i} className="st-seg h-2 flex-1 -skew-x-12 rounded-[2px]" style={{ background: a.ok ? C.lime : C.coral, '--i': i } as CSSProperties} />)}
        </div>
        {o?.timeline && (
          <div className="mx-auto mt-1.5 flex max-w-[360px] gap-1">
            {o.timeline.map((a, i) => <span key={i} className="st-seg h-2 flex-1 -skew-x-12 rounded-[2px]" style={{ background: a.ok ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.12)', '--i': i + 10 } as CSSProperties} />)}
          </div>
        )}
      </Stage>

      <div className="grid gap-3 sm:grid-cols-[auto_1fr_1fr]">
        <Stage className="flex items-center justify-center px-6 py-4"><Emblem tier={after} rating={result.ratingAfter} size={84} /></Stage>
        <Stage className="p-5">
          <p className="text-[11px] font-bold tracking-[0.16em] uppercase" style={{ color: C.muted }}>Rating</p>
          <p className="tnum mt-1 text-[34px] leading-10 font-black"><CountUp from={result.ratingBefore} to={result.ratingAfter} duration={1.4} delay={0.4} /></p>
          <p className="tnum text-[14px] font-bold" style={{ color: delta > 0 ? C.lime : delta < 0 ? C.coral : C.muted }}>{delta > 0 ? `+${delta}` : delta < 0 ? delta : 'No change'}{promoted && <span className="ml-2" style={{ color: TIER_COLOR[after] }}>Promoted to {after}</span>}</p>
        </Stage>
        <Stage className="p-5">
          <p className="text-[11px] font-bold tracking-[0.16em] uppercase" style={{ color: C.muted }}>Points earned</p>
          <p className="tnum mt-1 text-[34px] leading-10 font-black" style={{ color: C.amber }}>+<CountUp to={result.pointsEarned} duration={1.2} delay={0.6} /></p>
          <p className="text-[13px]" style={{ color: C.muted }}>Added to your Studytime points</p>
        </Stage>
      </div>

      <div className="flex flex-wrap justify-center gap-3 pt-1">
        {onAgain && <SkewButton onClick={onAgain}><Icon name="play" className="size-4" />{run.mode === 'quick' ? 'Next match' : run.mode === 'daily' ? 'Quick match' : 'Play again'}</SkewButton>}
        <button type="button" onClick={onExit} className={cn('h-12 px-5 text-[14px] text-ink-2 hover:text-ink', display)}>Back to Arena</button>
      </div>
    </div>
  );
}

/** A match in progress: countdown, question, timer, the race, and the result. */
export function Match({ initial, onExit, onAgain }: { initial: ArenaRunView; onExit: () => void; onAgain?: () => void }) {
  const [run, setRun] = useState(initial);
  const [shown, setShown] = useState<ArenaQuestion | null>(null);
  const [shownAt, setShownAt] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [reveal, setReveal] = useState<{ answer: number; ok: boolean; pts: number } | null>(null);
  const [finished, setFinished] = useState(Boolean(initial.result));
  const [now, setNow] = useState(() => Date.now());
  const [pops, setPops] = useState<{ id: number; pts: number }[]>([]);
  const [count, setCount] = useState<number | null>(() => (initial.index === 0 && initial.question && initial.question.startsIn > 1500 ? 3 : null));
  const pickedRef = useRef<number | null>(null);
  const credited = useRef(Boolean(initial.result));

  // 3, 2, 1, GO before the first question.
  useEffect(() => {
    if (count === null) return;
    const t = setTimeout(() => setCount(count > 0 ? count - 1 : null), count > 0 ? 800 : 500);
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
  }, [run.id, shown]);

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
  const ghost = tl ? tl.slice(0, idx).reduce((n, a) => n + a.pts, 0) + (tl[idx] && (picked !== null || elapsed >= tl[idx].ms) ? tl[idx].pts : 0) : 0;
  let streak = 0;
  for (let i = run.answers.length - 1; i >= 0 && run.answers[i].ok; i--) streak++;
  const leave = async () => (await askConfirm('Leave this match? Questions you have not answered count as wrong.', { ok: 'Leave match', danger: true })) && onExit();

  return (
    <Stage className="p-5 max-sm:p-3.5">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => void leave()} className="flex items-center gap-1 text-[12px] font-bold tracking-[0.12em] uppercase hover:text-white" style={{ color: C.muted }}><Icon name="close" className="size-3.5" />Leave</button>
        <p className={cn('mx-auto truncate text-[14px]', display)}>{run.mode === 'daily' ? <span style={{ color: C.amber }}>Daily challenge</span> : o ? <>vs <span style={{ color: C.coral }}>{o.name}</span></> : 'Match'}</p>
        <span className={cn('tnum text-[15px]', display)}>{Math.min(idx + 1, run.total)}<span style={{ color: C.muted }}>/{run.total}</span></span>
      </div>

      <div className="mt-3 flex gap-1" aria-hidden>
        {Array.from({ length: run.total }, (_, i) => {
          const a = run.answers[i];
          return <span key={i} className="h-1.5 flex-1 -skew-x-12 rounded-[2px] transition-colors duration-300" style={{ background: a ? (a.ok ? C.lime : C.coral) : i === idx ? '#fff' : C.line }} />;
        })}
      </div>

      <div className="relative mt-4 grid gap-1 rounded-[10px] px-3 py-2" style={{ background: C.panel }}>
        <Track name="You" score={run.score} color={C.lime} />
        {pops.map((p) => <span key={p.id} onAnimationEnd={() => setPops((l) => l.filter((x) => x.id !== p.id))} className={cn('st-score-pop tnum pointer-events-none absolute top-0 right-3 text-[18px]', display)} style={{ color: C.lime }}>+{p.pts}</span>)}
        {o && (tl
          ? <Track name={o.name.split(' ')[0]} sub={o.kind === 'bot' ? 'Practice bot' : o.kind === 'ghost' ? 'Earlier run' : 'Played first'} score={ghost} color={C.coral} />
          : <p className="py-1.5 text-[12px]" style={{ color: C.muted }}>{o.name} plays the same ten after you.</p>)}
      </div>

      {count !== null ? (
        <div className="grid min-h-[340px] place-items-center text-center">
          <div>
            <p className="text-[12px] font-bold tracking-[0.2em] uppercase" style={{ color: C.muted }}>{run.mode === 'daily' ? 'Same set for everyone today' : o ? `Racing ${o.name.split(' ')[0]}` : 'Get ready'}</p>
            <p key={count} className={cn('st-slam mt-2 text-[120px] leading-none max-sm:text-[96px]', display)} style={{ color: count === 0 ? C.lime : '#fff' }}>{count === 0 ? 'Go' : count}</p>
            <p className="mt-3 text-[13px]" style={{ color: C.muted }}>Keys 1 to 4 answer fastest.</p>
          </div>
        </div>
      ) : shown ? (
        <div key={shown.index} className="st-rise mt-5">
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold tracking-[0.16em] uppercase" style={{ color: C.muted }}>{TOPIC_NAME[shown.topic] ?? 'Question'}</span>
                {streak >= 2 && <span key={streak} className={cn('st-streak inline-flex items-center gap-1 rounded-[4px] px-2 py-0.5 text-[11px] text-[#0d1015]', display)} style={{ background: C.amber }}><Icon name="flame" className="size-3" />{streak} in a row</span>}
              </div>
              <h2 className="mt-2 text-[26px] leading-[1.25] font-bold tracking-tight max-sm:text-[21px]">{shown.prompt}</h2>
            </div>
            <Clock left={left} total={total} frozen={picked === null ? undefined : reveal ? (reveal.ok ? '✓' : '×') : '…'} />
          </div>
          <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
            {shown.choices.map((c, i) => {
              const color = CHOICE_COLORS[i];
              const right = reveal && i === reveal.answer;
              const wrong = reveal && i === picked && !reveal.ok;
              const dim = reveal && !right && !wrong;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={picked !== null}
                  onClick={() => void submit(i)}
                  className={cn(
                    'group relative flex min-h-[64px] items-center gap-3 overflow-hidden rounded-[10px] border-2 px-4 py-3 text-left text-[16px] font-semibold transition-[transform,opacity,background-color,border-color] duration-200 enabled:hover:-translate-y-0.5 active:scale-[0.98]',
                    right && 'st-right',
                    wrong && 'st-wrong',
                    dim && 'opacity-35',
                  )}
                  style={{ borderColor: right ? C.lime : wrong ? C.coral : picked === i ? '#fff' : `${color}55`, background: right ? C.lime : wrong ? C.coral : C.panel, color: right || wrong ? '#0d1015' : '#fff' }}
                >
                  <span className="absolute inset-y-0 left-0 w-1.5 transition-[width] duration-200 group-enabled:group-hover:w-2.5" style={{ background: right || wrong ? 'transparent' : color }} />
                  <span className={cn('tnum ml-1 grid size-7 shrink-0 -skew-x-12 place-items-center rounded-[4px] text-[13px] text-[#0d1015]', display)} style={{ background: right || wrong ? 'rgba(13,16,21,0.18)' : color }}>{i + 1}</span>
                  <span className="min-w-0 flex-1">{c}</span>
                  {right && <Icon name="check" className="size-5" />}
                </button>
              );
            })}
          </div>
          <p className="mt-3 h-5 text-center text-[13px] font-semibold" style={{ color: reveal ? (reveal.ok ? C.lime : C.coral) : 'transparent' }}>
            {reveal ? (reveal.ok ? `+${reveal.pts}${reveal.pts >= 140 ? ', lightning fast' : ''}` : picked === -1 ? 'Out of time' : 'Not quite') : '.'}
          </p>
        </div>
      ) : (
        <div className="grid min-h-[340px] place-items-center">
          <p className={cn('text-[22px]', display)} style={{ color: C.muted }}>{run.result ? 'Final whistle' : 'Next up'}</p>
        </div>
      )}
    </Stage>
  );
}
