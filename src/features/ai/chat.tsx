'use client';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { FileTray, useAttachments } from '@/components/ui/attachments';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Icon, Logo } from '@/components/ui/icons';
import { isDue } from '@/features/games/srs';
import { Markdown } from '@/components/ui/markdown';
import { Thinking } from '@/components/ui/progress';
import { toParts } from '@/lib/ai/files';
import { supportSystem, tutorSystem } from '@/lib/ai/prompts';
import type { AiMessage } from '@/lib/ai/providers';
import { useAi, type Chat } from '@/lib/stores/ai';
import { useLearning } from '@/lib/stores/learning';
import { useProfile } from '@/lib/stores/profile';
import { toast, useUi } from '@/lib/stores/ui';
import { cn, copyText, parseJSONLoose, shortDate, uid } from '@/lib/utils';
import { ACTIONS, actionById } from './actions';
import { generateCards } from './tasks';
import { useAiRun } from './use-ai-run';
import { AiErrorBox } from './ui';
import { askConfirm } from '@/lib/stores/ask';

/** Study modes. Each one changes how the tutor works, not just the wording. */
const MODES: { id: string; label: string; note: string; placeholder: string; starters: string[] }[] = [
  { id: 'teach', label: 'Teach me', note: 'Guides you one step at a time with questions, so you work it out yourself.', placeholder: 'What topic or problem do you want to learn?', starters: ['How does a hypothesis test work?', 'Teach me integration by parts', 'Why does supply and demand set prices?'] },
  { id: 'quiz', label: 'Quiz me', note: 'Five questions you answer right here, with a score at the end.', placeholder: 'What should the quiz cover? Or attach your notes or slides.', starters: ['Quiz me on the normal distribution', 'Quiz me on cell biology basics', 'Quiz me on derivatives'] },
  { id: 'solve', label: 'Solve step by step', note: 'A full worked solution with the reason for every step.', placeholder: 'Paste the problem or attach a photo of it', starters: [] },
  { id: 'check', label: 'Check my work', note: 'Paste or photograph your attempt. It finds the exact step that went wrong.', placeholder: 'Paste your work, or attach a photo of it', starters: [] },
  { id: 'summary', label: 'Summarize', note: 'Turn slides, a reading or a lecture into the key points.', placeholder: 'Attach slides, a PDF or paste a reading', starters: [] },
  { id: '', label: 'Ask anything', note: 'A normal question about your class.', placeholder: 'Ask a question about your class', starters: ['What’s the difference between mean and median?', 'Make me a study plan for my midterm'] },
];
const SUPPORT_STARTERS = ['I’m stressed about my exam', 'I keep procrastinating', 'I feel behind in my classes', 'I can’t focus today'];

/** A quiz the tutor wrote, stored in the chat as JSON after this marker and shown as a playable quiz. */
const QUIZ_MARK = '@@QUIZ@@';
type QuizQ = { q: string; options: string[]; answer: number; why?: string };
const readQuiz = (content: string): QuizQ[] | null => {
  if (!content.startsWith(QUIZ_MARK)) return null;
  try {
    return JSON.parse(content.slice(QUIZ_MARK.length)) as QuizQ[];
  } catch {
    return null;
  }
};

