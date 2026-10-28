'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useAttachments } from '@/components/ui/attachments';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/field';
import { Icon } from '@/components/ui/icons';
import { Markdown } from '@/components/ui/markdown';
import { Thinking } from '@/components/ui/progress';
import { toParts } from '@/lib/ai/files';
import { NOTE_PROMPTS, tutorSystem } from '@/lib/ai/prompts';
import { useAi, type Note, type NoteKind } from '@/lib/stores/ai';
import { useLearning } from '@/lib/stores/learning';
import { toast, useUi } from '@/lib/stores/ui';
import { copyText, shortDate } from '@/lib/utils';
import { generateCards } from './tasks';
import { Composer, InlineSelect, SectionLabel } from './composer';
import { AiErrorBox, AiOutput } from './ui';
import { useAiRun } from './use-ai-run';

type MakeKind = 'notes' | 'cheatsheet' | 'summary' | 'flashcards' | 'quiz';
const KIND_LABEL: Record<NoteKind, string> = { notes: 'Notes', cheatsheet: 'Cheatsheet', summary: 'Summary', quiz: 'Practice test', guide: 'Study guide', solution: 'Solution', writing: 'Writing feedback' };

export function NoteActions({ note, onDeleted }: { note: Note; onDeleted?: () => void }) {
  const ai = useAi();
  const [busy, setBusy] = useState(false);
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Button size="sm" onClick={() => useUi.getState().print({ title: note.title, markdown: note.content })}><Icon name="download" className="size-4" /> Download PDF</Button>
      <Button size="sm" variant="secondary" loading={busy} onClick={async () => {
        setBusy(true);
        try {
          const set = useLearning.getState().addSet(note.title, await generateCards(note.content, 20), note.folder);
          toast(`${set.cards.length} flashcards added to your practice sets.`);
        } catch (e) {
          toast((e as Error).message, 'error');
        } finally {
          setBusy(false);
        }
      }}>Make flashcards</Button>
      <Button size="sm" variant="secondary" onClick={async () => toast((await copyText(note.content)) ? 'Copied.' : 'Could not copy.')}><Icon name="copy" className="size-4" /> Copy</Button>
      <Select aria-label="Move to folder" className="h-8 w-auto text-[13px]" value={note.folder} onChange={(e) => (ai.updateNote(note.id, { folder: e.target.value }), toast(`Moved to ${e.target.value}.`))}>
        {ai.noteFolders.map((f) => <option key={f}>{f}</option>)}
      </Select>
      <Button size="sm" variant="danger" onClick={() => confirm('Delete these notes?') && (ai.deleteNote(note.id), onDeleted?.())}><Icon name="trash" className="size-4" /> Delete</Button>
    </div>
  );
}

