'use client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Badge, Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input, Select } from '@/components/ui/field';
import { Icon } from '@/components/ui/icons';
import { Bar, Thinking } from '@/components/ui/progress';
import { resolveConnection } from '@/lib/ai/client';
import { tutorSystem } from '@/lib/ai/prompts';
import { useAi, type Concept } from '@/lib/stores/ai';
import { useLearning } from '@/lib/stores/learning';
import { toast } from '@/lib/stores/ui';
import { cn } from '@/lib/utils';
import { conceptQuiz, describeConcept, type QuizQuestion } from './tasks';
import { AiErrorBox, AiOutput } from './ui';
import { useAiRun } from './use-ai-run';

function QuizDialog({ concept, onClose }: { concept: Concept | null; onClose: () => void }) {
  return (
    <Dialog open={Boolean(concept)} onClose={onClose} title={concept?.name ?? ''}>
      <div id="conceptDialogBody" className="border border-line bg-surface-2 p-5 rounded-lg">
        {concept && <QuizBody key={concept.id} concept={concept} onClose={onClose} />}
      </div>
    </Dialog>
  );
}

function QuizBody({ concept, onClose }: { concept: Concept; onClose: () => void }) {
  const updateConcept = useAi((s) => s.updateConcept);
  const [state, setState] = useState<{ questions: QuizQuestion[]; index: number; correct: number; picked: number | null } | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [delta, setDelta] = useState(0);
  const [initial] = useState(concept); // the quiz is written once per opening
  useEffect(() => {
    let cancelled = false;
    conceptQuiz(initial)
      .then((questions) => !cancelled && setState({ questions, index: 0, correct: 0, picked: null }))
      .catch((e: Error) => !cancelled && setError(e));
    return () => {
      cancelled = true;
    };
  }, [initial]);
  if (error) return <AiErrorBox error={error} />;
  if (!state) return <Thinking label="Writing questions…" />;
  if (state.index >= state.questions.length)
    return (
      <div className="py-4 text-center">
        <h3 className="text-xl font-semibold">{state.correct} of {state.questions.length} correct</h3>
        <p className="mt-1 text-sm text-muted">Mastery is now {concept.mastery}% ({delta >= 0 ? '+' : ''}{delta}).</p>
        <Button className="mt-4" data-cq="close" onClick={onClose}>Done</Button>
      </div>
    );
  const q = state.questions[state.index];
  return (
    <>
      <p className="text-[12px] font-semibold text-muted">Question {state.index + 1} of {state.questions.length}</p>
      <h3 className="mt-2 mb-4 font-semibold">{q.q}</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {q.options.map((o, i) => (
          <button key={i} type="button" data-cq-choice={i} disabled={state.picked !== null} onClick={() => setState({ ...state, picked: i, correct: state.correct + (i === q.answer ? 1 : 0) })} className={cn('min-h-12 border bg-surface p-3 text-left text-sm font-semibold rounded-xl', state.picked !== null && i === q.answer ? 'border-ok bg-ok-soft' : state.picked === i ? 'border-danger bg-danger-soft' : 'border-line-strong enabled:hover:bg-accent-soft')}>{o}</button>
        ))}
      </div>
      {state.picked !== null && (
        <>
          <p className={cn('mt-3 text-sm font-semibold', state.picked === q.answer ? 'text-ok' : 'text-danger')}>{state.picked === q.answer ? 'Correct! ' : 'Not quite. '}<span className="font-normal text-ink-2">{q.why}</span></p>
          <Button className="mt-3" data-cq="next" onClick={() => {
            const next = { ...state, index: state.index + 1, picked: null };
            if (next.index >= next.questions.length) {
              const d = next.correct * 15 - (next.questions.length - next.correct) * 10;
              setDelta(d);
              updateConcept(concept.id, { mastery: Math.max(0, Math.min(100, concept.mastery + d)) });
            }
            setState(next);
          }}>{state.index + 1 < state.questions.length ? 'Next question' : 'See results'}</Button>
        </>
      )}
    </>
  );
}

