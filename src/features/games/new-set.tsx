'use client';
import { useMemo, useRef, useState } from 'react';
import { DropZone, FileTray, useAttachments } from '@/components/ui/attachments';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/field';
import { Icon, type IconName } from '@/components/ui/icons';
import { Thinking } from '@/components/ui/progress';
import { generateCards } from '@/features/ai/tasks';
import { resolveConnection } from '@/lib/ai/client';
import { useAi } from '@/lib/stores/ai';
import { DEFAULT_FOLDER, useLearning } from '@/lib/stores/learning';
import { toast } from '@/lib/stores/ui';
import { cn } from '@/lib/utils';
import { parseBulkCards } from './decks';

type Source = 'files' | 'notes' | 'topic' | 'type';
const SOURCES: { id: Source; icon: IconName; title: string; sub: string }[] = [
  { id: 'files', icon: 'camera', title: 'Upload or snap', sub: 'PDF, slides or a photo of a page' },
  { id: 'notes', icon: 'file', title: 'From my notes', sub: 'Any note or lecture you saved' },
  { id: 'topic', icon: 'sparkle', title: 'A topic', sub: 'Name it and the AI writes them' },
  { id: 'type', icon: 'pen', title: 'Type my own', sub: 'One card per line' },
];
type Draft = { front: string; back: string; keep: boolean };