/** Pick an answer for each question, see why, get a score, and keep the misses as flashcards. */
function QuizBlock({ quiz, title, onAgain }: { quiz: QuizQ[]; title: string; onAgain: () => void }) {
  const [picks, setPicks] = useState<(number | null)[]>(() => quiz.map(() => null));
  const done = picks.every((p) => p !== null);
  const score = quiz.reduce((n, q, i) => n + (picks[i] === q.answer ? 1 : 0), 0);
  const misses = quiz.filter((q, i) => picks[i] !== null && picks[i] !== q.answer);
  return (
    <div className="rounded-lg border border-line">
      <div className="flex items-center justify-between gap-3 rounded-t-lg bg-accent-fill px-4 py-3 text-white">
        <p className="text-[15px] font-semibold">Quiz</p>
        <p className="tnum text-[13px] text-white/80">{picks.filter((p) => p !== null).length} of {quiz.length} answered{done ? `, ${score} right` : ''}</p>
      </div>
      <ol className="divide-y divide-line">
        {quiz.map((q, qi) => {
          const picked = picks[qi];
          return (
            <li key={qi} className="px-4 py-3.5">
              <p className="text-[15px] font-medium">{qi + 1}. {q.q}</p>
              <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {q.options.map((o, oi) => {
                  const right = picked !== null && oi === q.answer;
                  const wrong = picked === oi && oi !== q.answer;
                  return (
                    <button key={oi} type="button" disabled={picked !== null} onClick={() => setPicks(picks.map((p, i) => (i === qi ? oi : p)))} className={cn('rounded-md border px-3 py-2 text-left text-[14px] transition-colors', right ? 'border-ok bg-ok-soft text-ok' : wrong ? 'border-danger bg-danger-soft text-danger' : picked === null ? 'border-line hover:border-ink' : 'border-line text-muted')}>
                      {o}
                    </button>
                  );
                })}
              </div>
              {picked !== null && q.why && <p className="mt-2 text-[13px] text-muted">{picked === q.answer ? 'Right. ' : 'Not quite. '}{q.why}</p>}
            </li>
          );
        })}
      </ol>
      {done && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
          <p className="mr-auto text-[14px] font-semibold">{score === quiz.length ? 'Perfect score.' : score >= quiz.length - 1 ? 'Nearly there.' : 'Worth another pass.'} {score}/{quiz.length}</p>
          {misses.length > 0 && <Button size="sm" variant="secondary" onClick={() => { const set = useLearning.getState().addSet(`Missed: ${title}`.slice(0, 80), misses.map((q) => ({ front: q.q, back: q.options[q.answer] }))); toast(`${set.cards.length} missed ${set.cards.length === 1 ? 'question' : 'questions'} saved as flashcards.`); }}>Save misses as flashcards</Button>}
          <Button size="sm" onClick={onAgain}>New quiz</Button>
        </div>
      )}
    </div>
  );
}

/** Save, download, copy, or turn a reply into flashcards. */
function ResultBar({ content, title, kind }: { content: string; title: string; kind: string }) {
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const act = actionById(kind);
  const name = `${act ? `${act.label}: ` : ''}${title}`.slice(0, 80);
  const btn = 'inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium text-muted hover:bg-surface-3 hover:text-ink disabled:opacity-50';
  return (
    <div className="mt-2 flex flex-wrap items-center gap-0.5">
      <button type="button" className={btn} disabled={saved} onClick={() => { useAi.getState().saveNote({ title: name, folder: 'General', kind: act?.kind ?? 'notes', content }); setSaved(true); toast('Saved to Notes.'); }}><Icon name={saved ? 'check' : 'file'} className="size-3.5" />{saved ? 'Saved' : 'Save to notes'}</button>
      <button type="button" className={btn} disabled={busy} onClick={async () => {
        setBusy(true);
        try {
          const set = useLearning.getState().addSet(name, await generateCards(content, 15));
          toast(`${set.cards.length} flashcards added to Study games.`);
        } catch (e) {
          toast((e as Error).message, 'error');
        } finally {
          setBusy(false);
        }
      }}><Icon name="games" className="size-3.5" />{busy ? 'Making cards' : 'Flashcards'}</button>
      <button type="button" className={btn} onClick={() => useUi.getState().print({ title: name, markdown: content })}><Icon name="download" className="size-3.5" />PDF</button>
      <button type="button" className={btn} onClick={async () => toast((await copyText(content)) ? 'Copied.' : 'Could not copy.')}><Icon name="copy" className="size-3.5" />Copy</button>
    </div>
  );
}

