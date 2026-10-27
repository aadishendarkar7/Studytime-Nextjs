'use client';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { FileTray, useAttachments } from '@/components/ui/attachments';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { Markdown } from '@/components/ui/markdown';
import { Segmented } from '@/components/ui/segmented';
import { Thinking } from '@/components/ui/progress';
import { toParts } from '@/lib/ai/files';
import { supportSystem, tutorSystem } from '@/lib/ai/prompts';
import type { AiMessage } from '@/lib/ai/providers';
import { useAi, type Chat } from '@/lib/stores/ai';
import { cn, shortDate, uid } from '@/lib/utils';
import { useAiRun } from './use-ai-run';
import { AiErrorBox } from './ui';

const STARTERS = {
  tutor: ['Explain this like I’m new to it: ', 'Quiz me on ', 'Make me a 3-day study plan for my exam on ', 'What’s the difference between '],
  support: ['I’m stressed about my exam', 'I keep procrastinating', 'I feel behind in my classes', 'I can’t focus today'],
};

export function ChatTool() {
  const ai = useAi();
  const run = useAiRun();
  const att = useAttachments(5);
  const [input, setInput] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
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
    const files = att.files;
    const st = useAi.getState();
    const active = st.chats.find((c) => c.id === st.activeChat);
    let current: Chat = active ?? { id: uid(), title: text.slice(0, 42) || 'File question', mode: st.chatMode, messages: [], updatedAt: Date.now() };
    current = { ...current, title: current.title === 'New chat' ? text.slice(0, 42) : current.title, messages: [...current.messages, { role: 'user', content: text || '(see attached file)', files: files.map((f) => f.name) }], updatedAt: Date.now() };
    ai.upsertChat(current);
    setInput('');
    att.clear();
    setPendingId(current.id);
    const history: AiMessage[] = current.messages.slice(-24).map((m, i, all) => ({ role: m.role, content: i === all.length - 1 && files.length ? [...toParts(files), { type: 'text', text: m.content }] : m.content }));
    while (history.length && history[0].role !== 'user') history.shift();
    const reply = await run.run({
      tier: 'main',
      maxTokens: 3000,
      system: current.mode === 'support' ? supportSystem(st) : tutorSystem(st, 'Ask a short check-for-understanding question at the end when it helps learning. If the student asks you to just do graded work for them, still help, but teach the method.'),
      messages: history,
    });
    setPendingId(null);
    const latest = useAi.getState().chats.find((c) => c.id === current.id) ?? current;
    if (reply) {
      useAi.getState().upsertChat({ ...latest, messages: [...latest.messages, { role: 'assistant', content: reply }], updatedAt: Date.now() });
      run.reset();
    } else {
      // Failed or stopped before any text: remove the unanswered message and restore the input.
      useAi.getState().upsertChat({ ...latest, messages: latest.messages.slice(0, -1) });
      setInput(text);
    }
  };

  // /ai/chat?ask=... opens a new chat and sends the question (used by "Go deeper").
  const sendAsk = useEffectEvent((ask: string) => send(ask));
  useEffect(() => {
    const ask = new URLSearchParams(location.search).get('ask');
    if (!ask) return;
    history.replaceState(null, '', '/ai/chat');
    useAi.getState().update({ activeChat: '', chatMode: 'tutor' });
    const id = setTimeout(() => sendAsk(ask), 0);
    return () => clearTimeout(id);
  }, []);
  const setMode = (m: Chat['mode']) => {
    if (chat && chat.messages.length && chat.mode !== m) ai.update({ activeChat: '', chatMode: m });
    else if (chat) ai.upsertChat({ ...chat, mode: m });
    else ai.update({ chatMode: m });
  };

  return (
    <div className="grid min-h-[560px] overflow-hidden border border-line bg-surface lg:h-[min(76vh,800px)] lg:grid-cols-[260px_minmax(0,1fr)] rounded-xl">
      <aside className="flex min-h-0 flex-col gap-3 border-line p-4 max-lg:border-b lg:border-r">
        <Button block onClick={() => (ai.update({ activeChat: '' }), run.reset(), inputRef.current?.focus())}><Icon name="plus" className="size-4" /> New chat</Button>
        <Segmented className="[&>button]:flex-1" value={mode} onChange={setMode} label="Chat mode" wrap={false} options={[{ value: 'tutor', label: 'Tutor' }, { value: 'support', label: 'Talk it through' }]} />
        <div className="-mx-2 min-h-0 flex-1 overflow-y-auto max-lg:max-h-40" id="chatList">
          {ai.chats.length ? ai.chats.map((c) => (
            <div key={c.id} className={cn('group flex items-center border-l-2', c.id === ai.activeChat ? 'border-accent bg-surface-3' : 'border-transparent hover:bg-surface-3')}>
              <button type="button" onClick={() => ai.update({ activeChat: c.id })} className="min-w-0 flex-1 px-2.5 py-2 text-left">
                <strong className="block truncate text-[13px]">{c.title}</strong>
                <small className="text-[12px] text-muted">{c.mode === 'support' ? 'Talk it through' : 'Tutor'} · {shortDate(c.updatedAt)}</small>
              </button>
              <button type="button" aria-label="Delete chat" onClick={() => confirm('Delete this chat?') && ai.deleteChat(c.id)} className="px-2 text-muted opacity-0 group-hover:opacity-100 focus:opacity-100"><Icon name="close" className="size-4" /></button>
            </div>
          )) : <p className="px-2 text-[13px] text-muted">No chats yet.</p>}
        </div>
      </aside>
      <div className="flex min-h-0 flex-col p-4 sm:px-6">
        <div ref={scroller} id="chatMessages" className="flex min-h-80 flex-1 flex-col gap-4 overflow-y-auto py-2 max-lg:max-h-[60vh]" aria-live="polite">
          {!chat?.messages.length && pendingId !== chat?.id ? (
            <div className="m-auto max-w-md p-4">
                            <h3 className="text-xl font-semibold">{mode === 'support' ? 'Talk it through' : 'Ask the tutor'}</h3>
              <p className="mt-2 text-sm text-muted">{mode === 'support' ? 'Use this to talk through stress or motivation. It is not a replacement for a counselor.' : 'Ask about any subject, attach a photo or PDF, or ask for a quiz or a study plan.'}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {STARTERS[mode].map((s) => (
                  <button key={s} type="button" className="min-h-11 border border-line bg-surface px-3 text-left text-[13px] font-medium text-ink hover:bg-surface-3 rounded-xl" onClick={() => (s.endsWith(' ') ? (setInput(s), inputRef.current?.focus()) : send(s))}>
                    {s.trim().replace(/:$/, '…')}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            chat?.messages.map((m, i) => (
              <div key={i} className={cn('flex', m.role === 'user' && 'justify-end')}>
                {m.role === 'user' ? (
                  <div className="max-w-[88%] bg-ink px-4 py-2.5 text-[14px] leading-6 whitespace-pre-wrap text-bg">
                    {m.content}
                    {m.files?.length ? <small className="mt-1 block text-xs opacity-80">Attached: {m.files.join(', ')}</small> : null}
                  </div>
                ) : (
                  <div className="max-w-[92%] border border-line bg-surface px-4 py-3 rounded-xl"><Markdown>{m.content}</Markdown></div>
                )}
              </div>
            ))
          )}
          {pendingId && pendingId === chat?.id && (
            <div className="flex"><div className="max-w-[92%] border border-line bg-surface px-4 py-3 rounded-xl">{run.text ? <Markdown streaming>{run.text}</Markdown> : <Thinking label="Thinking…" />}</div></div>
          )}
          {run.error && <AiErrorBox error={run.error} />}
        </div>
        <FileTray files={att.files} onRemove={att.remove} reading={att.reading} />
        <form className="mt-2 flex items-end gap-2 border border-line bg-surface p-2 focus-within:border-accent rounded-xl" onSubmit={(e) => (e.preventDefault(), send())}>
          <Button type="button" size="icon" variant="secondary" aria-label="Attach an image or file" onClick={() => fileRef.current?.click()}><Icon name="plus" /></Button>
          <input ref={fileRef} type="file" accept="image/*,.pdf,.txt,.md,.docx" multiple hidden onChange={(e) => (e.target.files && att.add(e.target.files), (e.target.value = ''))} />
          <textarea
            ref={inputRef}
            id="chatInput"
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(180, e.target.scrollHeight)}px`;
            }}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
            placeholder={mode === 'support' ? 'Say what is on your mind' : 'Ask anything: math, science, essays, exam prep'}
            aria-label="Message"
            className="max-h-44 min-h-10 flex-1 resize-none bg-transparent px-1.5 py-2 text-[14px] outline-none"
          />
          <Button type="submit" id="chatSend">{run.running ? 'Stop' : <>Send <Icon name="send" className="size-4" /></>}</Button>
        </form>
      </div>
    </div>
  );
}
