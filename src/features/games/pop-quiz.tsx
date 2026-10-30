'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { useExtras } from '@/lib/stores/extras';
import { useLearning } from '@/lib/stores/learning';
import { useProfile } from '@/lib/stores/profile';
import { isQuietNow } from '@/lib/quiet';
import { useUi } from '@/lib/stores/ui';
import type { StudySet } from '@/lib/types';
import { cn, shuffle } from '@/lib/utils';
import { isDue } from './srs';

export const POP_POINTS = 3;
const EVERY_MS = 40 * 60_000;

interface Question { setId: string; setName: string; cardId: string; front: string; answer: string; options: string[] }

/** One multiple-choice question from your own cards, due cards first. */
export function pickQuestion(sets: StudySet[], rand = Math.random): Question | null {
  const usable = sets.filter((s) => new Set(s.cards.map((c) => c.back.trim())).size >= 4);
  if (!usable.length) return null;
  const due = usable.flatMap((s) => s.cards.filter((c) => isDue(c)).map((c) => ({ s, c })));
  const pool = due.length ? due : usable.flatMap((s) => s.cards.map((c) => ({ s, c })));
  const { s, c } = pool[Math.floor(rand() * pool.length)];
  const others = shuffle([...new Set(s.cards.map((x) => x.back.trim()).filter((b) => b !== c.back.trim()))]).slice(0, 3);
  return { setId: s.id, setName: s.name, cardId: c.id, front: c.front, answer: c.back.trim(), options: shuffle([c.back.trim(), ...others]) };
}

let last = Date.now();

export function PopQuiz() {
  const open = useUi((s) => s.popQuiz);
  const [q, setQ] = useState<Question | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);

  useEffect(() => {
    const show = (manual = false) => {
      if (!manual && isQuietNow()) return;
      const ui = useUi.getState();
      if (!useExtras.getState().popQuiz || ui.popQuiz || ui.waterPrompt || useProfile.getState().timer.mode === 'running') return;
      const next = pickQuestion(useLearning.getState().sets);
      if (!next) return;
      last = Date.now();
      setQ(next);
      setChosen(null);
      useUi.setState({ popQuiz: true });
    };
    // Right after a session ends, and every 40 minutes otherwise.
    const off = useProfile.subscribe((s, prev) => {
      if (s.sessions.length > prev.sessions.length) setTimeout(() => show(), 2500);
    });
    const id = setInterval(() => Date.now() - last > EVERY_MS && show(), 60_000);
    const manual = () => show(true);
    window.addEventListener('studytime:popquiz', manual);
    return () => (off(), clearInterval(id), window.removeEventListener('studytime:popquiz', manual));
  }, []);

  if (!open || !q) return null;
  const close = () => useUi.setState({ popQuiz: false });
  const answer = (o: string) => {
    if (chosen) return;
    setChosen(o);
    const right = o === q.answer;
    useLearning.getState().rateCard(q.setId, q.cardId, right ? 'good' : 'again', o, 'Pop quiz');
    if (right) useProfile.getState().update({ points: useProfile.getState().points + POP_POINTS });
  };
  const another = () => {
    const next = pickQuestion(useLearning.getState().sets);
    if (!next) return close();
    setQ(next);
    setChosen(null);
  };
  return (
    <div role="dialog" aria-labelledby="pq-title" className="water-pop fixed right-4 bottom-20 z-50 w-[min(380px,calc(100vw-32px))] panel p-4 shadow-lg lg:right-6 lg:bottom-6">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium text-muted">Pop quiz · {q.setName}</p>
          <p id="pq-title" className="mt-1 text-[15px] leading-6 font-semibold">{q.front}</p>
        </div>
        <button type="button" onClick={close} aria-label="Close" className="-mt-1 -mr-1 grid size-7 shrink-0 place-items-center rounded-md text-muted hover:bg-surface-3 hover:text-ink"><Icon name="close" className="size-4" /></button>
      </div>
      <div className="mt-3 grid gap-1.5">
        {q.options.map((o) => {
          const right = chosen && o === q.answer;
          const wrong = chosen === o && o !== q.answer;
          return (
            <button key={o} type="button" disabled={Boolean(chosen)} onClick={() => answer(o)} className={cn('rounded-lg border px-3 py-2 text-left text-[13px] leading-5 transition-colors', right ? 'border-ok bg-ok-soft text-ok' : wrong ? 'border-danger bg-danger-soft text-danger' : 'border-line hover:border-ink disabled:opacity-60')}>{o}</button>
          );
        })}
      </div>
      {chosen && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <p className={cn('text-[13px] font-medium', chosen === q.answer ? 'text-ok' : 'text-ink-2')}>{chosen === q.answer ? `Right. +${POP_POINTS} points.` : 'Not quite. It will come back sooner.'}</p>
          <div className="flex gap-1.5">
            <Button size="sm" variant="ghost" onClick={close}>Done</Button>
            <Button size="sm" onClick={another}>Another</Button>
          </div>
        </div>
      )}
    </div>
  );
}