/** compact: a narrow side panel with the chat list folded into a menu. */
export function ChatTool({ compact = false, initialAction = '', onHide }: { compact?: boolean; initialAction?: string; onHide?: () => void } = {}) {
  const ai = useAi();
  const run = useAiRun();
  const att = useAttachments(5);
  const [input, setInput] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [action, setAction] = useState(initialAction || 'teach');
  const [custom, setCustom] = useState('');
  const courses = useProfile((s) => s.courses);
  const reminders = useProfile((s) => s.reminders);
  const [course, setCourse] = useState('');
  const courseLine = course ? `The student is studying ${course}. Use examples and notation that fit that course.` : '';
  const mode0 = MODES.find((m) => m.id === action) ?? MODES[MODES.length - 1];
  // The next exam or assignment in the next two weeks, to offer a study plan or a quiz for it.
  const [now] = useState(() => Date.now());
  const soon = reminders.filter((r) => !r.done && r.dueAt > now && r.dueAt < now + 14 * 86_400_000).sort((a, b) => a.dueAt - b.dueAt)[0];
  const soonDays = soon ? Math.max(1, Math.round((soon.dueAt - now) / 86_400_000)) : 0;
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const chat = ai.chats.find((c) => c.id === ai.activeChat);
  const mode = chat?.mode ?? ai.chatMode;

  useEffect(() => {
    const el = scroller.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 160) el.scrollTop = el.scrollHeight;
  }, [run.text, chat?.messages.length]);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
    // On phones, focusing would scroll past the mode picker and pop the keyboard up.
    if (window.matchMedia('(min-width: 640px)').matches) inputRef.current?.focus();
  }, [ai.activeChat]);

  const send = async (textArg?: string, forceAction?: string) => {
    if (run.running) return run.stop();
    const text = (textArg ?? input).trim();
    if (!text && !att.files.length) return;
    if (action === 'custom' && !custom.trim()) return toast('Say what you want it to make, like "a one-page formula sheet".', 'error');
    const files = att.files;
    const act = forceAction !== undefined ? actionById(forceAction) : textArg === undefined ? actionById(action) : undefined;
    const customAsk = textArg === undefined && action === 'custom' ? custom.trim() : '';
    const tag = act?.id ?? (customAsk ? 'custom' : undefined);
    const label = act?.label ?? (customAsk ? customAsk.slice(0, 40) : '');
    const st = useAi.getState();
    const active = st.chats.find((c) => c.id === st.activeChat);
    const fresh = (text || (label ? `${label}${files[0] ? `: ${files[0].name}` : ''}` : files[0]?.name) || 'File question').slice(0, 42);
    let current: Chat = active ?? { id: uid(), title: fresh, mode: st.chatMode, messages: [], updatedAt: Date.now() };
    current = { ...current, title: current.title === 'New chat' ? fresh : current.title, messages: [...current.messages, { role: 'user', content: text || (label ? `${label} from the attached file` : '(see attached file)'), files: files.map((f) => f.name), action: tag }], updatedAt: Date.now() };
    ai.upsertChat(current);
    setInput('');
    att.clear();
    setCustom('');
    setPendingId(current.id);
    const history: AiMessage[] = current.messages.slice(-24).map((m, i, all) => ({ role: m.role, content: i === all.length - 1 && files.length ? [...toParts(files), { type: 'text', text: m.content }] : m.content }));
    while (history.length && history[0].role !== 'user') history.shift();
    const reply = await run.run({
      tier: 'main',
      maxTokens: 3000,
      system: current.mode === 'support' ? supportSystem(st) : act || customAsk
        ? tutorSystem(st, `${courseLine} ${act ? act.prompt : `Make exactly what the student asks for from their material: ${customAsk}. Choose a clear structure for it.`} Work from the attached material and message when given; if something important is missing from it, say so briefly.`)
        : tutorSystem(st, `${courseLine} Ask a short check-for-understanding question at the end when it helps learning. If the student asks you to just do graded work for them, still help, but teach the method.`),
      messages: history,
    });
    setPendingId(null);
    const latest = useAi.getState().chats.find((c) => c.id === current.id) ?? current;
    if (reply) {
      // A quiz comes back as JSON; keep it as a playable quiz when it parses.
      let content = reply;
      if (tag === 'quiz') {
        try {
          const list = (parseJSONLoose<QuizQ[] | { questions?: QuizQ[] }>(reply));
          const qs = (Array.isArray(list) ? list : list.questions ?? []).filter((q) => q?.q && Array.isArray(q.options) && q.options.length >= 2).slice(0, 8).map((q) => ({ ...q, answer: Math.max(0, Math.min(q.options.length - 1, Number(q.answer) || 0)) }));
          if (qs.length) content = QUIZ_MARK + JSON.stringify(qs);
        } catch {
          // shown as text instead
        }
      }
      useAi.getState().upsertChat({ ...latest, messages: [...latest.messages, { role: 'assistant', content, action: tag }], updatedAt: Date.now() });
      run.reset();
    } else {
      // Failed or stopped before any text: remove the unanswered message and restore the input.
      useAi.getState().upsertChat({ ...latest, messages: latest.messages.slice(0, -1) });
      setInput(text);
      if (tag) setAction(tag);
      if (customAsk) setCustom(customAsk);
    }
  };

  // /ai/chat?ask=... opens a new chat and sends the question (used by "Go deeper").
  const sendAsk = useEffectEvent((ask: string) => send(ask));
  useEffect(() => {
    const ask = new URLSearchParams(location.search).get('ask');
    if (!ask) return;
    history.replaceState(null, '', '/study?tool=chat');
    useAi.getState().update({ activeChat: '', chatMode: 'tutor' });
    const id = setTimeout(() => sendAsk(ask), 0);
    return () => clearTimeout(id);
  }, []);
  const setMode = (m: Chat['mode']) => {
    if (chat && chat.messages.length && chat.mode !== m) ai.update({ activeChat: '', chatMode: m });
    else if (chat) ai.upsertChat({ ...chat, mode: m });
    else ai.update({ chatMode: m });
  };

  const newChat = () => (ai.update({ activeChat: '' }), run.reset(), inputRef.current?.focus());
  const empty = !chat?.messages.length && pendingId !== chat?.id;

  const composer = (
    <div className="mx-auto w-full max-w-[720px]">
      <FileTray files={att.files} onRemove={att.remove} reading={att.reading} />
      {mode === 'tutor' && !empty && (
        <div className="mb-2">
          <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]" role="radiogroup" aria-label="Study mode">
            {[...MODES, ...(MODES.some((m) => m.id === action) ? [] : ACTIONS.filter((a) => a.id === action).map((a) => ({ id: a.id, label: a.label })))].map((a) => (
              <button key={a.id} type="button" role="radio" aria-checked={action === a.id} onClick={() => (setAction(a.id), inputRef.current?.focus())} className={cn('shrink-0 rounded-md border px-2.5 py-1 text-[12px] font-medium whitespace-nowrap transition-colors', action === a.id ? 'border-ink bg-ink text-bg' : 'border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink')}>{a.label}</button>
            ))}
          </div>
          {action === 'custom' && <input value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={300} aria-label="What to make" placeholder="What should it make? e.g. a formula sheet for chapters 3 and 4 only" className="mt-1.5 h-9 w-full rounded-lg border border-line-strong/60 bg-surface px-3 text-[13px] outline-none focus:border-accent" />}
        </div>
      )}
      <form
        onSubmit={(e) => (e.preventDefault(), send())}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) att.add(e.dataTransfer.files); }}
        className={cn('bg-surface transition-colors', empty ? 'rounded-lg' : 'rounded-2xl border border-line focus-within:border-line-strong')}
      >
        <textarea
          ref={inputRef}
          id="chatInput"
          rows={2}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = `${Math.min(200, e.target.scrollHeight)}px`;
          }}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && (e.preventDefault(), send())}
          onPaste={(e) => {
            const images = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'));
            if (!images.length) return;
            e.preventDefault();
            void att.add(images);
          }}
          placeholder={mode === 'support' ? 'What is on your mind?' : MODES.find((m) => m.id === action)?.placeholder ?? `Attach or paste the material for: ${actionById(action)?.label.toLowerCase()}`}
          aria-label="Message"
          className="block max-h-52 min-h-[52px] w-full resize-none bg-transparent px-4 pt-3 text-[15px] leading-6 outline-none placeholder:text-muted"
        />
        <div className="flex items-center gap-1 px-2 pb-2">
          <button type="button" onClick={() => fileRef.current?.click()} aria-label="Attach a photo or file" title="Attach a photo or file" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-3 hover:text-ink"><Icon name="clip" className="size-[18px]" /></button>
          <input ref={fileRef} type="file" accept="image/*,.pdf,.txt,.md,.docx" multiple hidden onChange={(e) => (e.target.files && att.add(e.target.files), (e.target.value = ''))} />
          {!empty && <span className="relative inline-flex items-center">
            <select aria-label="Mode" value={mode} onChange={(e) => setMode(e.target.value as Chat['mode'])} className="h-8 cursor-pointer appearance-none rounded-lg bg-transparent pr-7 pl-2 text-[13px] font-medium text-ink-2 outline-none hover:bg-surface-3">
              <option value="tutor">Tutor</option>
              <option value="support">Talk it through</option>
            </select>
            <Icon name="down" className="pointer-events-none absolute right-2 size-3.5 text-muted" />
          </span>}
          <button type="submit" id="chatSend" aria-label={run.running ? 'Stop' : 'Send'} disabled={!run.running && !input.trim() && !att.files.length} className="ml-auto grid size-8 place-items-center rounded-full bg-ink text-bg transition-opacity hover:opacity-85 disabled:opacity-25">
            <Icon name={run.running ? 'stop' : 'up'} className="size-4" />
          </button>
        </div>
      </form>
      {!compact && <p className="mt-2 text-center text-[11px] text-muted">The tutor can be wrong. Check important answers against your course material.</p>}
    </div>
  );

  const thread = (
    <div ref={scroller} id="chatMessages" className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
      <div className={cn('mx-auto flex w-full max-w-[720px] flex-col gap-6', compact ? 'px-3 py-4' : 'px-5 py-8')}>
        {chat?.messages.map((m, i) => (
          m.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-accent-fill px-4 py-2.5 text-[15px] leading-6 whitespace-pre-wrap text-white">
                {m.action && <span className="mb-1 block text-[12px] font-medium text-white/75">{actionById(m.action)?.label ?? 'Custom'}</span>}
                {m.content}
                {m.files?.length ? <small className="mt-1 block text-[12px] text-white/75">Attached: {m.files.join(', ')}</small> : null}
              </div>
            </div>
          ) : (
            <div key={i} className="min-w-0">
              <p className="mb-2 flex items-center gap-2 text-[13px] font-semibold"><Logo className="size-6 rounded-md" /> Brainwick tutor{m.action && actionById(m.action) ? <span className="font-normal text-muted">{actionById(m.action)!.label}</span> : null}</p>
              {readQuiz(m.content) ? (
                <QuizBlock quiz={readQuiz(m.content)!} title={chat.title} onAgain={() => send(`Another quiz on the same topic: ${chat.title}. Different questions.`, 'quiz')} />
              ) : (
                <>
                  <Markdown>{m.content}</Markdown>
                  {mode === 'tutor' && <ResultBar content={m.content} title={chat.title} kind={m.action ?? ''} />}
                  {/* Study follow-ups on the latest answer. */}
                  {mode === 'tutor' && i === chat.messages.length - 1 && !pendingId && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <button type="button" onClick={() => send('Quiz me on what you just explained.', 'quiz')} className="rounded-md border border-line px-2.5 py-1 text-[12px] font-medium text-ink-2 hover:border-ink hover:text-ink">Quiz me on this</button>
                      <button type="button" onClick={() => send('Explain that more simply, with an everyday example.')} className="rounded-md border border-line px-2.5 py-1 text-[12px] font-medium text-ink-2 hover:border-ink hover:text-ink">Explain simpler</button>
                      <button type="button" onClick={() => send('Give me a harder practice problem on this. Do not show the answer until I try.')} className="rounded-md border border-line px-2.5 py-1 text-[12px] font-medium text-ink-2 hover:border-ink hover:text-ink">Harder problem</button>
                    </div>
                  )}
                </>
              )}
            </div>
          )
        ))}
        {pendingId && pendingId === chat?.id && (
          <div className="min-w-0"><p className="mb-2 flex items-center gap-2 text-[13px] font-semibold"><Logo className="size-6 rounded-md" /> Brainwick tutor</p>{run.text ? <Markdown streaming>{run.text}</Markdown> : <Thinking label="Working it out" />}</div>
        )}
        {run.error && <AiErrorBox error={run.error} />}
      </div>
    </div>
  );

  const starters = mode === 'support' ? SUPPORT_STARTERS : mode0.starters;
  const due = useLearning((st) => st.sets.reduce((n, set) => n + set.cards.filter((c) => isDue(c)).length, 0));
  const welcome = (
    <div className={cn('flex min-h-0 flex-1 flex-col overflow-y-auto', compact ? 'px-3 py-4' : 'px-5 py-6 sm:py-8')}>
      <div className="mx-auto w-full max-w-[760px]">
        {/* The study desk: pick a class and a way to study, then type below. */}
        <section className="rounded-t-[12px] bg-accent-fill px-5 pt-5 pb-6 text-white max-sm:px-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[13px] font-medium text-white/80"><Logo className="size-5 rounded" /> Brainwick tutor</p>
              <h2 className={cn('mt-1 font-sans font-semibold tracking-tight', compact ? 'text-[20px] leading-7' : 'text-[28px] leading-9')}>
                {mode === 'support' ? 'How are you doing?' : course ? `What are we studying in ${course}?` : 'What are we studying today?'}
              </h2>
            </div>
            <div className="flex overflow-hidden rounded-md border border-white/30 text-[12px] font-medium" role="radiogroup" aria-label="Kind of help">
              {(['tutor', 'support'] as const).map((m) => (
                <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={cn('px-2.5 py-1.5', mode === m ? 'bg-white text-[#14301f]' : 'text-white/85 hover:bg-white/10')}>{m === 'tutor' ? 'Study' : 'Talk it through'}</button>
              ))}
            </div>
          </div>
          {mode === 'support' ? (
            <p className="mt-2 text-[14px] text-white/80">Talk through stress or motivation. This is not a replacement for a counselor.</p>
          ) : (
            <>
              {courses.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Class">
                  {['', ...courses].map((c) => (
                    <button key={c || 'any'} type="button" role="radio" aria-checked={course === c} onClick={() => setCourse(c)} className={cn('rounded-md border px-2.5 py-1 text-[13px] font-medium transition-colors', course === c ? 'border-white bg-white text-[#14301f]' : 'border-white/35 text-white hover:bg-white/10')}>{c || 'Any class'}</button>
                  ))}
                </div>
              )}
              <div className={cn('mt-4 grid gap-2', compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3')} role="radiogroup" aria-label="How to study">
                {MODES.map((m) => (
                  <button key={m.id} type="button" role="radio" aria-checked={action === m.id} onClick={() => (setAction(m.id), inputRef.current?.focus())} className={cn('rounded-lg px-3 py-2.5 text-left transition-colors', action === m.id ? 'bg-white text-[#14301f]' : 'bg-white/10 text-white hover:bg-white/15')}>
                    <span className="block text-[14px] font-semibold">{m.label}</span>
                    {!compact && <span className={cn('mt-0.5 line-clamp-2 block text-[12px] leading-4 max-sm:hidden', action === m.id ? 'text-[#14301f]/70' : 'text-white/70')}>{m.note}</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </section>
        <div className="-mt-2 rounded-b-[12px] border border-t-0 border-line bg-surface p-3 max-sm:p-2">{composer}</div>

        {mode === 'tutor' && (soon || due > 0) && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {soon && (
              <div className="panel p-3.5">
                <p className="text-[13px] text-muted">Coming up in {soonDays} {soonDays === 1 ? 'day' : 'days'}</p>
                <p className="truncate text-[15px] font-semibold">{soon.title}</p>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => send(`Make me a day-by-day study plan for ${soon.title}, which is due ${new Date(soon.dueAt).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}.`)}>Plan for it</Button>
                  <Button size="sm" variant="secondary" onClick={() => send(`Quiz me on what is likely to be on ${soon.title}.`, 'quiz')}>Quiz me</Button>
                </div>
              </div>
            )}
            {due > 0 && (
              <div className="panel p-3.5">
                <p className="text-[13px] text-muted">Flashcards</p>
                <p className="text-[15px] font-semibold"><span className="tnum">{due}</span> {due === 1 ? 'card is' : 'cards are'} due for review</p>
                <Link href="/study?tool=practice"><Button size="sm" variant="secondary" className="mt-2">Review now</Button></Link>
              </div>
            )}
          </div>
        )}
        {starters.length > 0 && (
          <div className="mt-5">
            <p className="mb-1 text-[13px] font-semibold text-muted">Try one</p>
            <ul className="divide-y divide-line border-t border-line">
              {starters.map((st) => (
                <li key={st}>
                  <button type="button" onClick={() => send(st, mode === 'tutor' ? action : undefined)} className="w-full py-2.5 text-left text-[14px] text-ink-2 hover:text-ink">{st}</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );

  if (compact)
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center gap-2 border-b border-line px-3 py-2">
          <select aria-label="Chats" value={ai.activeChat} onChange={(e) => ai.update({ activeChat: e.target.value })} className="well h-8 min-w-0 flex-1 px-2 text-[13px] text-ink">
            <option value="">New chat</option>
            {ai.chats.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <Button size="sm" variant="ghost" aria-label="New chat" onClick={newChat}><Icon name="plus" className="size-4" /></Button>
          {onHide && <Button size="sm" variant="ghost" aria-label="Hide tutor" title="Hide tutor" onClick={onHide}><Icon name="panel" className="size-4" /></Button>}
        </div>
        {empty ? welcome : <>{thread}<div className="border-t border-line p-3">{composer}</div></>}
      </div>
    );

  return (
    <div className="grid h-full min-h-0 lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col border-line bg-surface-2 max-lg:hidden lg:border-r">
        <div className="p-3">
          <Button block variant="secondary" onClick={newChat} className="justify-start">New chat</Button>
        </div>
        <p className="px-4 pb-1 text-[12px] font-medium text-muted">Recent</p>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3" id="chatList">
          {ai.chats.length ? ai.chats.map((c) => (
            <div key={c.id} className={cn('group flex items-center rounded-lg', c.id === ai.activeChat ? 'bg-surface-3' : 'hover:bg-surface-3/70')}>
              <button type="button" onClick={() => ai.update({ activeChat: c.id })} className="min-w-0 flex-1 px-2.5 py-1.5 text-left">
                <span className={cn('block truncate text-[13px]', c.id === ai.activeChat ? 'font-medium text-ink' : 'text-ink-2')}>{c.title}</span>
                <span className="block text-[11px] text-muted">{c.mode === 'support' ? 'Talk it through' : 'Tutor'}, {shortDate(c.updatedAt)}</span>
              </button>
              <button type="button" aria-label="Delete chat" onClick={async () => await askConfirm('Delete this chat?') && ai.deleteChat(c.id)} className="mr-1 grid size-7 place-items-center rounded-md text-muted opacity-0 group-hover:opacity-100 hover:text-ink focus:opacity-100"><Icon name="close" className="size-3.5" /></button>
            </div>
          )) : <p className="px-2.5 text-[13px] text-muted">Your chats show up here.</p>}
        </div>
      </aside>
      <div className="flex min-h-0 flex-col">
        <div className="flex items-center gap-2 border-b border-line px-3 py-2 lg:hidden">
          <select aria-label="Chats" value={ai.activeChat} onChange={(e) => ai.update({ activeChat: e.target.value })} className="well h-8 min-w-0 flex-1 px-2 text-[13px] text-ink">
            <option value="">New chat</option>
            {ai.chats.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <Button size="sm" variant="ghost" aria-label="New chat" onClick={newChat}><Icon name="plus" className="size-4" /></Button>
          {onHide && <Button size="sm" variant="ghost" aria-label="Hide tutor" title="Hide tutor" onClick={onHide}><Icon name="panel" className="size-4" /></Button>}
        </div>
        {empty ? welcome : <>{thread}<div className="px-5 pb-4">{composer}</div></>}
      </div>
    </div>
  );
}