export function ConceptsTool() {
  const ai = useAi();
  const router = useRouter();
  const gaps = useAiRun();
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [quizId, setQuizId] = useState<string | null>(null);
  const [showGaps, setShowGaps] = useState(false);
  const subjects = useMemo(() => [...new Set(ai.concepts.map((c) => c.subject))].sort(), [ai.concepts]);
  const list = ai.concepts
    .filter((c) => (filter === 'all' || c.subject === filter) && (!query || `${c.name} ${c.summary}`.toLowerCase().includes(query.toLowerCase())))
    .sort((a, b) => a.mastery - b.mastery || b.updatedAt - a.updatedAt);
  const avg = ai.concepts.length ? Math.round(ai.concepts.reduce((n, c) => n + c.mastery, 0) / ai.concepts.length) : 0;
  const quizConcept = ai.concepts.find((c) => c.id === quizId) ?? null;

  const add = async () => {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    let concept: Partial<Concept> = { name, summary: '', example: '' };
    if (resolveConnection().mode !== 'none') concept = { ...concept, ...(await describeConcept(name).catch(() => ({}))) };
    ai.upsertConcepts([{ ...concept, name: concept.name || name }], 'Added by you');
    setNewName('');
    setAdding(false);
  };
  const findGaps = () => {
    setShowGaps(true);
    if (!ai.concepts.length && !ai.solves.length) return;
    const concepts = ai.concepts.slice(0, 120).map((c) => `- ${c.name} [${c.subject}] mastery ${c.mastery}%, seen ${c.seen}x`).join('\n');
    const solves = ai.solves.slice(0, 12).map((s) => `- ${s.question.slice(0, 140)}${s.verdict && !s.verdict.agree ? ' (answer was disputed)' : ''}${s.mode === 'hint' ? ' (needed hints)' : ''}`).join('\n');
    gaps.run({ tier: 'main', maxTokens: 2500, system: tutorSystem(ai, "You analyze a student's learning data to find knowledge gaps."), messages: [{ role: 'user', content: `Here is my concept mastery and recent problems.\n\nConcepts:\n${concepts || '(none)'}\n\nRecent problems:\n${solves || '(none)'}\n\nWrite: "## Where you're strong" (short), "## Gaps to close" (ranked, with why each matters and which prerequisite might be missing), "## Your next 30 minutes" (a concrete step-by-step plan), and "## Quick explanations" (a 2-3 sentence breakdown for each of the top 3 gaps).` }] });
  };
  const toSet = () => {
    const cards = list.filter((c) => c.summary).map((c) => ({ front: c.name, back: c.summary }));
    if (cards.length < 2) return toast('You need at least two concept cards with summaries.');
    const set = useLearning.getState().addSet(`Concepts · ${filter === 'all' ? 'All subjects' : filter}`, cards, 'Concept cards');
    toast(`Made a flashcard set with ${set.cards.length} cards in Study games.`);
  };

  return (
    <>
      <Card>
        <CardHeader title="Concept cards" description="Created from every problem you solve. Quiz yourself to raise mastery, and let the tutor find your gaps." action={<div className="flex gap-2"><Button onClick={findGaps}>Find my gaps</Button><Button variant="secondary" onClick={toSet}>Make flashcards</Button></div>} />
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {[[ai.concepts.length, 'concepts'], [ai.concepts.filter((c) => c.mastery >= 80).length, 'mastered'], [ai.concepts.filter((c) => c.mastery < 50).length, 'need work'], [`${avg}%`, 'avg. mastery']].map(([v, l]) => (
            <div key={l} className="bg-surface-2 px-4 py-3 rounded-lg"><strong className="block font-display text-2xl">{v}</strong><span className="text-xs text-muted">{l}</span></div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Select className="w-auto min-w-44 flex-1" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter by subject">
            <option value="all">All subjects ({ai.concepts.length})</option>
            {subjects.map((s) => <option key={s}>{s}</option>)}
          </Select>
          <Input className="min-w-44 flex-1" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search concepts" aria-label="Search concepts" />
          <form className="flex min-w-64 flex-[2] gap-2" onSubmit={(e) => (e.preventDefault(), add())}>
            <Input value={newName} maxLength={80} onChange={(e) => setNewName(e.target.value)} placeholder="Add a concept, e.g. Photosynthesis" aria-label="New concept" />
            <Button type="submit" variant="secondary" loading={adding}>Add</Button>
          </form>
        </div>
      </Card>
      {showGaps && (
        <Card className="relative mt-5" id="conceptGapOutput">
          <button type="button" aria-label="Close" onClick={() => (setShowGaps(false), gaps.stop())} className="absolute top-4 right-4 p-1 text-muted hover:bg-surface-3"><Icon name="close" /></button>
          {!ai.concepts.length && !ai.solves.length ? <p className="text-sm text-muted">Solve a few problems first so there’s something to analyze.</p> : <AiOutput run={gaps} thinking="Looking for patterns in your work…" placeholder={null} />}
        </Card>
      )}
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.length ? list.map((c) => (
          <article key={c.id} className={cn('flex flex-col gap-2 border border-t-[3px] border-line bg-surface p-5', c.mastery >= 80 ? 'border-t-accent' : c.mastery >= 50 ? 'border-t-glow' : 'border-t-line')} data-concept-card>
            <div className="flex justify-between text-xs font-semibold text-muted"><Badge>{c.subject}</Badge><span>{c.mastery}%</span></div>
            <h3 className="mt-1 font-semibold">{c.name}</h3>
            <p className="text-[13px] leading-relaxed text-ink-2">{c.summary}</p>
            {c.example && <p className="text-[13px] text-muted italic">e.g. {c.example}</p>}
            <Bar value={c.mastery} className="mt-auto" />
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Button size="sm" variant="secondary" data-concept="quiz" onClick={() => (resolveConnection().mode === 'none' ? toast('Connect the AI tutor in Settings first.', 'error') : setQuizId(c.id))}>Quiz me</Button>
              <Button size="sm" variant="secondary" onClick={() => router.push(`/study?tool=chat&ask=${encodeURIComponent(`Give me a deeper breakdown of "${c.name}" (${c.subject}). Start with intuition, then the formal idea, a worked example, and the mistakes students usually make.`)}`)}>Go deeper</Button>
              <Button size="sm" variant="secondary" onClick={() => ai.updateConcept(c.id, { mastery: 100 })}>{c.mastery >= 100 ? 'Mastered' : 'I know this'}</Button>
              <button type="button" aria-label={`Delete ${c.name}`} onClick={() => ai.deleteConcept(c.id)} className="ml-auto p-1 text-muted hover:text-danger"><Icon name="trash" className="size-4" /></button>
            </div>
          </article>
        )) : (
          <Card className="text-center sm:col-span-2 xl:col-span-3">
            <h3 className="font-semibold">{ai.concepts.length ? 'No matching concepts' : 'No concept cards yet'}</h3>
            <p className="mt-1 text-sm text-muted">Concept cards are created automatically when you solve problems, or add one yourself above.</p>
            <Link href="/study?action=solve"><Button className="mt-4">Solve a problem</Button></Link>
          </Card>
        )}
      </div>
      <QuizDialog concept={quizConcept} onClose={() => setQuizId(null)} />
    </>
  );
}