/** The cards the AI wrote, to check before saving: untick any you do not want, fix any wording. */
function Review({ drafts, setDrafts, name, setName, onSave, onBack }: { drafts: Draft[]; setDrafts: (d: Draft[]) => void; name: string; setName: (n: string) => void; onSave: () => void; onBack: () => void }) {
  const kept = drafts.filter((d) => d.keep).length;
  const edit = (i: number, patch: Partial<Draft>) => setDrafts(drafts.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  return (
    <div className="grid gap-3">
      <Input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} aria-label="Set name" placeholder="Set name" className="font-semibold" />
      <p className="text-[13px] text-muted">{drafts.length} cards written. Untick any you do not want, or fix the wording.</p>
      <ul className="max-h-[50vh] divide-y divide-line overflow-y-auto rounded-[10px] border border-line">
        {drafts.map((d, i) => (
          <li key={i} className={cn('st-rise grid grid-cols-[auto_1fr] gap-3 px-3 py-2.5', !d.keep && 'opacity-45')} style={{ '--i': i } as React.CSSProperties}>
            <input type="checkbox" checked={d.keep} onChange={() => edit(i, { keep: !d.keep })} aria-label={`Keep card ${i + 1}`} className="mt-1.5 size-4 accent-[var(--accent-fill)]" />
            <div className="grid min-w-0 gap-1 sm:grid-cols-2 sm:gap-3">
              <textarea rows={1} value={d.front} onChange={(e) => edit(i, { front: e.target.value })} aria-label={`Card ${i + 1} front`} className="min-w-0 resize-none rounded-[6px] border border-transparent bg-transparent px-1.5 py-1 text-[14px] font-medium [field-sizing:content] outline-none hover:border-line focus:border-ink" />
              <textarea rows={1} value={d.back} onChange={(e) => edit(i, { back: e.target.value })} aria-label={`Card ${i + 1} back`} className="min-w-0 resize-none rounded-[6px] border border-transparent bg-transparent px-1.5 py-1 text-[14px] text-ink-2 [field-sizing:content] outline-none hover:border-line focus:border-ink" />
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" onClick={onBack}>Start over</Button>
        <Button onClick={onSave} disabled={!kept || !name.trim()}>Save {kept} {kept === 1 ? 'card' : 'cards'}</Button>
      </div>
    </div>
  );
}

/** Make a set without typing: from files or photos, from your notes, or from a topic. Or type your own. */
export function NewSet({ onDone }: { onDone: (id: string) => void }) {
  const l = useLearning();
  const notes = useAi((s) => s.notes);
  const att = useAttachments(8);
  const camera = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<Source>('files');
  const [topic, setTopic] = useState('');
  const [noteId, setNoteId] = useState('');
  const [find, setFind] = useState('');
  const [count, setCount] = useState(15);
  const [bulk, setBulk] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [folder, setFolder] = useState(DEFAULT_FOLDER);
  const note = notes.find((n) => n.id === noteId);
  const shown = useMemo(() => {
    const q = find.trim().toLowerCase();
    return [...notes].sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt)).filter((n) => !q || n.title.toLowerCase().includes(q)).slice(0, 30);
  }, [notes, find]);

  const ready = source === 'files' ? att.files.length > 0 : source === 'notes' ? Boolean(note) : source === 'topic' ? Boolean(topic.trim()) : parseBulkCards(bulk).length > 0;

  const make = async () => {
    if (source === 'type') {
      const cards = parseBulkCards(bulk);
      if (!name.trim()) return toast('Name the set.');
      return onDone(l.addSet(name.trim(), cards, DEFAULT_FOLDER).id);
    }
    if (resolveConnection().mode === 'none') return toast('The AI tutor is not set up on this site yet.', 'error');
    setBusy(true);
    try {
      const cards = source === 'files'
        ? await generateCards('', count, att.files)
        : source === 'notes'
          ? await generateCards(`Title: ${note!.title}\n\n${note!.content.slice(0, 120_000)}`, count)
          : await generateCards(topic, count);
      const title = source === 'files' ? att.files[0].name.replace(/\.\w+$/, '') : source === 'notes' ? note!.title.replace(/: (notes|summary|transcript|cheatsheet|practice test)$/i, '') : topic;
      setName(title.length <= 60 ? title : `${title.slice(0, 57)}…`);
      setFolder(source === 'notes' && note ? note.folder : DEFAULT_FOLDER);
      setDrafts(cards.map((c) => ({ front: c.front, back: c.back, keep: true })));
    } catch (error) {
      toast((error as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    const cards = (drafts ?? []).filter((d) => d.keep && d.front.trim() && d.back.trim()).map(({ front, back }) => ({ front: front.trim(), back: back.trim() }));
    if (folder !== DEFAULT_FOLDER) l.addFolder(folder);
    onDone(l.addSet(name.trim(), cards, folder).id);
    toast(`${cards.length} flashcards saved.`);
  };

  if (drafts) return <Review drafts={drafts} setDrafts={setDrafts} name={name} setName={setName} onSave={save} onBack={() => setDrafts(null)} />;

  return (
    <div className="grid gap-4">
      <div role="radiogroup" aria-label="Make cards from" className="grid grid-cols-2 gap-2">
        {SOURCES.map((s) => (
          <button key={s.id} type="button" role="radio" aria-checked={source === s.id} onClick={() => setSource(s.id)} className={cn('flex items-start gap-2.5 rounded-[10px] border p-3 text-left transition-colors', source === s.id ? 'border-ink bg-surface-2' : 'border-line hover:border-line-strong')}>
            <span className={cn('grid size-8 shrink-0 place-items-center rounded-md', source === s.id ? 'bg-ink text-bg' : 'bg-surface-3 text-ink-2')}><Icon name={s.icon} className="size-4" /></span>
            <span className="min-w-0">
              <strong className="block text-[14px] font-semibold">{s.title}</strong>
              <span className="block text-[12px] leading-4 text-muted">{s.sub}</span>
            </span>
          </button>
        ))}
      </div>

      {source === 'files' && (
        <div>
          <DropZone onFiles={(f) => void att.add(f)} accept=".pdf,.docx,.txt,.md,image/*" title="Add slides, a PDF or photos" hint="Up to 8 files. The AI reads them and writes the cards." />
          <button type="button" onClick={() => camera.current?.click()} className="flex items-center gap-2 text-[13px] font-medium text-accent-ink hover:underline sm:hidden">
            <Icon name="camera" className="size-4" />Take a photo of a page
          </button>
          <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => (e.target.files?.length && void att.add(e.target.files), (e.target.value = ''))} />
          <FileTray files={att.files} onRemove={att.remove} reading={att.reading} />
        </div>
      )}

      {source === 'notes' && (
        notes.length ? (
          <div className="grid gap-2">
            {notes.length > 6 && <Input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find a note" aria-label="Find a note" />}
            <ul role="radiogroup" aria-label="Note" className="max-h-64 divide-y divide-line overflow-y-auto rounded-[10px] border border-line">
              {shown.map((n) => (
                <li key={n.id}>
                  <button type="button" role="radio" aria-checked={noteId === n.id} onClick={() => setNoteId(n.id)} className={cn('flex w-full items-center gap-3 px-3 py-2.5 text-left', noteId === n.id ? 'bg-surface-3' : 'hover:bg-surface-2')}>
                    <span className={cn('grid size-4 shrink-0 place-items-center rounded-full border-2', noteId === n.id ? 'border-ink' : 'border-line-strong')}>{noteId === n.id && <span className="size-1.5 rounded-full bg-ink" />}</span>
                    <span className="min-w-0 flex-1"><strong className="block truncate text-[14px] font-medium">{n.title}</strong><span className="text-[12px] text-muted">{n.folder}</span></span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : <p className="rounded-[10px] border border-dashed border-line px-4 py-6 text-center text-[13px] text-muted">No notes yet. Make one in Notes, or record a lecture, then come back.</p>
      )}

      {source === 'topic' && <Input autoFocus maxLength={2000} value={topic} onChange={(e) => setTopic(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ready && void make()} placeholder="Cell respiration, Spanish irregular verbs, the French Revolution" aria-label="Topic" />}

      {source === 'type' && (
        <div className="grid gap-2">
          <Input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Set name" aria-label="Set name" />
          <Textarea rows={5} value={bulk} onChange={(e) => setBulk(e.target.value)} aria-label="Cards, one per line" placeholder={'mitosis - cell division into two identical cells\nosmosis - water moving across a membrane'} />
          <span className="text-[12px] text-muted">{parseBulkCards(bulk).length} cards</span>
        </div>
      )}

      {busy ? (
        <Thinking label={source === 'files' ? 'Reading your files and writing cards' : source === 'notes' ? 'Reading your note' : 'Writing cards'} />
      ) : (
        <div className="flex items-center justify-end gap-2">
          {source !== 'type' && <Select className="w-auto" value={count} onChange={(e) => setCount(Number(e.target.value))} aria-label="Number of cards">{[10, 15, 25, 40].map((n) => <option key={n} value={n}>{n} cards</option>)}</Select>}
          <Button onClick={() => void make()} disabled={!ready || att.reading}>{source === 'type' ? 'Create set' : 'Make cards'}</Button>
        </div>
      )}
    </div>
  );
}

/** Ten more cards for a set, written to not repeat the ones it has. */
export async function moreCards(name: string, existing: { front: string }[]) {
  const list = existing.slice(0, 80).map((c) => `- ${c.front}`).join('\n');
  return generateCards(`Topic: ${name}\n\nThe set already has these cards. Write new ones that cover other important ideas and do not repeat these:\n${list}`, 10);
}