export function NotesTool() {
  const ai = useAi();
  const att = useAttachments(8);
  const run = useAiRun();
  const [title, setTitle] = useState('');
  const [folder, setFolder] = useState('General');
  const [text, setText] = useState('');
  const [kind, setKind] = useState<MakeKind>('notes');
  const [viewId, setViewId] = useState<string | null>(() => (typeof location !== 'undefined' ? new URLSearchParams(location.search).get('note') : null));
  const [libraryFolder, setLibraryFolder] = useState('all');
  const [cards, setCards] = useState<{ status: 'idle' | 'running' | 'done' | 'error'; list: { front: string; back: string }[]; error?: Error }>({ status: 'idle', list: [] });
  const viewing = ai.notes.find((n) => n.id === viewId) ?? null;
  const library = ai.notes.filter((n) => libraryFolder === 'all' || n.folder === libraryFolder);

  const newFolder = () => {
    const n = prompt('Folder name, like BIO 101')?.trim().slice(0, 40);
    if (n) {
      ai.addNoteFolder(n);
      setFolder(n);
    }
  };

  const generate = async () => {
    if (!text.trim() && !att.files.length) return toast('Paste some material or add a file first.');
    const name = title.trim() || att.files[0]?.name.replace(/\.\w+$/, '') || text.trim().slice(0, 40) || 'Study notes';
    setViewId(null);
    if (kind === 'flashcards') {
      run.reset();
      setCards({ status: 'running', list: [] });
      try {
        const list = await generateCards(text, 20, att.files);
        useLearning.getState().addSet(name, list, folder);
        setCards({ status: 'done', list });
      } catch (e) {
        setCards({ status: 'error', list: [], error: e as Error });
      }
      return;
    }
    setCards({ status: 'idle', list: [] });
    const content = await run.run({ tier: 'main', maxTokens: 6000, system: tutorSystem(ai), messages: [{ role: 'user', content: [...toParts(att.files), { type: 'text', text: `${NOTE_PROMPTS[kind]}\n\nTitle: ${name}\n\n${text.trim() ? `Material:\n${text.slice(0, 150_000)}` : 'The material is in the attached files.'}` }] }] });
    if (content) {
      const note = ai.saveNote({ title: name, folder, kind, content });
      setViewId(note.id);
      run.reset();
      toast(`Saved to ${folder}.`);
    }
  };

  const busy = run.running || cards.status === 'running';
  const showing = viewing || run.status !== 'idle' || cards.status !== 'idle';
  const back = () => (setViewId(null), run.reset(), setCards({ status: 'idle', list: [] }));
  return (
    <div className="grid gap-8">
      <Composer
        id="notesText"
        value={text}
        onChange={setText}
        rows={5}
        placeholder="Paste lecture notes, a textbook section or a transcript. Or attach slides, readings and photos."
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
            <option value="cheatsheet">One-page cheatsheet</option>
            <option value="summary">Summary</option>
            <option value="flashcards">Flashcards</option>
            <option value="quiz">Practice test</option>
          </InlineSelect>
        }
        submitLabel="Make it"
        onSubmit={generate}
        loading={busy}
      />

      <section id="noteView">
        {showing ? (
          <>
            <SectionLabel action={<Button variant="link" size="sm" onClick={back}>All notes</Button>}>{viewing ? `${KIND_LABEL[viewing.kind]} · ${viewing.folder}` : 'Writing'}</SectionLabel>
            {cards.status === 'running' ? <Thinking label="Writing flashcards" /> : cards.status === 'error' && cards.error ? <AiErrorBox error={cards.error} /> : cards.status === 'done' ? (
              <>
                <p className="text-[15px] font-semibold">{cards.list.length} flashcards added to your practice sets.</p>
                <div className="my-3 max-h-80 overflow-y-auto">{cards.list.map((c, i) => <div key={i} className="grid grid-cols-2 gap-3 border-b border-line py-2 text-[13px]"><strong>{c.front}</strong><span className="text-muted">{c.back}</span></div>)}</div>
                <Link href="/study?tool=practice"><Button size="sm">Practice now</Button></Link>
              </>
            ) : viewing ? (
              <>
                <h2 className="mb-3 text-[26px] leading-8">{viewing.title}</h2>
                <NoteActions note={viewing} onDeleted={() => setViewId(null)} />
                <Markdown>{viewing.content}</Markdown>
              </>
            ) : (
              <AiOutput run={run} thinking={att.files.length ? 'Reading your files' : 'Organizing'} placeholder={null} />
            )}
          </>
        ) : (
          <>
            <SectionLabel action={ai.notes.length > 0 && (
              <InlineSelect label="Show folder" value={libraryFolder} onChange={(e) => setLibraryFolder(e.target.value)}>
                <option value="all">All folders ({ai.notes.length})</option>
                {ai.noteFolders.map((f) => <option key={f} value={f}>{f} ({ai.notes.filter((n) => n.folder === f).length})</option>)}
              </InlineSelect>
            )}>Your notes</SectionLabel>
            <div id="notesLibrary">
              {library.length ? (
                <ul className="divide-y divide-line">
                  {library.map((n) => (
                    <li key={n.id}>
                      <button type="button" data-note-id={n.id} onClick={() => setViewId(n.id)} className="group flex w-full items-center gap-4 py-3 text-left">
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-3 text-muted"><Icon name="file" className="size-[18px]" /></span>
                        <span className="min-w-0 flex-1"><strong className="block truncate text-[15px] font-medium group-hover:underline">{n.title}</strong><small className="text-[13px] text-muted">{KIND_LABEL[n.kind]} · {n.folder} · {shortDate(n.createdAt)}</small></span>
                        <Icon name="chevron" className="size-4 shrink-0 text-muted" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-[14px] text-muted">Nothing here yet. What you make is saved here, sorted by folder.</p>}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
