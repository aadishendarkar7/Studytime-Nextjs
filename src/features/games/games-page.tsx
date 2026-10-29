'use client';
import { useEffect, useMemo, useState } from 'react';
import { Badge, PageHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/field';
import { Icon, type IconName } from '@/components/ui/icons';
import { Segmented } from '@/components/ui/segmented';
import { api } from '@/lib/api';
import { resolveConnection } from '@/lib/ai/client';
import { generateCards } from '@/features/ai/tasks';
import { allFolders, DEFAULT_FOLDER, useLearning } from '@/lib/stores/learning';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import type { Deck, StudySet } from '@/lib/types';
import { cn } from '@/lib/utils';
import { parseBulkCards, STARTER_DECKS } from './decks';
import { GameStage, MODES, type Mode } from './modes';
import { isDue } from './srs';

function DeckLibrary({ onAdded }: { onAdded?: () => void }) {
  const l = useLearning();
  const [tab, setTab] = useState<'starter' | 'shared'>('starter');
  const [shared, setShared] = useState<Deck[] | null>(null);
  const [q, setQ] = useState('');
  useEffect(() => {
    const load = () => api.decks.list().then((r) => setShared(r.decks)).catch(() => setShared([]));
    if (tab === 'shared') load();
    window.addEventListener('studytime:decks', load);
    return () => window.removeEventListener('studytime:decks', load);
  }, [tab]);
  const decks = (tab === 'starter' ? STARTER_DECKS : shared ?? []).filter((d) => !q || `${d.name} ${d.subject} ${d.author ?? ''}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Segmented value={tab} onChange={setTab} options={[{ value: 'starter', label: 'Starter' }, { value: 'shared', label: 'From students' }]} />
        <Input className="h-9 min-w-40 flex-1" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search decks" aria-label="Search decks" />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tab === 'shared' && shared === null ? <p className="text-sm text-muted">Loading…</p> : decks.length ? decks.map((d) => {
          const added = l.sets.some((s) => s.sourceDeck === d.id);
          return (
            <article key={d.id} className="flex flex-col gap-1.5 border border-line p-4 rounded-xl">
              <Badge className="self-start">{d.subject || 'General'}</Badge>
              <h3 className="mt-1 font-semibold">{d.name}</h3>
              <p className="text-[13px] text-muted">{d.cards.length} cards{d.author ? ` · by ${d.author}` : ''}</p>
              <p className="flex-1 text-xs text-muted">{d.cards.slice(0, 3).map((c) => c.front).join(' · ')}</p>
              <Button variant="secondary" className="mt-2" onClick={() => {
                if (added && !confirm('You already added this deck. Add another copy?')) return;
                l.addSet(d.name, d.cards, d.subject || DEFAULT_FOLDER, d.id);
                toast(`“${d.name}” added.`);
                onAdded?.();
              }}>{added ? 'Added' : 'Add'}</Button>
            </article>
          );
        }) : <p className="text-sm text-muted sm:col-span-2">{tab === 'shared' ? 'No shared decks yet' : 'No matches'}</p>}
      </div>
    </div>
  );
}

const MODE_INFO: Record<Mode, { icon: IconName; short: string }> = {
  review: { icon: 'reset', short: 'Review' },
  flashcards: { icon: 'games', short: 'Flip' },
  quiz: { icon: 'check', short: 'Quiz' },
  matching: { icon: 'layers', short: 'Match' },
  blank: { icon: 'pen', short: 'Type' },
  speed: { icon: 'clock', short: 'Speed' },
};

const dueIn = (set: StudySet) => set.cards.filter((c) => isDue(c)).length;

/** Make a new set: from a topic with AI, by typing a list, or empty. */
function NewSet({ onDone }: { onDone: (id: string) => void }) {
  const l = useLearning();
  const [how, setHow] = useState<'ai' | 'paste'>('ai');
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(15);
  const [name, setName] = useState('');
  const [bulk, setBulk] = useState('');
  const [busy, setBusy] = useState(false);
  const generate = async () => {
    if (!topic.trim()) return;
    if (resolveConnection().mode === 'none') return toast('The AI tutor is not set up on this site yet.', 'error');
    setBusy(true);
    try {
      const cards = await generateCards(topic, count);
      const created = l.addSet(topic.length <= 50 ? topic : `${topic.slice(0, 47)}…`, cards, DEFAULT_FOLDER);
      onDone(created.id);
    } catch (error) {
      toast((error as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const paste = () => {
    const cards = parseBulkCards(bulk);
    if (!name.trim()) return toast('Name the set.');
    onDone(l.addSet(name, cards, DEFAULT_FOLDER).id);
  };
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <Segmented label="How to make it" value={how} onChange={setHow} options={[{ value: 'ai', label: 'From a topic' }, { value: 'paste', label: 'Type my own' }]} />
      {how === 'ai' ? (
        <form className="mt-3 flex flex-wrap gap-2" onSubmit={(e) => (e.preventDefault(), void generate())}>
          <Input autoFocus className="min-w-48 flex-[2]" maxLength={2000} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Cell respiration, Spanish verbs, or paste notes" aria-label="Topic" />
          <Select className="w-auto" value={count} onChange={(e) => setCount(Number(e.target.value))} aria-label="Number of cards">{[10, 15, 25].map((n) => <option key={n} value={n}>{n} cards</option>)}</Select>
          <Button type="submit" loading={busy} disabled={!topic.trim()}><Icon name="sparkle" className="size-4" /> Make cards</Button>
        </form>
      ) : (
        <div className="mt-3 grid gap-2">
          <Input autoFocus value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Set name" aria-label="Set name" />
          <Textarea rows={5} value={bulk} onChange={(e) => setBulk(e.target.value)} aria-label="Cards, one per line" placeholder={'mitosis - cell division into two identical cells\nosmosis - water moving across a membrane'} />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] text-muted">{parseBulkCards(bulk).length} cards</span>
            <Button onClick={paste} disabled={!name.trim()}>Create set</Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** The list of cards in a set, with a row to add one. */
function EditCards({ set }: { set: StudySet }) {
  const l = useLearning();
  const folders = allFolders(l);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const add = () => {
    if (!front.trim() || !back.trim()) return;
    l.addCards(set.id, [{ front, back }]);
    setFront('');
    setBack('');
  };
  const share = async () => {
    if (set.cards.length < 2) return toast('Add at least two cards first.');
    if (!confirm(`Share “${set.name}” with everyone on Studytime?`)) return;
    try {
      await api.decks.share({ name: set.name, subject: set.folder === DEFAULT_FOLDER ? '' : set.folder, author: useProfile.getState().name, cards: set.cards.map(({ front, back }) => ({ front, back })) });
      toast('Shared.');
      window.dispatchEvent(new Event('studytime:decks'));
    } catch (error) {
      toast((error as Error).message, 'error');
    }
  };
  return (
    <div className="grid gap-3">
      <form className="flex flex-wrap gap-2" onSubmit={(e) => (e.preventDefault(), add())}>
        <Input className="min-w-36 flex-1" maxLength={180} value={front} onChange={(e) => setFront(e.target.value)} placeholder="Front" aria-label="Front" />
        <Input className="min-w-36 flex-1" maxLength={180} value={back} onChange={(e) => setBack(e.target.value)} placeholder="Back" aria-label="Back" />
        <Button type="submit" variant="secondary" disabled={!front.trim() || !back.trim()}><Icon name="plus" className="size-4" /> Add</Button>
      </form>
      <ul className="max-h-96 overflow-y-auto rounded-xl border border-line">
        {set.cards.map((c) => (
          <li key={c.id} className="grid grid-cols-[1fr_1fr_auto] items-center gap-3 border-b border-line px-3 py-2 text-[13px] last:border-0">
            <strong className="font-medium break-words">{c.front}</strong>
            <span className="break-words text-muted">{c.back}</span>
            <button type="button" onClick={() => l.removeCard(set.id, c.id)} aria-label={`Remove ${c.front}`} className="p-1 text-muted hover:text-danger"><Icon name="trash" className="size-4" /></button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <Select aria-label="Folder" className="h-8 w-auto text-[13px]" value={set.folder} onChange={(e) => {
          let folder = e.target.value;
          if (folder === '__new') {
            folder = (prompt('Folder name, like BIO 101') || '').trim().slice(0, 40);
            if (!folder) return;
            l.addFolder(folder);
          }
          l.updateSet(set.id, { folder });
        }}>
          {folders.map((f) => <option key={f}>{f}</option>)}
          <option value="__new">New folder…</option>
        </Select>
        <Button size="sm" variant="ghost" onClick={() => { const n = prompt('Rename', set.name)?.trim(); if (n) l.updateSet(set.id, { name: n.slice(0, 60) }); }}>Rename</Button>
        <Button size="sm" variant="ghost" onClick={share}>Share</Button>
        <Button size="sm" variant="ghost" className="ml-auto text-danger" onClick={() => confirm(`Delete “${set.name}”?`) && l.deleteSet(set.id)}><Icon name="trash" className="size-4" /> Delete set</Button>
      </div>
    </div>
  );
}

/** One open set: pick how to study it, or edit its cards. */
function SetView({ set, onBack }: { set: StudySet; onBack: () => void }) {
  const due = dueIn(set);
  const [mode, setMode] = useState<Mode | 'edit'>(set.cards.length ? (due ? 'review' : 'flashcards') : 'edit');
  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3">
        <Button size="sm" variant="ghost" aria-label="All sets" onClick={onBack}><Icon name="chevron" className="size-4 rotate-180" /></Button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[20px] leading-7">{set.name}</h2>
          <p className="tnum text-[13px] text-muted">{set.cards.length} cards{due ? ` · ${due} due` : ''}</p>
        </div>
      </div>
      <div role="tablist" aria-label="Study mode" className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
        {MODES.map((m) => (
          <button key={m.id} type="button" role="tab" title={m.label} aria-selected={mode === m.id} disabled={!set.cards.length} onClick={() => setMode(m.id)} className={cn('relative flex flex-col items-center gap-1 rounded-xl border py-2.5 text-[12px] font-medium transition-colors disabled:opacity-40', mode === m.id ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line bg-surface text-ink-2 hover:border-ink/30')}>
            <Icon name={MODE_INFO[m.id].icon} className="size-5" />
            {MODE_INFO[m.id].short}
            {m.id === 'review' && due > 0 && <span className="tnum absolute top-1 right-1 rounded-md bg-accent-fill px-1 text-[10px] leading-4 text-white">{due}</span>}
          </button>
        ))}
        <button type="button" role="tab" aria-selected={mode === 'edit'} onClick={() => setMode('edit')} className={cn('flex flex-col items-center gap-1 rounded-xl border py-2.5 text-[12px] font-medium transition-colors', mode === 'edit' ? 'border-accent bg-accent-soft text-accent-ink' : 'border-dashed border-line bg-surface text-ink-2 hover:border-ink/30')}>
          <Icon name="pen" className="size-5" /> Edit
        </button>
      </div>
      <div className="min-h-72 rounded-xl border border-line bg-surface p-5 max-sm:p-4">
        {mode === 'edit' ? <EditCards set={set} /> : <GameStage key={`${set.id}-${mode}`} set={set} mode={mode} />}
      </div>
    </div>
  );
}

/** Your sets as cards. Tap one to study it. */
export function GamesPage({ embedded = false }: { embedded?: boolean } = {}) {
  const l = useLearning();
  // A review block on the calendar links here with ?set=<id> to open that set.
  const [openId, setOpenId] = useState<string | null>(() => {
    const id = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('set') : null;
    return id && useLearning.getState().sets.some((x) => x.id === id) ? id : null;
  });
  const [panel, setPanel] = useState<'new' | 'decks' | null>(null);
  const [folder, setFolder] = useState('all');
  const totalDue = useMemo(() => l.sets.reduce((n, s) => n + dueIn(s), 0), [l.sets]);
  const open = l.sets.find((s) => s.id === openId);
  const go = (id: string) => (l.update({ selectedId: id }), setOpenId(id), setPanel(null));
  const folders = allFolders(l);
  const shown = l.sets.filter((s) => folder === 'all' || s.folder === folder).sort((a, b) => dueIn(b) - dueIn(a));

  return (
    <>
      {!embedded && <PageHeader title="Flashcards" />}
      {open ? <SetView key={open.id} set={open} onBack={() => setOpenId(null)} /> : (
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => setPanel(panel === 'new' ? null : 'new')} variant={panel === 'new' ? 'secondary' : 'primary'}><Icon name={panel === 'new' ? 'close' : 'plus'} className="size-4" /> New set</Button>
            <Button variant="secondary" onClick={() => setPanel(panel === 'decks' ? null : 'decks')}><Icon name="book" className="size-4" /> Browse decks</Button>
            {totalDue > 0 && <span className="tnum ml-auto text-[13px] text-muted"><strong className="text-ink">{totalDue}</strong> due today</span>}
            {folders.length > 1 && (
              <Select aria-label="Folder" className={cn('h-9 w-auto text-[13px]', totalDue === 0 && 'ml-auto')} value={folder} onChange={(e) => setFolder(e.target.value)}>
                <option value="all">All folders</option>
                {folders.map((f) => <option key={f}>{f}</option>)}
              </Select>
            )}
          </div>
          {panel === 'new' && <NewSet onDone={go} />}
          {panel === 'decks' && <div className="rounded-xl border border-line bg-surface p-4"><DeckLibrary onAdded={() => setPanel(null)} /></div>}
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((s) => {
              const due = dueIn(s);
              return (
                <li key={s.id} className="flex flex-col rounded-xl border border-line bg-surface p-4 transition-colors hover:border-ink/25">
                  <button type="button" onClick={() => go(s.id)} className="min-w-0 text-left">
                    <span className="text-[12px] text-muted">{s.folder}</span>
                    <strong className="mt-0.5 line-clamp-2 block text-[16px] leading-6 font-semibold">{s.name}</strong>
                    <span className="mt-1 line-clamp-1 block text-[13px] text-muted">{s.cards.slice(0, 3).map((c) => c.front).join(' · ') || 'No cards yet'}</span>
                  </button>
                  <div className="mt-4 flex items-center gap-2">
                    <span className="tnum flex-1 text-[13px] whitespace-nowrap text-muted">{s.cards.length} cards</span>
                    {due > 0 && <Badge tone="accent">{due} due</Badge>}
                    <Button size="sm" onClick={() => go(s.id)}><Icon name="play" className="size-3.5" /> Study</Button>
                  </div>
                </li>
              );
            })}
          </ul>
          {!embedded && <p className="text-[13px] text-muted"><button type="button" className="font-medium text-ink underline underline-offset-4" onClick={() => window.dispatchEvent(new Event('studytime:popquiz'))}>Pop quiz</button></p>}
        </div>
      )}
    </>
  );
}
