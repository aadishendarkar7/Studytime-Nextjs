'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAttachments } from '@/components/ui/attachments';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input, Select } from '@/components/ui/field';
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
import { generateCards } from './tasks';
import { Composer, InlineSelect } from './composer';
import { listLectures, Recorder, RecordingRow } from './lectures';
import { AiErrorBox, AiOutput } from './ui';
import { useAiRun } from './use-ai-run';

type MakeKind = 'notes' | 'cheatsheet' | 'summary' | 'flashcards' | 'quiz';
const KIND_LABEL: Record<NoteKind, string> = { notes: 'Notes', cheatsheet: 'Cheatsheet', summary: 'Summary', quiz: 'Practice test', guide: 'Study guide', solution: 'Solution', writing: 'Writing feedback' };

function ToolButton({ icon, label, active, loading, onClick }: { icon: IconName; label: string; active?: boolean; loading?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={loading} aria-pressed={active} className={cn('flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition-colors disabled:opacity-60', active ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line bg-surface text-ink-2 hover:border-ink/30 hover:text-ink')}>
      <Icon name={icon} className={cn('size-4', loading && 'animate-pulse')} /> {label}
    </button>
  );
}

/** One note with everything you can do to it in a single row: summarize, ask, flashcards, quiz. */
function NoteView({ note, onOpen, onBack }: { note: Note; onOpen: (id: string) => void; onBack: () => void }) {
  const ai = useAi();
  const run = useAiRun();
  const [mode, setMode] = useState<'ask' | 'summary' | 'quiz' | null>(null);
  const [question, setQuestion] = useState('');
  const [cardsBusy, setCardsBusy] = useState(false);
  const [more, setMore] = useState(false);
  const material = `Title: ${note.title}\n\n${note.content.slice(0, 150_000)}`;

  const make = async (kind: 'summary' | 'quiz') => {
    setMode(kind);
    const content = await run.run({ tier: 'main', maxTokens: 5000, system: tutorSystem(ai), messages: [{ role: 'user', content: `${NOTE_PROMPTS[kind]}\n\n${material}` }] });
    if (content) {
      const saved = ai.saveNote({ title: `${note.title.replace(/: (notes|summary|practice test)$/i, '')}: ${kind === 'quiz' ? 'practice test' : 'summary'}`, folder: note.folder, kind, content });
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
      const set = useLearning.getState().addSet(note.title, await generateCards(note.content, 20), note.folder);
      toast(`${set.cards.length} flashcards made.`);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setCardsBusy(false);
    }
  };

  return (
    <article>
      <button type="button" onClick={onBack} className="mb-3 flex items-center gap-1 text-[13px] font-medium text-muted hover:text-ink"><Icon name="chevron" className="size-3.5 rotate-180" /> All notes</button>
      <h2 className="text-[24px] leading-8">{note.title}</h2>
      <p className="mt-0.5 text-[13px] text-muted">{KIND_LABEL[note.kind]} · {note.folder} · {shortDate(note.createdAt)}</p>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <ToolButton icon="chat" label="Ask" active={mode === 'ask'} onClick={() => (run.reset(), setMode(mode === 'ask' ? null : 'ask'))} />
        <ToolButton icon="bulb" label="Summarize" active={mode === 'summary'} loading={mode === 'summary' && run.running} onClick={() => void make('summary')} />
        <ToolButton icon="games" label="Flashcards" loading={cardsBusy} onClick={() => void cards()} />
        <ToolButton icon="quiz" label="Quiz me" active={mode === 'quiz'} loading={mode === 'quiz' && run.running} onClick={() => void make('quiz')} />
        <div className="relative ml-auto">
          <Button size="sm" variant="ghost" aria-label="More" aria-expanded={more} onClick={() => setMore(!more)}><Icon name="menu" className="size-4" /></Button>
          {more && (
            <div className="absolute top-10 right-0 z-30 grid w-52 gap-0.5 rounded-xl border border-line bg-surface p-1.5 shadow-lg" onMouseLeave={() => setMore(false)}>
              <MenuItem icon="download" onClick={() => useUi.getState().print({ title: note.title, markdown: note.content })}>Download PDF</MenuItem>
              <MenuItem icon="copy" onClick={async () => toast((await copyText(note.content)) ? 'Copied.' : 'Could not copy.')}>Copy text</MenuItem>
              <label className="flex items-center gap-2 px-2.5 py-1.5 text-[13px] text-ink-2">
                <Icon name="file" className="size-4" />
                <Select aria-label="Folder" className="h-7 flex-1 text-[13px]" value={note.folder} onChange={(e) => (ai.updateNote(note.id, { folder: e.target.value }), toast(`Moved to ${e.target.value}.`))}>{ai.noteFolders.map((f) => <option key={f}>{f}</option>)}</Select>
              </label>
              <MenuItem icon="trash" danger onClick={() => confirm('Delete this note?') && (ai.deleteNote(note.id), onBack())}>Delete</MenuItem>
            </div>
          )}
        </div>
      </div>

      {mode === 'ask' && (
        <form className="mt-3 flex gap-2" onSubmit={(e) => (e.preventDefault(), void ask())}>
          <Input autoFocus value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask about these notes" aria-label="Question" className="h-10" />
          <Button type="submit" loading={run.running} disabled={!question.trim()}><Icon name="send" className="size-4" /></Button>
        </form>
      )}
      {mode && run.status !== 'idle' && (
        <div className="mt-3 rounded-xl border border-line bg-surface-2 px-4 py-3">
          <AiOutput run={run} thinking={mode === 'ask' ? 'Reading your notes' : mode === 'quiz' ? 'Writing questions' : 'Summarizing'} placeholder={null} />
        </div>
      )}

      <div className="mt-6"><Markdown>{note.content}</Markdown></div>
    </article>
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

  const newFolder = () => {
    const n = prompt('Folder name, like BIO 101')?.trim().slice(0, 40);
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

type Item = { type: 'note'; at: number; note: Note } | { type: 'rec'; at: number; rec: Lecture };

/** Notes and lecture recordings in one place. Every note has Ask, Summarize, Flashcards and Quiz me. */
export function NotesTool({ startRecording = false }: { startRecording?: boolean }) {
  const ai = useAi();
  const [adding, setAdding] = useState<'write' | 'record' | null>(startRecording ? 'record' : null);
  const [viewId, setViewId] = useState<string | null>(() => (typeof location !== 'undefined' ? new URLSearchParams(location.search).get('note') : null));
  const [folder, setFolder] = useState('all');
  const [recs, setRecs] = useState<Lecture[]>([]);
  const reload = useCallback(() => listLectures().then(setRecs).catch(() => setRecs([])), []);
  useEffect(() => {
    const t = setTimeout(() => void reload(), 0);
    return () => clearTimeout(t);
  }, [reload]);
  const viewing = ai.notes.find((n) => n.id === viewId) ?? null;
  const open = (id: string) => (setAdding(null), setViewId(id), window.scrollTo({ top: 0, behavior: 'smooth' }));
  const closeAdding = () => {
    // Closing the recorder mid-lecture would throw the audio away, so check first.
    const live = document.querySelector('[data-recorder="recording"], [data-recorder="paused"]');
    if (live && !confirm('Stop and throw away this recording?')) return;
    setAdding(null);
  };

  if (viewing) return <NoteView key={viewing.id} note={viewing} onOpen={open} onBack={() => setViewId(null)} />;

  const items: Item[] = [
    ...ai.notes.filter((n) => folder === 'all' || n.folder === folder).map((note) => ({ type: 'note' as const, at: note.createdAt, note })),
    ...recs.filter((r) => folder === 'all' || r.course === folder).map((rec) => ({ type: 'rec' as const, at: rec.at, rec })),
  ].sort((a, b) => b.at - a.at);
  const folders = [...new Set([...ai.noteFolders, ...recs.map((r) => r.course).filter(Boolean)])];

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setAdding('write')}><Icon name="plus" className="size-4" /> New note</Button>
        <Button variant="secondary" onClick={() => setAdding('record')}><Icon name="mic" className="size-4" /> Record a lecture</Button>
      </div>
      <Dialog open={adding === 'write'} onClose={closeAdding} title="New note">
        {adding === 'write' && <Writer onOpen={open} />}
      </Dialog>
      <Dialog open={adding === 'record'} onClose={closeAdding} title="Record a lecture">
        {adding === 'record' && <Recorder onSaved={() => (void reload(), setAdding(null))} />}
      </Dialog>

      <section>
        <div className="mb-1 flex items-center justify-between gap-3">
          <h2 className="text-[13px] font-semibold tracking-wide text-muted uppercase">Your notes</h2>
          {items.length > 0 && folders.length > 1 && (
            <InlineSelect label="Folder" value={folder} onChange={(e) => setFolder(e.target.value)}>
              <option value="all">All folders</option>
              {folders.map((f) => <option key={f} value={f}>{f}</option>)}
            </InlineSelect>
          )}
        </div>
        {items.length ? (
          <ul id="notesLibrary" className="divide-y divide-line">
            {items.map((it) => it.type === 'rec' ? <RecordingRow key={it.rec.id} l={it.rec} onChange={reload} onOpenNote={open} /> : (
              <li key={it.note.id}>
                <button type="button" data-note-id={it.note.id} onClick={() => open(it.note.id)} className="group flex w-full items-center gap-3 py-2.5 text-left">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-3 text-muted"><Icon name={it.note.kind === 'quiz' ? 'quiz' : it.note.kind === 'summary' ? 'bulb' : 'file'} className="size-4" /></span>
                  <span className="min-w-0 flex-1"><strong className="block truncate text-[15px] font-medium group-hover:underline">{it.note.title}</strong><small className="text-[13px] text-muted">{KIND_LABEL[it.note.kind]} · {it.note.folder} · {shortDate(it.note.createdAt)}</small></span>
                  <Icon name="chevron" className="size-4 shrink-0 text-muted" />
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="py-6 text-center text-[14px] text-muted">Nothing yet</p>}
      </section>
    </div>
  );
}
