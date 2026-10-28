'use client';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { FileTray, useAttachments } from '@/components/ui/attachments';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { Markdown } from '@/components/ui/markdown';
import { Thinking } from '@/components/ui/progress';
import { toParts } from '@/lib/ai/files';
import { supportSystem, tutorSystem } from '@/lib/ai/prompts';
import type { AiMessage } from '@/lib/ai/providers';
import { useAi, type Chat } from '@/lib/stores/ai';
import { useLearning } from '@/lib/stores/learning';
import { toast, useUi } from '@/lib/stores/ui';
import { cn, copyText, shortDate, uid } from '@/lib/utils';
import { ACTIONS, actionById } from './actions';
import { generateCards } from './tasks';
import { useAiRun } from './use-ai-run';
import { AiErrorBox } from './ui';

/** The actions shown before "More". */
const PRIMARY = ['', 'answer', 'solve', 'cheatsheet', 'summary', 'guide', 'practice'];

const STARTERS = {
  tutor: ['Explain this like I’m new to it: ', 'Quiz me on ', 'Make me a study plan for my midterm on ', 'What’s the difference between '],
  support: ['I’m stressed about my exam', 'I keep procrastinating', 'I feel behind in my classes', 'I can’t focus today'],
};

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
export function ChatTool({ compact = false, initialAction = '' }: { compact?: boolean; initialAction?: string } = {}) {
  const ai = useAi();
  const run = useAiRun();
  const att = useAttachments(5);
  const [input, setInput] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [action, setAction] = useState(initialAction);
  const [custom, setCustom] = useState('');
  const [more, setMore] = useState(false);
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
    inputRef.current?.focus();
  }, [ai.activeChat]);

  const send = async (textArg?: string) => {
    if (run.running) return run.stop();
    const text = (textArg ?? input).trim();
    if (!text && !att.files.length) return;
    if (action === 'custom' && !custom.trim()) return toast('Say what you want it to make, like "a one-page formula sheet".', 'error');
    const files = att.files;
    const act = textArg === undefined ? actionById(action) : undefined;
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
    setAction('');
    setCustom('');
    setPendingId(current.id);
    const history: AiMessage[] = current.messages.slice(-24).map((m, i, all) => ({ role: m.role, content: i === all.length - 1 && files.length ? [...toParts(files), { type: 'text', text: m.content }] : m.content }));
    while (history.length && history[0].role !== 'user') history.shift();
    const reply = await run.run({
      tier: 'main',
      maxTokens: 3000,
      system: current.mode === 'support' ? supportSystem(st) : act || customAsk
        ? tutorSystem(st, `${act ? act.prompt : `Make exactly what the student asks for from their material: ${customAsk}. Choose a clear structure for it.`} Work from the attached material and message when given; if something important is missing from it, say so briefly.`)
        : tutorSystem(st, 'Ask a short check-for-understanding question at the end when it helps learning. If the student asks you to just do graded work for them, still help, but teach the method.'),
      messages: history,
    });
    setPendingId(null);
    const latest = useAi.getState().chats.find((c) => c.id === current.id) ?? current;
    if (reply) {
      useAi.getState().upsertChat({ ...latest, messages: [...latest.messages, { role: 'assistant', content: reply, action: tag }], updatedAt: Date.now() });
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
      {mode === 'tutor' && (
        <div className="mb-2">
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="What should the tutor do">
            {[{ id: '', label: 'Ask' }, ...ACTIONS, { id: 'custom', label: 'Custom' }].filter((a) => more || PRIMARY.includes(a.id) || a.id === action).map((a) => (
              <button key={a.id} type="button" role="radio" aria-checked={action === a.id} onClick={() => (setAction(a.id), inputRef.current?.focus())} className={cn('shrink-0 rounded-lg border px-2.5 py-1 text-[12px] font-medium whitespace-nowrap transition-colors', action === a.id ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink')}>{a.label}</button>
            ))}
            <button type="button" onClick={() => setMore(!more)} aria-expanded={more} className="shrink-0 rounded-lg px-2 py-1 text-[12px] font-medium text-muted hover:text-ink">{more ? 'Fewer' : `More (${ACTIONS.length + 2 - PRIMARY.length})`}</button>
          </div>
          {action === 'custom' && <input value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={300} aria-label="What to make" placeholder="What should it make? e.g. a formula sheet for chapters 3 and 4 only" className="mt-1.5 h-9 w-full rounded-lg border border-line-strong/60 bg-surface px-3 text-[13px] outline-none focus:border-accent" />}
        </div>
      )}
      <form
        onSubmit={(e) => (e.preventDefault(), send())}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) att.add(e.dataTransfer.files); }}
        className="rounded-2xl border border-line bg-surface shadow-sm transition-colors focus-within:border-line-strong"
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
          placeholder={mode === 'support' ? 'What is on your mind?' : action === '' ? 'Ask a question, paste a problem, or attach a PDF or photo' : `Attach or paste the material${action === 'custom' ? '' : ` for: ${actionById(action)?.label.toLowerCase()}`}. Add any instructions here.`}
          aria-label="Message"
          className="block max-h-52 min-h-[52px] w-full resize-none bg-transparent px-4 pt-3 text-[15px] leading-6 outline-none placeholder:text-muted"
        />
        <div className="flex items-center gap-1 px-2 pb-2">
          <button type="button" onClick={() => fileRef.current?.click()} aria-label="Attach a photo or file" title="Attach a photo or file" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-3 hover:text-ink"><Icon name="clip" className="size-[18px]" /></button>
          <input ref={fileRef} type="file" accept="image/*,.pdf,.txt,.md,.docx" multiple hidden onChange={(e) => (e.target.files && att.add(e.target.files), (e.target.value = ''))} />
          <span className="relative inline-flex items-center">
            <select aria-label="Mode" value={mode} onChange={(e) => setMode(e.target.value as Chat['mode'])} className="h-8 cursor-pointer appearance-none rounded-lg bg-transparent pr-7 pl-2 text-[13px] font-medium text-ink-2 outline-none hover:bg-surface-3">
              <option value="tutor">Tutor</option>
              <option value="support">Talk it through</option>
            </select>
            <Icon name="down" className="pointer-events-none absolute right-2 size-3.5 text-muted" />
          </span>
          <button type="submit" id="chatSend" aria-label={run.running ? 'Stop' : 'Send'} disabled={!run.running && !input.trim() && !att.files.length} className="ml-auto grid size-8 place-items-center rounded-full bg-accent-fill text-white transition-opacity hover:opacity-85 disabled:opacity-25">
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
              <div className="max-w-[85%] rounded-2xl bg-surface-3 px-4 py-2.5 text-[15px] leading-6 whitespace-pre-wrap text-ink">
                {m.action && <span className="mb-1 block text-[11px] font-semibold tracking-wide text-accent-ink uppercase">{actionById(m.action)?.label ?? 'Custom'}</span>}
                {m.content}
                {m.files?.length ? <small className="mt-1 block text-[12px] text-muted">Attached: {m.files.join(', ')}</small> : null}
              </div>
            </div>
          ) : (
            <div key={i} className="min-w-0"><Markdown>{m.content}</Markdown>{mode === 'tutor' && (m.action || m.content.length > 600) && <ResultBar content={m.content} title={chat.title} kind={m.action ?? ''} />}</div>
          )
        ))}
        {pendingId && pendingId === chat?.id && (
          <div className="min-w-0">{run.text ? <Markdown streaming>{run.text}</Markdown> : <Thinking label="Thinking" />}</div>
        )}
        {run.error && <AiErrorBox error={run.error} />}
      </div>
    </div>
  );

  const welcome = (
    <div className={cn('flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto', compact ? 'px-3 py-6' : 'px-5 py-10')}>
      <h2 className={cn('text-center font-sans font-semibold tracking-tight', compact ? 'text-[17px]' : 'text-[24px] leading-8')}>{mode === 'support' ? 'How are you doing?' : 'What are you studying?'}</h2>
      {!compact && <p className="mt-1 text-center text-[14px] text-muted">{mode === 'support' ? 'Talk through stress or motivation. This is not a replacement for a counselor.' : 'Ask anything, or attach lecture slides, a PDF or a photo and pick what to make from it.'}</p>}
      <div className="mt-6 w-full">{composer}</div>
      <div className={cn('mx-auto mt-4 grid w-full max-w-[720px] gap-2', !compact && 'sm:grid-cols-2')}>
        {STARTERS[mode].map((st) => (
          <button key={st} type="button" onClick={() => (st.endsWith(' ') ? (setInput(st), inputRef.current?.focus()) : send(st))} className="rounded-xl border border-line px-3.5 py-2.5 text-left text-[13px] text-ink-2 hover:bg-surface-2 hover:text-ink">
            {st.trim().replace(/:$/, '')}
          </button>
        ))}
      </div>
    </div>
  );

  if (compact)
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center gap-2 border-b border-line px-3 py-2">
          <select aria-label="Chats" value={ai.activeChat} onChange={(e) => ai.update({ activeChat: e.target.value })} className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 text-[13px]">
            <option value="">New chat</option>
            {ai.chats.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <Button size="sm" variant="ghost" aria-label="New chat" onClick={newChat}><Icon name="plus" className="size-4" /></Button>
        </div>
        {empty ? welcome : <>{thread}<div className="border-t border-line p-3">{composer}</div></>}
      </div>
    );

  return (
    <div className="grid h-full min-h-0 lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col border-line bg-surface-2 max-lg:hidden lg:border-r">
        <div className="p-3">
          <Button block variant="secondary" onClick={newChat} className="justify-start"><Icon name="plus" className="size-4" /> New chat</Button>
        </div>
        <p className="px-4 pb-1 text-[12px] font-medium text-muted">Recent</p>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3" id="chatList">
          {ai.chats.length ? ai.chats.map((c) => (
            <div key={c.id} className={cn('group flex items-center rounded-lg', c.id === ai.activeChat ? 'bg-surface-3' : 'hover:bg-surface-3/70')}>
              <button type="button" onClick={() => ai.update({ activeChat: c.id })} className="min-w-0 flex-1 px-2.5 py-1.5 text-left">
                <span className={cn('block truncate text-[13px]', c.id === ai.activeChat ? 'font-medium text-ink' : 'text-ink-2')}>{c.title}</span>
                <span className="block text-[11px] text-muted">{c.mode === 'support' ? 'Talk it through' : 'Tutor'} · {shortDate(c.updatedAt)}</span>
              </button>
              <button type="button" aria-label="Delete chat" onClick={() => confirm('Delete this chat?') && ai.deleteChat(c.id)} className="mr-1 grid size-7 place-items-center rounded-md text-muted opacity-0 group-hover:opacity-100 hover:text-ink focus:opacity-100"><Icon name="close" className="size-3.5" /></button>
            </div>
          )) : <p className="px-2.5 text-[13px] text-muted">Your chats show up here.</p>}
        </div>
      </aside>
      <div className="flex min-h-0 flex-col">
        <div className="flex items-center gap-2 border-b border-line px-3 py-2 lg:hidden">
          <select aria-label="Chats" value={ai.activeChat} onChange={(e) => ai.update({ activeChat: e.target.value })} className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 text-[13px]">
            <option value="">New chat</option>
            {ai.chats.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <Button size="sm" variant="ghost" aria-label="New chat" onClick={newChat}><Icon name="plus" className="size-4" /></Button>
        </div>
        {empty ? welcome : <>{thread}<div className="px-5 pb-4">{composer}</div></>}
      </div>
    </div>
  );
}
