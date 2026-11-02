'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useAttachments } from '@/components/ui/attachments';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/field';
import { Hero, HeroButton, HeroGhost } from '@/components/ui/hero';
import { Icon, type IconName } from '@/components/ui/icons';
import { Markdown } from '@/components/ui/markdown';
import { Thinking } from '@/components/ui/progress';
import { toParts } from '@/lib/ai/files';
import { NOTE_PROMPTS, tutorSystem } from '@/lib/ai/prompts';
import type { Lecture } from '@/lib/media-db';
import { useAi, type Note, type NoteKind } from '@/lib/stores/ai';
import { useLearning } from '@/lib/stores/learning';
import { toast, useUi } from '@/lib/stores/ui';
import { cn, copyText, shortDate } from '@/lib/utils';
import { generateCards, nameNote } from './tasks';
import { Composer, InlineSelect } from './composer';
import { clock } from './lecture-player';
import { ActionTile, listLectures, Recorder, RecordingRow } from './lectures';
import { AiErrorBox, AiOutput } from './ui';
import { useAiRun } from './use-ai-run';
import { askConfirm, askText } from '@/lib/stores/ask';

type MakeKind = 'notes' | 'cheatsheet' | 'summary' | 'flashcards' | 'quiz';
const KIND_LABEL: Record<NoteKind, string> = { notes: 'Notes', cheatsheet: 'Cheatsheet', summary: 'Summary', quiz: 'Practice test', guide: 'Study guide', solution: 'Solution', writing: 'Writing feedback' };
/** One color per kind of note, so a page of cards reads at a glance. */
const KIND_TONE: Record<NoteKind, string> = { notes: '#2f6b4f', cheatsheet: '#6b3f6e', summary: '#2f5b8a', quiz: '#9a4a2a', guide: '#1f6a6a', solution: '#4a4f8a', writing: '#7a5a1f' };

