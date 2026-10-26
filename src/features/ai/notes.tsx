'use client';
import { useState } from 'react';
import Link from 'next/link';
import { DropZone, FileTray, useAttachments } from '@/components/ui/attachments';
import { Card, CardHeader, Empty } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Icon } from '@/components/ui/icons';
import { Markdown } from '@/components/ui/markdown';
import { Thinking } from '@/components/ui/progress';
import { Segmented } from '@/components/ui/segmented';
import { toParts } from '@/lib/ai/files';
import { NOTE_PROMPTS, tutorSystem } from '@/lib/ai/prompts';
import { useAi, type Note, type NoteKind } from '@/lib/stores/ai';
import { useLearning } from '@/lib/stores/learning';
import { toast, useUi } from '@/lib/stores/ui';
import { copyText, shortDate } from '@/lib/utils';
import { generateCards } from './tasks';
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
          toast(`${set.cards.length} flashcards added to Study games.`);
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
  const [viewId, setViewId] = useState<string | null>(null);
  const [libraryFolder, setLibraryFolder] = useState('all');
  const [cards, setCards] = useState<{ status: 'idle' | 'running' | 'done' | 'error'; list: { front: string; back: string }[]; error?: Error }>({ status: 'idle', list: [] });
  const viewing = ai.notes.find((n) => n.id === viewId) ?? null;
  const library = ai.notes.filter((n) => libraryFolder === 'all' || n.folder === libraryFolder);

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

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <Card>
        <CardHeader eyebrow="FROM CLASS MATERIALS" title="Create notes" />
        <Field label="Title" htmlFor="notesTitle"><Input id="notesTitle" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Unit 4 — Cell respiration" /></Field>
        <Field label="Folder" htmlFor="notesFolder">
          <div className="flex gap-2">
            <Select id="notesFolder" value={folder} onChange={(e) => setFolder(e.target.value)}>{ai.noteFolders.map((f) => <option key={f}>{f}</option>)}</Select>
            <Button variant="secondary" onClick={() => { const n = prompt('Folder name (e.g. BIO 101):')?.trim().slice(0, 40); if (n) { ai.addNoteFolder(n); setFolder(n); } }}>New folder</Button>
          </div>
        </Field>
        <DropZone onFiles={att.add} accept=".pdf,.docx,.txt,.md,image/*" title="Drop lecture slides, readings, or photos" hint="PDF, Word, text, or images · up to 8 files" inputId="notesFile" />
        <FileTray files={att.files} onRemove={att.remove} reading={att.reading} />
        <Field label="Or paste text" htmlFor="notesText"><Textarea id="notesText" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste lecture notes, a textbook section, or a transcript" /></Field>
        <Field label="Make"><Segmented value={kind} onChange={setKind} options={[{ value: 'notes', label: 'Study notes' }, { value: 'cheatsheet', label: 'Cheatsheet' }, { value: 'summary', label: 'Summary' }, { value: 'flashcards', label: 'Flashcards' }, { value: 'quiz', label: 'Practice test' }]} /></Field>
        <Button size="lg" block className="mt-5" loading={run.running || cards.status === 'running'} onClick={generate}>Generate</Button>
      </Card>
      <Card>
        <CardHeader eyebrow="ORGANIZED BY FOLDER" title={viewing ? viewing.title : run.status !== 'idle' || cards.status !== 'idle' ? 'Generating…' : 'Notes library'} action={(viewing || run.status !== 'idle' || cards.status !== 'idle') && <Button variant="link" size="sm" onClick={() => (setViewId(null), run.reset(), setCards({ status: 'idle', list: [] }))}>← All notes</Button>} />
        <div id="noteView">
          {cards.status === 'running' ? <Thinking label="Writing flashcards…" /> : cards.status === 'error' && cards.error ? <AiErrorBox error={cards.error} /> : cards.status === 'done' ? (
            <>
              <div className="rounded-xl bg-ok-soft px-4 py-3 text-sm text-ok"><strong>{cards.list.length} flashcards added to Study games.</strong></div>
              <div className="my-3 max-h-80 overflow-y-auto">{cards.list.map((c, i) => <div key={i} className="grid grid-cols-2 gap-3 border-b border-line py-2 text-[13px]"><strong>{c.front}</strong><span className="text-muted">{c.back}</span></div>)}</div>
              <Link href="/games"><Button>Practice now</Button></Link>
            </>
          ) : viewing ? (
            <>
              <NoteActions note={viewing} onDeleted={() => setViewId(null)} />
              <Markdown>{viewing.content}</Markdown>
            </>
          ) : run.status !== 'idle' ? (
            <AiOutput run={run} thinking={att.files.length ? 'Reading your files…' : 'Organizing…'} placeholder={null} />
          ) : (
            <>
              <Select value={libraryFolder} onChange={(e) => setLibraryFolder(e.target.value)} aria-label="Show folder">
                <option value="all">All folders ({ai.notes.length})</option>
                {ai.noteFolders.map((f) => <option key={f} value={f}>{f} ({ai.notes.filter((n) => n.folder === f).length})</option>)}
              </Select>
              <div className="mt-2" id="notesLibrary">
                {library.length ? library.map((n) => (
                  <button key={n.id} type="button" data-note-id={n.id} onClick={() => setViewId(n.id)} className="flex w-full items-center justify-between gap-3 border-b border-line py-3 text-left last:border-0 hover:text-accent-ink">
                    <span className="min-w-0"><strong className="block truncate text-sm">{n.title}</strong><small className="text-xs text-muted">{KIND_LABEL[n.kind]} · {n.folder} · {shortDate(n.createdAt)}</small></span>
                    <Icon name="arrow" className="size-4 shrink-0 text-muted" />
                  </button>
                )) : <Empty>Generated notes, cheatsheets, and study guides are saved here by folder.</Empty>}
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
