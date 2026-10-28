'use client';
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { useLearning } from '@/lib/stores/learning';
import type { Card as StudyCard, StudySet } from '@/lib/types';
import { cn, shuffle } from '@/lib/utils';
import { isDue, previewInterval, RATINGS, type Rating } from './srs';

export type Mode = 'review' | 'flashcards' | 'quiz' | 'matching' | 'blank' | 'speed';
export const MODES: { id: Mode; label: string }[] = [
  { id: 'review', label: 'Smart review' },
  { id: 'flashcards', label: 'Flashcards' },
  { id: 'quiz', label: 'Quiz' },
  { id: 'matching', label: 'Matching' },
  { id: 'blank', label: 'Fill in the blank' },
  { id: 'speed', label: 'Speed round' },
];

const Progress = ({ children }: { children: React.ReactNode }) => <p className="text-[12px] font-semibold text-muted">{children}</p>;
const Result = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="py-6 text-center">
    <h3 className="text-xl font-semibold">{title}</h3>
    <div className="mt-2 text-sm text-muted">{children}</div>
  </div>
);
const Feedback = ({ ok, children }: { ok: boolean | null; children: React.ReactNode }) => (
  <p className={cn('mt-3 min-h-5 text-sm', ok === true && 'font-semibold text-ok', ok === false && 'font-semibold text-danger', ok === null && 'text-muted')}>{children}</p>
);

function FlipCard({ front, back, flipped, onFlip, hint }: { front: string; back: string; flipped: boolean; onFlip: () => void; hint: string }) {
  return (
    <button type="button" onClick={onFlip} className="mt-3 flex min-h-48 w-full flex-col items-center justify-center gap-3 border-2 border-line-strong bg-surface p-6 text-center transition-colors hover:border-accent">
      <small className="text-[12px] font-semibold text-muted">{flipped ? 'ANSWER' : 'QUESTION'} · {hint}</small>
      <strong className="font-display text-xl leading-snug text-ink">{flipped ? back : front}</strong>
      {flipped && <em className="text-[13px] text-muted not-italic">{front}</em>}
    </button>
  );
}

const pickRandom = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

function choicesFor(cards: StudyCard[], card: StudyCard) {
  const others = shuffle([...new Set(cards.filter((c) => c.id !== card.id).map((c) => c.back))].filter((b) => b !== card.back));
  return shuffle([card.back, ...others.slice(0, 3)]);
}