/** Markdown down to readable words, for previews, search and word counts. */
const plain = (md: string) => md.replace(/```[\s\S]*?```/g, ' ').replace(/\$\$[\s\S]*?\$\$/g, ' ').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[#>*_`|~-]+/g, ' ').replace(/\s+/g, ' ').trim();
const wordCount = (md: string) => (plain(md).match(/\S+/g) ?? []).length;
const readTime = (words: number) => `${Math.max(1, Math.round(words / 220))} min read`;
/** Headings in the order Markdown renders them, for the outline. */
function headingsOf(md: string) {
  const out: { level: number; text: string }[] = [];
  let code = false;
  for (const line of md.split('\n')) {
    if (line.trimStart().startsWith('```')) code = !code;
    const m = !code && /^(#{1,3})\s+(.+)$/.exec(line.trim());
    if (m) out.push({ level: m[1].length, text: m[2].replace(/[*_`$]/g, '').trim() });
  }
  return out;
}
const TRANSCRIPT = /: transcript$/;

type Make = 'summary' | 'quiz' | 'cheatsheet';
const MAKE_NAME: Record<Make, string> = { summary: 'summary', quiz: 'practice test', cheatsheet: 'cheatsheet' };

/** One note, set up for studying: an outline, study actions, a self-test mode and editing. */
function NoteView({ note, onOpen, onBack, then }: { note: Note; onOpen: (id: string, then?: 'quiz') => void; onBack: () => void; then?: 'quiz' | null }) {
  const ai = useAi();
  const run = useAiRun();
  const [mode, setMode] = useState<'ask' | Make | null>(null);
  const [question, setQuestion] = useState('');
  const [cardsBusy, setCardsBusy] = useState(false);
  const [more, setMore] = useState(false);
  const [naming, setNaming] = useState(false);
  const [titling, setTitling] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.content);
  const [recall, setRecall] = useState(false);
  const [active, setActive] = useState(0);
  const body = useRef<HTMLDivElement>(null);
  const heads = useMemo(() => headingsOf(note.content), [note.content]);
  const words = useMemo(() => wordCount(note.content), [note.content]);
  const material = `Title: ${note.title}\n\n${note.content.slice(0, 150_000)}`;
  const base = note.title.replace(/: (notes|summary|practice test|cheatsheet)$/i, '');

  const aiName = async () => {
    setMore(false);
    setNaming(true);
    try {
      const t = await nameNote(note.content);
      if (t) {
        ai.updateNote(note.id, { title: t });
        toast(`Renamed to “${t}”.`);
      }
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setNaming(false);
    }
  };
  const make = async (kind: Make) => {
    setMode(kind);
    const content = await run.run({ tier: 'main', maxTokens: 5000, system: tutorSystem(ai), messages: [{ role: 'user', content: `${NOTE_PROMPTS[kind]}\n\n${material}` }] });
    if (content) {
      const saved = ai.saveNote({ title: `${base}: ${MAKE_NAME[kind]}`, folder: note.folder, kind, content });
      run.reset();
      setMode(null);
      onOpen(saved.id);
    }
  };
  const ask = async () => {
    if (!question.trim()) return;
    await run.run({ tier: 'main', maxTokens: 2500, system: `${tutorSystem(ai)}\nAnswer using the student's notes below. If the notes do not cover it, say so, then answer from general knowledge.`, messages: [{ role: 'user', content: `${material}\n\nQuestion: ${question.trim()}` }] });
  };
  const cards = async () => {
    setCardsBusy(true);
    try {
      const set = useLearning.getState().addSet(base, await generateCards(note.content, 20), note.folder);
      toast(`${set.cards.length} flashcards made.`);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setCardsBusy(false);
    }
  };
  const saveEdit = () => {
    ai.updateNote(note.id, { content: draft, updatedAt: Date.now() });
    setEditing(false);
    toast('Saved.');
  };
  const reveal = (show: boolean) => body.current?.querySelectorAll('strong').forEach((s) => s.classList.toggle('shown', show));

  // Coming from a lecture's "Quiz me": start the practice test straight away.
  useEffect(() => {
    if (then !== 'quiz') return;
    const t = setTimeout(() => void make('quiz'), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when the note opens
  }, []);

  // Highlight the section you are reading in the outline.
  useEffect(() => {
    const el = body.current;
    if (!el || editing) return;
    const hs = [...el.querySelectorAll('h1, h2, h3')];
    const io = new IntersectionObserver((entries) => {
      const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (top) setActive(hs.indexOf(top.target));
    }, { rootMargin: '0px 0px -70% 0px' });
    hs.forEach((h) => io.observe(h));
    return () => io.disconnect();
  }, [note.content, editing]);

  const jump = (i: number) => body.current?.querySelectorAll('h1, h2, h3')[i]?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="@container">
    <article className="grid grid-cols-[minmax(0,1fr)] gap-8 @2xl:grid-cols-[minmax(0,1fr)_190px]">
      <div className="min-w-0 @container">
        <button type="button" onClick={onBack} className="mb-4 flex items-center gap-1 text-[13px] font-medium text-muted hover:text-ink"><Icon name="chevron" className="size-3.5 rotate-180" /> All notes</button>

        <p className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: KIND_TONE[note.kind] }}><span className="size-2 rounded-full" style={{ background: KIND_TONE[note.kind] }} />{KIND_LABEL[note.kind]}</p>
        <div className="mt-1 flex items-start gap-2">
          {titling ? (
            <input autoFocus defaultValue={note.title} maxLength={80} aria-label="Note title" onBlur={(e) => (e.target.value.trim() && ai.updateNote(note.id, { title: e.target.value.trim().slice(0, 80) }), setTitling(false))} onKeyDown={(e) => (e.key === 'Enter' ? e.currentTarget.blur() : e.key === 'Escape' && setTitling(false))} className="h-9 min-w-0 flex-1 rounded-md border border-line bg-surface px-2 text-[24px] font-semibold tracking-tight outline-none focus:border-ink" />
          ) : (
            <h2 className="min-w-0 flex-1 text-[26px] leading-9 font-semibold tracking-tight max-sm:text-[22px] max-sm:leading-8">
              <button type="button" title="Click to rename" onClick={() => setTitling(true)} className="text-left decoration-line-strong underline-offset-4 hover:underline">{note.title}</button>
            </h2>
          )}
          <button type="button" aria-pressed={Boolean(note.pinned)} aria-label={note.pinned ? 'Unpin' : 'Pin to top'} title={note.pinned ? 'Unpin' : 'Pin to top'} onClick={() => ai.updateNote(note.id, { pinned: !note.pinned })} className={cn('grid size-9 shrink-0 place-items-center rounded-md border transition-colors', note.pinned ? 'border-ink bg-ink text-bg' : 'border-line text-ink-2 hover:border-line-strong hover:text-ink')}><Icon name="pin" className="size-4" /></button>
          <div className="relative">
            <button type="button" aria-label="More" aria-expanded={more} onClick={() => setMore(!more)} className="grid size-9 place-items-center rounded-md border border-line text-ink-2 hover:border-line-strong hover:text-ink"><Icon name="menu" className="size-4" /></button>
            {more && (
              <div className="st-rise absolute top-11 right-0 z-30 grid w-52 gap-0.5 panel p-1.5 shadow-lg" onMouseLeave={() => setMore(false)}>
                <MenuItem icon="sparkle" onClick={() => void aiName()}>{naming ? 'Naming…' : 'Name it with AI'}</MenuItem>
                <MenuItem icon="download" onClick={() => (setMore(false), useUi.getState().print({ title: note.title, markdown: note.content }))}>Download PDF</MenuItem>
                <MenuItem icon="copy" onClick={async () => (setMore(false), toast((await copyText(note.content)) ? 'Copied.' : 'Could not copy.'))}>Copy text</MenuItem>
                <MenuItem icon="trash" danger onClick={async () => await askConfirm('Delete this note?') && (ai.deleteNote(note.id), onBack())}>Delete</MenuItem>
              </div>
            )}
          </div>
        </div>
        <div className="tnum mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
          <label className="flex items-center gap-1"><Icon name="layers" className="size-3.5" /><select aria-label="Folder" value={note.folder} onChange={(e) => (ai.updateNote(note.id, { folder: e.target.value }), toast(`Moved to ${e.target.value}.`))} className="cursor-pointer bg-transparent font-medium text-ink-2 outline-none hover:text-ink">{[...new Set([note.folder, ...ai.noteFolders])].map((f) => <option key={f}>{f}</option>)}</select></label>
          <span>{shortDate(note.createdAt)}</span>
          <span>{words.toLocaleString()} words</span>
          <span>{readTime(words)}</span>
          {note.updatedAt && <span>Edited {shortDate(note.updatedAt)}</span>}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 @md:grid-cols-3 @4xl:grid-cols-5">
          <ActionTile icon="chat" label="Ask" sub="Questions about it" primary={mode === 'ask'} onClick={() => (run.reset(), setMode(mode === 'ask' ? null : 'ask'))} />
          <ActionTile icon="quiz" label="Quiz me" sub="Practice test" busy={mode === 'quiz' && run.running} onClick={() => void make('quiz')} />
          <ActionTile icon="games" label="Flashcards" sub="20 cards" busy={cardsBusy} onClick={() => void cards()} />
          <ActionTile icon="bulb" label="Summarize" sub="Key points" busy={mode === 'summary' && run.running} onClick={() => void make('summary')} />
          <ActionTile icon="layers" label="Cheatsheet" sub="One page" busy={mode === 'cheatsheet' && run.running} onClick={() => void make('cheatsheet')} />
        </div>

        {mode === 'ask' && (
          <form className="st-rise mt-3 flex gap-2" onSubmit={(e) => (e.preventDefault(), void ask())}>
            <Input autoFocus value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask about these notes" aria-label="Question" className="h-10" />
            <Button type="submit" loading={run.running} disabled={!question.trim()}><Icon name="send" className="size-4" /></Button>
          </form>
        )}
        {mode && run.status !== 'idle' && (
          <div className="st-rise mt-3 rounded-[10px] border border-line bg-surface-2 px-4 py-3">
            <AiOutput run={run} thinking={mode === 'ask' ? 'Reading your notes' : mode === 'quiz' ? 'Writing questions' : mode === 'cheatsheet' ? 'Packing it onto one page' : 'Summarizing'} placeholder={null} />
          </div>
        )}

        <div className="sticky top-0 z-20 mt-7 flex flex-wrap items-center gap-2 border-b border-line bg-bg/95 py-2 backdrop-blur">
          <div role="tablist" aria-label="Mode" className="flex rounded-[8px] bg-surface-3 p-0.5">
            {(['Read', 'Edit'] as const).map((m) => (
              <button key={m} type="button" role="tab" aria-selected={editing === (m === 'Edit')} onClick={() => (m === 'Edit' ? (setDraft(note.content), setEditing(true)) : setEditing(false))} className={cn('h-7 rounded-[6px] px-3 text-[13px] font-medium transition-colors', editing === (m === 'Edit') ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.12)]' : 'text-ink-2 hover:text-ink')}>{m}</button>
            ))}
          </div>
          {!editing && (
            <>
              <button type="button" aria-pressed={recall} onClick={() => (reveal(false), setRecall(!recall))} className={cn('flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[13px] font-medium transition-colors', recall ? 'border-ink bg-ink text-bg' : 'border-line text-ink-2 hover:border-line-strong hover:text-ink')}><Icon name="target" className="size-3.5" />Hide key terms</button>
              {recall && <button type="button" onClick={() => reveal(true)} className="h-8 px-2 text-[13px] font-medium text-muted hover:text-ink">Show all</button>}
            </>
          )}
          {editing && (
            <span className="ml-auto flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" onClick={saveEdit} disabled={draft === note.content}>Save</Button>
            </span>
          )}
        </div>
        {recall && !editing && <p className="st-rise mt-3 text-[13px] text-muted">Key terms are hidden. Say each one out loud, then tap it to check.</p>}

        {editing ? (
          <textarea
            autoFocus
            aria-label="Note text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 's' && (e.preventDefault(), saveEdit())}
            rows={Math.min(40, Math.max(12, draft.split('\n').length + 2))}
            className="mt-4 w-full resize-y rounded-[10px] border border-line bg-surface p-4 font-mono text-[13px] leading-6 outline-none focus:border-ink"
          />
        ) : (
          <div
            ref={body}
            className="mt-5"
            onClick={(e) => {
              if (!recall) return;
              (e.target as HTMLElement).closest('strong')?.classList.toggle('shown');
            }}
          >
            <Markdown className={cn(recall && 'md-recall')}>{note.content}</Markdown>
          </div>
        )}
      </div>

      {heads.length > 1 && (
        <aside className="hidden @2xl:block">
          <nav aria-label="On this page" className="sticky top-6">
            <p className="mb-2 text-[12px] font-semibold text-muted">On this page</p>
            <ul className="grid border-l border-line">
              {heads.map((h, i) => (
                <li key={i}>
                  <button type="button" onClick={() => jump(i)} className={cn('-ml-px block w-full truncate border-l-2 py-1 text-left text-[13px] transition-colors', h.level > 2 ? 'pl-6' : 'pl-3', i === active ? 'border-ink font-medium text-ink' : 'border-transparent text-muted hover:text-ink')}>{h.text}</button>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="mt-3 flex items-center gap-1 text-[12px] font-medium text-muted hover:text-ink"><Icon name="up" className="size-3" />Back to top</button>
          </nav>
        </aside>
      )}
    </article>
    </div>
  );
}

function MenuItem({ icon, danger, onClick, children }: { icon: IconName; danger?: boolean; onClick: () => void; children: string }) {
  return <button type="button" onClick={onClick} className={cn('flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-surface-3', danger ? 'text-danger' : 'text-ink-2')}><Icon name={icon} className="size-4" /> {children}</button>;
}

/** Make notes from material you paste or upload. */
function Writer({ onOpen }: { onOpen: (id: string) => void }) {
  const ai = useAi();
  const att = useAttachments(8);
  const run = useAiRun();
  const [title, setTitle] = useState('');
  const [folder, setFolder] = useState('General');
  const [text, setText] = useState('');
  const [kind, setKind] = useState<MakeKind>('notes');
  const [cards, setCards] = useState<{ status: 'idle' | 'running' | 'done' | 'error'; count: number; error?: Error }>({ status: 'idle', count: 0 });

  const newFolder = async () => {
    const n = (await askText('New folder', { placeholder: 'Folder name, like BIO 101', ok: 'Create' }))?.trim().slice(0, 40);
    if (!n) return;
    ai.addNoteFolder(n);
    setFolder(n);
  };
  const generate = async () => {
    if (!text.trim() && !att.files.length) return toast('Paste something or add a file.');
    const name = title.trim() || att.files[0]?.name.replace(/\.\w+$/, '') || text.trim().slice(0, 40) || 'Study notes';
    if (kind === 'flashcards') {
      run.reset();
      setCards({ status: 'running', count: 0 });
      try {
        const list = await generateCards(text, 20, att.files);
        useLearning.getState().addSet(name, list, folder);
        setCards({ status: 'done', count: list.length });
      } catch (e) {
        setCards({ status: 'error', count: 0, error: e as Error });
      }
      return;
    }
    setCards({ status: 'idle', count: 0 });
    const content = await run.run({ tier: 'main', maxTokens: 6000, system: tutorSystem(ai), messages: [{ role: 'user', content: [...toParts(att.files), { type: 'text', text: `${NOTE_PROMPTS[kind]}\n\nTitle: ${name}\n\n${text.trim() ? `Material:\n${text.slice(0, 150_000)}` : 'The material is in the attached files.'}` }] }] });
    if (content) {
      const note = ai.saveNote({ title: name, folder, kind, content });
      // No title typed: let the AI name it from what it wrote.
      if (!title.trim()) void nameNote(content).then((t) => t && useAi.getState().updateNote(note.id, { title: t }), () => undefined);
      run.reset();
      setText('');
      setTitle('');
      att.files.forEach(() => att.remove(0));
      onOpen(note.id);
    }
  };

  return (
    <div className="grid gap-3">
      <Composer
        id="notesText"
        value={text}
        onChange={setText}
        rows={4}
        placeholder="Paste notes, a reading or a transcript, or attach slides and photos"
        att={att}
        accept=".pdf,.docx,.txt,.md,image/*"
        top={
          <>
            <input id="notesTitle" aria-label="Title" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Untitled" className="h-8 min-w-0 flex-1 bg-transparent px-1 text-[15px] font-semibold outline-none placeholder:font-normal placeholder:text-muted" />
            <InlineSelect label="Folder" id="notesFolder" value={folder} onChange={(e) => (e.target.value === '__new' ? newFolder() : setFolder(e.target.value))}>
              {ai.noteFolders.map((f) => <option key={f}>{f}</option>)}
              <option value="__new">New folder…</option>
            </InlineSelect>
          </>
        }
        controls={
          <InlineSelect label="Make" value={kind} onChange={(e) => setKind(e.target.value as MakeKind)}>
            <option value="notes">Study notes</option>
            <option value="cheatsheet">Cheatsheet</option>
            <option value="summary">Summary</option>
            <option value="flashcards">Flashcards</option>
            <option value="quiz">Practice test</option>
          </InlineSelect>
        }
        submitLabel="Make it"
        onSubmit={generate}
        loading={run.running || cards.status === 'running'}
      />
      {cards.status === 'running' && <Thinking label="Writing flashcards" />}
      {cards.status === 'error' && cards.error && <AiErrorBox error={cards.error} />}
      {cards.status === 'done' && (
        <div className="flex items-center gap-3 rounded-xl bg-ok-soft px-4 py-2.5 text-[14px] text-ok">
          <Icon name="check" className="size-4" /><span className="flex-1 font-medium">{cards.count} flashcards ready</span>
          <Link href="/study?tool=practice"><Button size="sm">Study them</Button></Link>
        </div>
      )}
      {run.status !== 'idle' && <AiOutput run={run} thinking={att.files.length ? 'Reading your files' : 'Organizing'} placeholder={null} />}
    </div>
  );
}

/** A note as a card: what kind it is, the title, the first lines, and how long it is. */
function NoteCard({ note, index, selecting, picked, onClick }: { note: Note; index: number; selecting: boolean; picked: boolean; onClick: () => void }) {
  const ai = useAi();
  const words = wordCount(note.content);
  return (
    <li className="st-rise" style={{ '--i': index } as React.CSSProperties}>
      <div className="group relative h-full">
        <button type="button" data-note-id={note.id} onClick={onClick} aria-pressed={selecting ? picked : undefined} className={cn('flex h-full w-full flex-col rounded-[10px] border bg-surface p-4 text-left transition-[border-color,transform] duration-200 hover:-translate-y-0.5', picked ? 'border-ink' : 'border-line hover:border-line-strong')}>
          <span className="flex items-center gap-1.5 pr-16 text-[12px] font-semibold whitespace-nowrap" style={{ color: KIND_TONE[note.kind] }}>
            <span className="size-2 rounded-full" style={{ background: KIND_TONE[note.kind] }} />{KIND_LABEL[note.kind]}<span className="truncate font-medium text-muted">{note.folder}</span>
          </span>
          <strong className="mt-2 line-clamp-2 text-[16px] leading-6 font-semibold">{note.title}</strong>
          <span className="mt-1 line-clamp-3 text-[13px] leading-5 text-muted">{plain(note.content).slice(0, 260)}</span>
          <span className="tnum mt-auto flex gap-3 pt-4 text-[12px] text-muted"><span>{shortDate(note.updatedAt ?? note.createdAt)}</span><span>{readTime(words)}</span></span>
        </button>
        {selecting ? (
          <span className={cn('pointer-events-none absolute top-3.5 right-3.5 grid size-5 place-items-center rounded border-2', picked ? 'border-ink bg-ink text-bg' : 'border-line-strong bg-surface')}>{picked && <Icon name="check" className="size-3" />}</span>
        ) : (
          <span className="absolute top-2.5 right-2.5 flex gap-0.5">
            <button type="button" aria-label={note.pinned ? `Unpin ${note.title}` : `Pin ${note.title}`} title={note.pinned ? 'Unpin' : 'Pin to top'} onClick={() => ai.updateNote(note.id, { pinned: !note.pinned })} className={cn('grid size-8 place-items-center rounded-md transition-[opacity,color] hover:bg-surface-3', note.pinned ? 'text-ink' : 'text-muted opacity-0 group-hover:opacity-100 focus:opacity-100 max-sm:opacity-100')}><Icon name="pin" className="size-4" /></button>
            <button type="button" aria-label={`Delete ${note.title}`} title="Delete" onClick={async () => await askConfirm(`Delete “${note.title}”?`) && (ai.deleteNote(note.id), toast('Note deleted.'))} className="grid size-8 place-items-center rounded-md text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:bg-surface-3 hover:text-danger focus:opacity-100 max-sm:hidden"><Icon name="trash" className="size-4" /></button>
          </span>
        )}
      </div>
    </li>
  );
}

function SectionTitle({ children, count }: { children: string; count: number }) {
  return <h3 className="mb-3 flex items-baseline gap-2 text-[15px] font-semibold">{children}<span className="tnum text-[13px] font-normal text-muted">{count}</span></h3>;
}

/** Notes and lecture recordings in one place, set up for studying rather than storing. */
export function NotesTool({ startRecording = false }: { startRecording?: boolean }) {
  const ai = useAi();
  const [adding, setAdding] = useState<'write' | 'record' | null>(startRecording ? 'record' : null);
  const [viewId, setViewId] = useState<string | null>(() => (typeof location !== 'undefined' ? new URLSearchParams(location.search).get('note') : null));
  const [then, setThen] = useState<'quiz' | null>(null);
  const [folder, setFolder] = useState('all');
  const [query, setQuery] = useState('');
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [recs, setRecs] = useState<Lecture[]>([]);
  const search = useRef<HTMLInputElement>(null);
  const reload = useCallback(() => listLectures().then(setRecs).catch(() => setRecs([])), []);
  useEffect(() => {
    const t = setTimeout(() => void reload(), 0);
    return () => clearTimeout(t);
  }, [reload]);
  // "/" jumps to search, like most apps with a library.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || (e.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return;
      e.preventDefault();
      search.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const viewing = ai.notes.find((n) => n.id === viewId) ?? null;
  const open = (id: string, next?: 'quiz') => (setAdding(null), setThen(next ?? null), setViewId(id), window.scrollTo({ top: 0, behavior: 'smooth' }));
  const closeAdding = async () => {
    // Closing the recorder mid-lecture would throw the audio away, so check first.
    const live = document.querySelector('[data-recorder="recording"], [data-recorder="paused"]');
    if (live && !await askConfirm('Stop and throw away this recording?')) return;
    setAdding(null);
  };

  if (viewing) return <NoteView key={viewing.id} note={viewing} onOpen={open} onBack={() => (setViewId(null), setThen(null))} then={then} />;

  const q = query.trim().toLowerCase();
  const recTitles = new Set(recs.map((r) => r.title));
  // A transcript lives under its lecture; it only shows here once the lecture is gone.
  const library = ai.notes.filter((n) => !(TRANSCRIPT.test(n.title) && recTitles.has(n.title.replace(TRANSCRIPT, ''))));
  const inFolder = (f: string) => folder === 'all' || f === folder;
  const notes = library.filter((n) => inFolder(n.folder) && (!q || n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q))).sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt));
  const lectures = recs.filter((r) => inFolder(r.course) && (!q || r.title.toLowerCase().includes(q) || r.marks.some((m) => m.label.toLowerCase().includes(q))));
  const pinned = notes.filter((n) => n.pinned);
  const rest = notes.filter((n) => !n.pinned);
  const folders = [...new Set([...ai.noteFolders, ...library.map((n) => n.folder), ...recs.map((r) => r.course).filter(Boolean)])];
  const countIn = (f: string) => library.filter((n) => n.folder === f).length + recs.filter((r) => r.course === f).length;
  const audio = recs.reduce((s, r) => s + r.seconds, 0);
  const empty = library.length === 0 && recs.length === 0;
  const pick = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  let i = 0;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 @container">
      <Hero
        title="Notes"
        sub={empty ? 'Paste a reading, upload slides or record a lecture. Then quiz yourself on it.' : `${library.length} ${library.length === 1 ? 'note' : 'notes'}, ${recs.length} ${recs.length === 1 ? 'lecture' : 'lectures'}${audio ? `, ${clock(audio)} of audio` : ''}`}
        action={
          <>
            <HeroGhost onClick={() => setAdding('record')} className="flex items-center gap-2 border border-white/35"><span className="size-2.5 rounded-full bg-[#ff6b5e]" />Record a lecture</HeroGhost>
            <HeroButton onClick={() => setAdding('write')} className="flex items-center gap-1.5"><Icon name="plus" className="size-4" />New note</HeroButton>
          </>
        }
      />
      <Dialog open={adding === 'write'} onClose={closeAdding} title="New note">
        {adding === 'write' && <Writer onOpen={open} />}
      </Dialog>
      <Dialog open={adding === 'record'} onClose={closeAdding} title="Record a lecture">
        {adding === 'record' && <Recorder onSaved={() => (void reload(), setAdding(null))} />}
      </Dialog>

      {!empty && (
        <div className="grid gap-3">
          <div className="flex items-center gap-2">
            <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-[8px] border border-line bg-surface px-3 focus-within:border-ink">
              <Icon name="search" className="size-4 shrink-0 text-muted" />
              <input ref={search} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes, lectures and marks" aria-label="Search notes" className="h-full min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted" />
              {!query && <kbd className="rounded border border-line px-1.5 text-[11px] text-muted max-sm:hidden">/</kbd>}
            </label>
            {library.length > 0 && <Button variant={selecting ? 'secondary' : 'ghost'} onClick={() => (setSelecting(!selecting), setPicked([]))}>{selecting ? 'Cancel' : 'Select'}</Button>}
            {selecting && (
              <Button variant="danger" disabled={!picked.length} onClick={async () => {
                if (!await askConfirm(`Delete ${picked.length} note${picked.length === 1 ? '' : 's'}? This cannot be undone.`)) return;
                picked.forEach((id) => ai.deleteNote(id));
                toast(`Deleted ${picked.length} note${picked.length === 1 ? '' : 's'}.`);
                setPicked([]);
                setSelecting(false);
              }}>Delete {picked.length || ''}</Button>
            )}
          </div>
          {folders.length > 1 && (
            <div role="tablist" aria-label="Folders" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
              {[{ id: 'all', name: 'All', n: library.length + recs.length }, ...folders.map((f) => ({ id: f, name: f, n: countIn(f) }))].filter((f) => f.id === 'all' || f.n > 0).map((f) => (
                <button key={f.id} type="button" role="tab" aria-selected={folder === f.id} onClick={() => setFolder(f.id)} className={cn('flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors', folder === f.id ? 'border-ink bg-ink text-bg' : 'border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink')}>
                  {f.name}<span className={cn('tnum text-[12px]', folder === f.id ? 'text-bg/70' : 'text-muted')}>{f.n}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {pinned.length > 0 && (
        <section>
          <SectionTitle count={pinned.length}>Pinned</SectionTitle>
          <ul className="grid gap-3 @lg:grid-cols-2 @3xl:grid-cols-3">{pinned.map((n) => <NoteCard key={n.id} note={n} index={i++} selecting={selecting} picked={picked.includes(n.id)} onClick={() => (selecting ? pick(n.id) : open(n.id))} />)}</ul>
        </section>
      )}

      {lectures.length > 0 && (
        <section>
          <SectionTitle count={lectures.length}>Lectures</SectionTitle>
          <ul className="grid gap-2">{lectures.map((r) => <RecordingRow key={r.id} l={r} onChange={reload} onOpenNote={open} index={i++} />)}</ul>
        </section>
      )}

      {rest.length > 0 && (
        <section>
          <SectionTitle count={rest.length}>{pinned.length ? 'Everything else' : 'Notes'}</SectionTitle>
          <ul id="notesLibrary" className="grid gap-3 @lg:grid-cols-2 @3xl:grid-cols-3">{rest.map((n) => <NoteCard key={n.id} note={n} index={i++} selecting={selecting} picked={picked.includes(n.id)} onClick={() => (selecting ? pick(n.id) : open(n.id))} />)}</ul>
        </section>
      )}

      {!empty && !notes.length && !lectures.length && (
        <div className="py-10 text-center">
          <p className="text-[15px] font-semibold">Nothing matches{q ? ` “${query.trim()}”` : ''}</p>
          <button type="button" onClick={() => (setQuery(''), setFolder('all'))} className="mt-1 text-[14px] font-medium text-accent-ink hover:underline">Clear search</button>
        </div>
      )}

      {empty && (
        <section className="grid gap-3 sm:grid-cols-3">
          {([
            ['upload', 'Bring your material', 'Paste a reading or upload slides, a PDF or photos of the board.', () => setAdding('write')],
            ['mic', 'Record the lecture', 'Mark the parts that matter while you listen. Notes come from the audio.', () => setAdding('record')],
            ['quiz', 'Study from it', 'Quiz yourself, make flashcards, or hide the key terms and test your memory.', () => setAdding('write')],
          ] as const).map(([icon, title, sub, go], n) => (
            <button key={title} type="button" onClick={go} className="st-rise flex flex-col rounded-[10px] border border-line bg-surface p-4 text-left transition-[border-color,transform] hover:-translate-y-0.5 hover:border-line-strong" style={{ '--i': n } as React.CSSProperties}>
              <span className="grid size-9 place-items-center rounded-md bg-surface-3 text-ink-2"><Icon name={icon} className="size-4" /></span>
              <strong className="mt-3 text-[15px] font-semibold">{title}</strong>
              <span className="mt-1 text-[13px] leading-5 text-muted">{sub}</span>
            </button>
          ))}
        </section>
      )}
    </div>
  );
}
