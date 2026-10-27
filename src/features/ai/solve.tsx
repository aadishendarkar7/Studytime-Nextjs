'use client';
import Link from 'next/link';
import { useEffect, useEffectEvent, useState } from 'react';
import { DropZone, FileTray, useAttachments } from '@/components/ui/attachments';
import { Badge, Card, CardHeader, Empty } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Note, Textarea } from '@/components/ui/field';
import { Icon } from '@/components/ui/icons';
import { Markdown } from '@/components/ui/markdown';
import { Segmented } from '@/components/ui/segmented';
import { toParts } from '@/lib/ai/files';
import { SOLVE_PROMPTS, tutorSystem } from '@/lib/ai/prompts';
import { useAi, type Solve } from '@/lib/stores/ai';
import { toast } from '@/lib/stores/ui';
import { shortDate, uid } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { crossCheck, extractConcepts } from './tasks';
import { AiOutput, Placeholder } from './ui';
import { useAiRun } from './use-ai-run';

type SolveMode = Solve['mode'];

export function SolveTool() {
  const ai = useAi();
  const router = useRouter();
  const att = useAttachments(6);
  const run = useAiRun();
  const practice = useAiRun();
  const [question, setQuestion] = useState('');
  const [mode, setMode] = useState<SolveMode>('full');
  const [current, setCurrent] = useState<Solve | null>(null);
  const [checking, setChecking] = useState(false);

  const addPasted = useEffectEvent((images: File[]) => att.add(images));
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const images = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'));
      if (images.length) {
        e.preventDefault();
        addPasted(images);
        toast('Image pasted.');
      }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, []);

  const solve = async () => {
    if (!question.trim() && !att.files.length) return toast('Add a photo or type a problem first.');
    practice.reset();
    setCurrent(null);
    const files = att.files;
    const q = question.trim() || `Photo problem (${files.length} image${files.length === 1 ? '' : 's'})`;
    const answer = await run.run({
      tier: 'main',
      maxTokens: 4000,
      system: tutorSystem(ai),
      messages: [{ role: 'user', content: [...toParts(files), { type: 'text', text: `${SOLVE_PROMPTS[mode]}\n\n${question.trim() ? `Student's note or problem:\n${question.trim()}` : 'The problem is in the attached image(s).'}` }] }],
    });
    if (!answer) return;
    const record: Solve = { id: uid(), at: Date.now(), mode, question: q, answer, verdict: null, concepts: [] };
    setCurrent(record);
    setChecking(mode === 'full' && ai.crossCheck);
    const jobs: Promise<void>[] = [];
    if (mode === 'full' && ai.crossCheck) {
      jobs.push(
        crossCheck(question, answer, files)
          .then((v) => void (record.verdict = v))
          .catch(() => {})
          .finally(() => setChecking(false)),
      );
    }
    jobs.push(
      extractConcepts(q, answer)
        .then((list) => {
          record.concepts = list.map((c) => c.name!).filter(Boolean);
          const added = useAi.getState().upsertConcepts(list, q);
          if (added) toast(`${added} new concept card${added === 1 ? '' : 's'} added.`);
        })
        .catch(() => {}),
    );
    await Promise.all(jobs);
    setCurrent({ ...record });
    useAi.getState().addSolve({ ...record });
  };

  const morePractice = () => {
    if (!current) return;
    practice.run({
      tier: 'main',
      maxTokens: 2500,
      system: tutorSystem(ai, 'Create practice problems.'),
      messages: [{ role: 'user', content: `Write 3 practice problems that use the same concepts as this one, getting slightly harder. Number them under "## Practice problems". Then add "## Answers" with a short worked answer for each.\n\nOriginal problem: ${current.question}\n\nSolution for reference:\n${current.answer.slice(0, 5000)}` }],
    });
  };
  const followUp = () => {
    if (!current) return;
    const chat = { id: uid(), title: `Follow-up: ${current.question.slice(0, 36)}`, mode: 'tutor' as const, updatedAt: Date.now(), messages: [{ role: 'user' as const, content: `I'm working on this problem:\n${current.question}` }, { role: 'assistant' as const, content: current.answer }] };
    useAi.getState().upsertChat(chat);
    router.push('/ai/chat');
  };

  const [practiceMain, practiceAnswers] = practice.text.split(/\n(?=#+\s*Answers)/i);
  const verdict = current?.verdict;

  return (
    <>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Card>
          <CardHeader title="Snap & solve" />
          <DropZone onFiles={att.add} accept="image/*,.pdf" title="Drop, paste, or upload a photo" hint="Homework, worksheets, or textbook pages · JPG, PNG, or PDF" inputId="solveFile" />
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 bg-surface-3 px-4 text-sm font-semibold text-ink-2 hover:bg-accent-soft rounded-lg">
              <Icon name="camera" className="size-4" /> Take a photo
              <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files && att.add(e.target.files)} />
            </label>
            <span className="text-[13px] text-muted">Tip: Ctrl+V pastes a screenshot.</span>
          </div>
          <FileTray files={att.files} onRemove={att.remove} reading={att.reading} />
          <Field label="Or type the problem" htmlFor="solveText" className="mt-4">
            <Textarea id="solveText" rows={4} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. Find the derivative of f(x) = x² · sin(x)" />
          </Field>
          <Field label="How should I help?">
            <Segmented value={mode} onChange={setMode} label="Help style" options={[{ value: 'full', label: 'Step-by-step' }, { value: 'hint', label: 'Hints only' }, { value: 'check', label: 'Check my work' }]} />
          </Field>
          <Checkbox label="Cross-check the answer with a second pass" checked={ai.crossCheck} onChange={(e) => ai.update({ crossCheck: e.target.checked })} />
          <Button size="lg" block className="mt-5" loading={run.running} onClick={solve}>{mode === 'hint' ? 'Give me a hint' : mode === 'check' ? 'Check my work' : 'Solve it'}</Button>
          <Note>Use this to learn the method. Your class’s academic integrity rules still apply.</Note>
        </Card>
        <Card>
          <CardHeader
            title={mode === 'hint' ? 'Your hints' : mode === 'check' ? 'Work check' : 'Step-by-step solution'}
            action={checking ? <Badge>Cross-checking</Badge> : verdict ? <Badge tone={verdict.agree ? 'ok' : 'warn'}>{verdict.agree ? 'Cross-check agrees' : 'Cross-check disagrees'}</Badge> : null}
          />
          <div id="solveOutput">
            <AiOutput run={run} thinking={att.files.length ? 'Reading your photo…' : 'Working through it…'} placeholder={<Placeholder title="Your solution appears here.">Each problem is explained step by step, cross-checked with a second pass, and broken into concept cards you can review later.</Placeholder>} />
          </div>
          {verdict && (
            <div className={`mt-4  px-4 py-3 text-sm ${verdict.agree ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn'}`}>
              <strong>{verdict.agree ? 'Cross-checked.' : 'The second check disagrees.'}</strong> {verdict.note}
              {!verdict.agree && verdict.finalAnswer && <> Its answer: <b>{verdict.finalAnswer}</b>. Ask a follow-up to work out which is right.</>}
            </div>
          )}
          {current && current.concepts.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted">Concept cards:</span>
              {current.concepts.map((c) => <Link key={c} href="/ai/concepts" className="border border-line-strong bg-surface-2 px-3 py-1.5 text-[13px] font-semibold text-ink-2 hover:bg-accent-soft rounded-lg">{c}</Link>)}
            </div>
          )}
          {current && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={followUp}>Ask a follow-up</Button>
              <Button variant="secondary" loading={practice.running} onClick={morePractice}>Similar practice problems</Button>
              <Button variant="secondary" onClick={() => (useAi.getState().saveNote({ title: current.question.slice(0, 60), folder: 'General', kind: 'solution', content: current.answer }), toast('Saved to Notes.'))}>Save to notes</Button>
            </div>
          )}
          {(practice.text || practice.running || practice.error) && (
            <div className="mt-5 border-t border-line pt-5" id="practiceBox">
              <AiOutput run={{ ...practice, text: practiceMain ?? '' }} thinking="Writing practice problems…" placeholder={null} />
              {practiceAnswers && practice.status === 'done' && (
                <details className="mt-3 border border-line px-4 py-3 rounded-xl">
                  <summary className="text-sm font-semibold text-accent-ink">Show answers</summary>
                  <Markdown className="mt-3">{practiceAnswers}</Markdown>
                </details>
              )}
            </div>
          )}
        </Card>
      </div>
      <SolveHistory onOpen={(s) => (run.setText(s.answer), setCurrent(s), setMode(s.mode), window.scrollTo({ top: 0, behavior: 'smooth' }))} />
    </>
  );
}

function SolveHistory({ onOpen }: { onOpen: (s: Solve) => void }) {
  const solves = useAi((s) => s.solves);
  return (
    <Card className="mt-5">
      <CardHeader title="Recent problems" />
      {solves.length ? (
        solves.slice(0, 12).map((s) => (
          <button key={s.id} type="button" data-solve-id={s.id} onClick={() => onOpen(s)} className="flex w-full items-center justify-between gap-3 border-b border-line py-3 text-left last:border-0 hover:text-accent-ink">
            <span className="min-w-0">
              <strong className="block truncate text-sm">{s.question}</strong>
              <small className="text-xs text-muted">{shortDate(s.at)} · {s.mode === 'hint' ? 'Hints' : s.mode === 'check' ? 'Work check' : 'Solution'}{s.verdict ? (s.verdict.agree ? ' · cross-checked' : ' · cross-check disagreed') : ''}</small>
            </span>
            <Icon name="arrow" className="size-4 shrink-0 text-muted" />
          </button>
        ))
      ) : (
        <Empty>Problems you solve will be saved here.</Empty>
      )}
    </Card>
  );
}