export function ReviewMode({ set }: { set: StudySet }) {
  const rateCard = useLearning((s) => s.rateCard);
  const [queue, setQueue] = useState(() => shuffle(set.cards.filter((c) => isDue(c)).map((c) => c.id)));
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const card = set.cards.find((c) => c.id === queue[0]);
  const rate = (r: Rating) => {
    if (!card) return;
    rateCard(set.id, card.id, r);
    setReviewed((n) => n + 1);
    setFlipped(false);
    setQueue((q) => {
      const rest = q.slice(1);
      if (r === 'again') rest.splice(Math.min(rest.length, 3), 0, card.id);
      return rest;
    });
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,textarea,select,[contenteditable]')) return;
      if (e.key === ' ' && !flipped && card) {
        e.preventDefault();
        setFlipped(true);
      }
      else if (flipped && ['1', '2', '3', '4'].includes(e.key)) rate(RATINGS[Number(e.key) - 1].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  if (!card) {
    const next = set.cards.filter((c) => c.srs).sort((a, b) => a.srs!.due - b.srs!.due)[0];
    return (
      <Result title={reviewed ? 'Review complete!' : 'All caught up'}>
        {reviewed ? `You reviewed ${reviewed} card${reviewed === 1 ? '' : 's'}. ` : ''}
        {next ? `Next card is due ${new Date(next.srs!.due).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}.` : 'Nothing is due right now.'}
        <div className="mt-4"><Button variant="secondary" onClick={() => (setQueue(shuffle(set.cards.map((c) => c.id))), setReviewed(0))}>Review all cards anyway</Button></div>
      </Result>
    );
  }
  return (
    <>
      <Progress>Smart review · {queue.length} left · spaced repetition</Progress>
      <FlipCard front={card.front} back={card.back} flipped={flipped} onFlip={() => setFlipped(!flipped)} hint={flipped ? 'HOW WELL DID YOU KNOW IT?' : 'CLICK OR PRESS SPACE'} />
      {flipped ? (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {RATINGS.map((r, i) => (
            <button key={r.id} type="button" onClick={() => rate(r.id)} className={cn('grid gap-0.5 border bg-surface px-2 py-2.5 rounded-xl', r.id === 'again' ? 'border-danger/40' : r.id === 'good' ? 'border-ok/40' : 'border-line-strong')}>
              <strong className={cn('text-sm', r.id === 'again' && 'text-danger', r.id === 'good' && 'text-ok')}>{r.label}</strong>
              <small className="text-[12px] text-muted">{previewInterval(card.srs, r.id)} · {i + 1}</small>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-[13px] text-muted">Try to recall the answer before flipping.</span>
          <Button onClick={() => setFlipped(true)}>Show answer</Button>
        </div>
      )}
    </>
  );
}

export function FlashcardsMode({ set }: { set: StudySet }) {
  const order = useMemo(() => shuffle(set.cards.map((_, i) => i)), [set.cards]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = set.cards[order[index % order.length]];
  return (
    <>
      <Progress>Card {(index % order.length) + 1} of {order.length}</Progress>
      <FlipCard front={card.front} back={card.back} flipped={flipped} onFlip={() => setFlipped(!flipped)} hint="CLICK TO FLIP" />
      <div className="mt-3 flex justify-between gap-2">
        <Button variant="secondary" onClick={() => setFlipped(!flipped)}>{flipped ? 'Show question' : 'Show answer'}</Button>
        <Button onClick={() => (setIndex(index + 1), setFlipped(false))}>Next card →</Button>
      </div>
    </>
  );
}

export function QuizMode({ set }: { set: StudySet }) {
  const [round, setRound] = useState(0);
  const order = useMemo(() => shuffle(set.cards), [set.cards, round]); // eslint-disable-line react-hooks/exhaustive-deps
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const card = order[index];
  const choices = useMemo(() => (card ? choicesFor(set.cards, card) : []), [card, set.cards]);
  if (new Set(set.cards.map((c) => c.back)).size < 2) return <Result title="Need more cards">Add at least two different answers for a quiz.</Result>;
  if (!card) return <Result title="Round complete!">{score} of {order.length} correct<div className="mt-4"><Button onClick={() => (setRound(round + 1), setIndex(0), setScore(0), setPicked(null))}>Play again</Button></div></Result>;
  return (
    <>
      <Progress>Question {index + 1} of {order.length} · {score} correct</Progress>
      <h3 className="mt-3 mb-4 text-lg font-semibold">{card.front}</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {choices.map((c) => (
          <button key={c} type="button" disabled={picked !== null} onClick={() => { setPicked(c); if (c === card.back) setScore(score + 1); else useLearning.getState().addMistake({ q: card.front, a: card.back, given: c, source: `Quiz · ${set.name}`, setId: set.id, cardId: card.id }); }} className={cn('min-h-14 border bg-surface p-3 text-left text-sm font-semibold transition-colors enabled:hover:bg-accent-soft rounded-xl', picked !== null && c === card.back ? 'border-ok bg-ok-soft' : picked === c ? 'border-danger bg-danger-soft' : 'border-line-strong')}>
            {c}
          </button>
        ))}
      </div>
      {picked !== null && (
        <>
          <Feedback ok={picked === card.back}>{picked === card.back ? 'Correct!' : `Answer: ${card.back}`}</Feedback>
          <Button className="mt-2" onClick={() => (setIndex(index + 1), setPicked(null))}>Next question →</Button>
        </>
      )}
    </>
  );
}

export function BlankMode({ set }: { set: StudySet }) {
  const [round, setRound] = useState(0);
  const order = useMemo(() => shuffle(set.cards), [set.cards, round]); // eslint-disable-line react-hooks/exhaustive-deps
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState('');
  const [result, setResult] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const card = order[index];
  const norm = (t: string) => t.trim().toLowerCase().replace(/[.!?]+$/, '').replace(/\s+/g, ' ');
  if (!card) return <Result title="Round complete!">{score} of {order.length} correct<div className="mt-4"><Button onClick={() => (setRound(round + 1), setIndex(0), setScore(0))}>Play again</Button></div></Result>;
  return (
    <>
      <Progress>Question {index + 1} of {order.length} · {score} correct</Progress>
      <h3 className="mt-3 mb-4 text-lg font-semibold">{card.front}</h3>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (result !== null) return;
          const ok = norm(value) === norm(card.back);
          setResult(ok);
          if (ok) setScore(score + 1);
          else useLearning.getState().addMistake({ q: card.front, a: card.back, given: value.trim(), source: `Fill in the blank · ${set.name}`, setId: set.id, cardId: card.id });
        }}
      >
        <Input autoFocus className="min-w-40 flex-1" value={value} disabled={result !== null} onChange={(e) => setValue(e.target.value)} placeholder="Type the answer" aria-label="Your answer" />
        <Button type="submit" disabled={result !== null}>Check answer</Button>
      </form>
      {result !== null && (
        <>
          <Feedback ok={result}>{result ? 'Correct!' : `Answer: ${card.back}`}</Feedback>
          <Button className="mt-2" onClick={() => (setIndex(index + 1), setValue(''), setResult(null))}>Next question →</Button>
        </>
      )}
    </>
  );
}

export function MatchingMode({ set }: { set: StudySet }) {
  const [round, setRound] = useState(0);
  const tiles = useMemo(() => shuffle(shuffle(set.cards).slice(0, 6).flatMap((c) => [{ pair: c.id, text: c.front, kind: 'front' }, { pair: c.id, text: c.back, kind: 'back' }])), [set.cards, round]); // eslint-disable-line react-hooks/exhaustive-deps
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const complete = matched.size === tiles.length / 2;
  const click = (i: number) => {
    const tile = tiles[i];
    if (matched.has(tile.pair)) return;
    if (picked === null) return (setPicked(i), setFeedback('Choose the matching answer.'));
    if (picked === i) return (setPicked(null), setFeedback(''));
    const first = tiles[picked];
    if (first.pair === tile.pair && first.kind !== tile.kind) {
      setMatched(new Set([...matched, tile.pair]));
      setFeedback('Match found!');
    } else setFeedback('Try another pair.');
    setPicked(null);
  };
  return (
    <>
      <Progress>Match each term with its answer · {matched.size} of {tiles.length / 2} pairs</Progress>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tiles.map((t, i) => (
          <button key={i} type="button" disabled={matched.has(t.pair)} onClick={() => click(i)} className={cn('min-h-16 border p-3 text-sm font-semibold transition-colors rounded-xl', matched.has(t.pair) ? 'border-transparent bg-ok-soft text-ok' : picked === i ? 'border-accent bg-accent-soft' : 'border-line-strong bg-surface hover:bg-surface-2')}>
            {t.text}
          </button>
        ))}
      </div>
      <Feedback ok={complete ? true : null}>{complete ? 'All pairs matched. Nice work!' : feedback}</Feedback>
      {complete && <Button className="mt-2" onClick={() => (setRound(round + 1), setMatched(new Set()), setFeedback(''))}>Shuffle and play again</Button>}
    </>
  );
}

export function SpeedMode({ set }: { set: StudySet }) {
  const best = useLearning((s) => s.best[set.id] ?? 0);
  const recordBest = useLearning((s) => s.recordBest);
  const [phase, setPhase] = useState<'intro' | 'playing' | 'over'>('intro');
  const [left, setLeft] = useState(60);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [card, setCard] = useState<StudyCard>(() => set.cards[0]);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [record, setRecord] = useState(false);
  const scoreRef = useRef(0);
  const choices = useMemo(() => choicesFor(set.cards, card), [card, set.cards]);
  const finish = useEffectEvent(() => {
    setPhase('over');
    setRecord(recordBest(set.id, scoreRef.current));
  });
  useEffect(() => {
    if (phase !== 'playing') return;
    const endsAt = Date.now() + 60_000;
    const id = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining === 0) {
        clearInterval(id);
        finish();
      }
    }, 250);
    return () => clearInterval(id);
  }, [phase]);
  if (new Set(set.cards.map((c) => c.back)).size < 2) return <Result title="Need more cards">Add at least two different answers for this game.</Result>;
  const next = () => setCard(pickRandom(set.cards));
  const start = () => {
    scoreRef.current = 0;
    setScore(0);
    setStreak(0);
    setFeedback(null);
    setRecord(false);
    setLeft(60);
    next();
    setPhase('playing');
  };
  if (phase === 'intro') return <Result title="Speed round">Answer as many as you can in 60 seconds. Streaks earn bonus points.{best ? ` Your best on this set: ${best}.` : ''}<div className="mt-4"><Button onClick={start}>Start</Button></div></Result>;
  if (phase === 'over') return <Result title={record ? 'New best!' : 'Time!'}>You scored <b>{score}</b> points{record ? '' : ` · best ${best}`}.<div className="mt-4"><Button onClick={start}>Play again</Button></div></Result>;
  const answer = (c: string) => {
    if (c === card.back) {
      const gained = 10 + Math.min(10, streak * 2);
      scoreRef.current += gained;
      setScore(scoreRef.current);
      setStreak(streak + 1);
      setFeedback({ ok: true, text: 'Correct!' });
    } else {
      setStreak(0);
      setFeedback({ ok: false, text: `Answer: ${card.back}` });
    }
    next();
  };
  return (
    <>
      <div className="flex items-center justify-between text-sm font-semibold">
        <span className={cn('font-display text-2xl', left <= 10 ? 'text-danger' : 'text-accent-ink')}>{left}s</span>
        <span>{score} pts{streak > 1 ? ` · ${streak} in a row` : ''}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden bg-surface-3"><div className="h-full bg-accent transition-[width] duration-200" style={{ width: `${(left / 60) * 100}%` }} /></div>
      <h3 className="mt-4 mb-4 text-lg font-semibold">{card.front}</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {choices.map((c) => (
          <button key={c} type="button" onClick={() => answer(c)} className="min-h-14 border border-line-strong bg-surface p-3 text-left text-sm font-semibold hover:bg-accent-soft rounded-xl">
            {c}
          </button>
        ))}
      </div>
      <Feedback ok={feedback?.ok ?? null}>{feedback?.text}</Feedback>
    </>
  );
}

export function GameStage({ set, mode }: { set: StudySet; mode: Mode }) {
  if (!set.cards.length) return <Result title="No cards yet">Add cards to this set to play.</Result>;
  const key = `${set.id}-${mode}-${set.cards.length}`;
  switch (mode) {
    case 'review': return <ReviewMode key={key} set={set} />;
    case 'flashcards': return <FlashcardsMode key={key} set={set} />;
    case 'quiz': return <QuizMode key={key} set={set} />;
    case 'blank': return <BlankMode key={key} set={set} />;
    case 'matching': return <MatchingMode key={key} set={set} />;
    case 'speed': return <SpeedMode key={key} set={set} />;
  }
}
