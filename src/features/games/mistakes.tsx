'use client';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { useLearning, type Mistake } from '@/lib/stores/learning';
import { toast } from '@/lib/stores/ui';
import { cn, plural } from '@/lib/utils';

/** Review mistakes one at a time: try to remember, then reveal. Two right in a row clears one. */
function Review({ list, onDone }: { list: Mistake[]; onDone: () => void }) {
  const mark = useLearning((s) => s.markMistake);
  const [queue, setQueue] = useState(() => list.map((m) => m.id));
  const [shown, setShown] = useState(false);
  const all = useLearning((s) => s.mistakes);
  const m = all.find((x) => x.id === queue[0]);
  if (!m)
    return (
      <div className="rounded-xl border border-line bg-surface p-6 text-center">
        <p className="text-[17px] font-semibold">Round done</p>
        <p className="mt-1 text-[13px] text-muted">Mistakes you get right twice leave the notebook.</p>
        <Button className="mt-4" onClick={onDone}>Back to the list</Button>
      </div>
    );
  const next = (right: boolean) => {
    mark(m.id, right);
    setShown(false);
    setQueue((q) => (right ? q.slice(1) : [...q.slice(1), m.id]));
  };
  return (
    <div className="rounded-xl border border-line bg-surface p-6">
      <p className="text-[12px] font-medium text-muted">{m.source} · {plural(queue.length, 'left')}</p>
      <p className="mt-2 text-[19px] leading-7 font-semibold">{m.q}</p>
      {shown ? (
        <>
          <div className="mt-4 rounded-lg bg-ok-soft px-4 py-3 text-[15px] text-ok"><span className="block text-[11px] font-semibold uppercase">Answer</span>{m.a}</div>
          {m.given && <p className="mt-2 text-[13px] text-muted">Last time you said: <span className="text-danger line-through">{m.given}</span></p>}
          <div className="mt-5 flex gap-2">
            <Button onClick={() => next(true)}><Icon name="check" className="size-4" /> I knew it</Button>
            <Button variant="secondary" onClick={() => next(false)}>Not yet</Button>
          </div>
        </>
      ) : <Button className="mt-5" onClick={() => setShown(true)}>Show answer</Button>}
    </div>
  );
}

/** Every question you got wrong, in one place, to review before the exam. */
export function MistakesTool() {
  const mistakes = useLearning((s) => s.mistakes);
  const remove = useLearning((s) => s.removeMistake);
  const [reviewing, setReviewing] = useState(false);
  const [source, setSource] = useState('all');
  const sources = useMemo(() => [...new Set(mistakes.map((m) => m.source.split(' · ')[1] || m.source))], [mistakes]);
  const list = mistakes.filter((m) => source === 'all' || (m.source.split(' · ')[1] || m.source) === source).sort((a, b) => b.misses - a.misses || b.at - a.at);

  if (reviewing) return <Review list={list.slice(0, 20)} onDone={() => setReviewing(false)} />;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="font-sans text-[17px] font-semibold">Mistake notebook</h2>
          <p className="text-[13px] text-muted">Questions you missed in flashcards, quizzes and pop quizzes. Get one right twice and it leaves.</p>
        </div>
        {list.length > 0 && <Button onClick={() => setReviewing(true)}><Icon name="play" className="size-4" /> Review {Math.min(20, list.length)}</Button>}
        {list.length > 0 && (
          <Button variant="secondary" onClick={() => {
            const set = useLearning.getState().addSet(`Mistakes ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`, list.slice(0, 100).map((m) => ({ front: m.q, back: m.a })));
            toast(`${set.cards.length} cards added to Study games.`);
          }}>Make a flashcard set</Button>
        )}
      </div>
      {sources.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {['all', ...sources].map((s) => <button key={s} type="button" onClick={() => setSource(s)} className={cn('rounded-lg border px-2.5 py-1 text-[12px] font-medium', source === s ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line text-ink-2 hover:border-line-strong')}>{s === 'all' ? `All (${mistakes.length})` : s}</button>)}
        </div>
      )}
      {list.length ? (
        <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
          {list.map((m) => (
            <li key={m.id} className="flex items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium">{m.q}</p>
                <p className="mt-0.5 text-[13px] text-ok">{m.a}</p>
                <p className="mt-0.5 text-[12px] text-muted">{m.source} · missed {plural(m.misses, 'time')}{m.rights ? ' · right once since' : ''}</p>
              </div>
              <a href={`/study?tool=chat&ask=${encodeURIComponent(`Explain this so I stop getting it wrong. Question: ${m.q} Correct answer: ${m.a}${m.given ? `. I answered: ${m.given}` : ''}`)}`} className="shrink-0 text-[12px] font-medium text-accent-ink hover:underline">Explain</a>
              <button type="button" aria-label="Remove" onClick={() => remove(m.id)} className="grid size-7 shrink-0 place-items-center rounded-md text-muted hover:bg-surface-3 hover:text-ink"><Icon name="close" className="size-3.5" /></button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-6 rounded-xl border border-dashed border-line px-5 py-8 text-center">
          <p className="text-[15px] font-semibold">No mistakes saved</p>
          <p className="mx-auto mt-1 max-w-[360px] text-[13px] text-muted">When you miss a question in Study games, a quiz, or a pop quiz, it lands here so you can fix it before the exam.</p>
        </div>
      )}
    </div>
  );
}
