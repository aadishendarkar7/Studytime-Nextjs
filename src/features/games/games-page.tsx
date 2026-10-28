'use client';
import { useEffect, useMemo, useState } from 'react';
import { Badge, Card, CardHeader, Empty, PageHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, FieldRow, Input, Note, Select, Textarea } from '@/components/ui/field';
import { Icon, type IconName } from '@/components/ui/icons';
import { Segmented, Tabs } from '@/components/ui/segmented';
import { api } from '@/lib/api';
import { resolveConnection } from '@/lib/ai/client';
import { generateCards } from '@/features/ai/tasks';
import { allFolders, DEFAULT_FOLDER, useLearning } from '@/lib/stores/learning';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import type { Deck } from '@/lib/types';
import { cn } from '@/lib/utils';
import { parseBulkCards, STARTER_DECKS } from './decks';
import { GameStage, MODES, type Mode } from './modes';
import { isDue } from './srs';

function SetManager() {
  const l = useLearning();
  const folders = allFolders(l);
  const visible = l.sets.filter((s) => l.folderFilter === 'all' || s.folder === l.folderFilter);
  const list = visible.length ? visible : l.sets;
  const set = l.sets.find((s) => s.id === l.selectedId) ?? list[0];
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [bulk, setBulk] = useState('');
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(15);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState('');
  const due = set.cards.filter((c) => isDue(c)).length;
  const targetFolder = l.folderFilter === 'all' ? DEFAULT_FOLDER : l.folderFilter;

  const addCard = () => {
    if (!front.trim() || !back.trim()) return toast('Enter both a question and an answer.', 'error');
    l.addCards(set.id, [{ front, back }]);
    setFront('');
    setBack('');
  };
  const generate = async () => {
    if (!topic.trim()) return toast('Type a topic or paste some notes first.');
    if (resolveConnection().mode === 'none') return toast('Connect the AI tutor in Settings first (Gemini is free).', 'error');
    setBusy(true);
    try {
      const cards = await generateCards(topic, count);
      const name = topic.length <= 50 ? topic : `${topic.slice(0, 47)}…`;
      const created = l.addSet(name, cards, targetFolder);
      toast(`Created “${name}” with ${created.cards.length} cards.`);
      setTopic('');
    } catch (error) {
      toast((error as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const share = async () => {
    if (set.cards.length < 2) return toast('Add at least two cards before sharing.');
    if (!confirm(`Share “${set.name}” with everyone using this Studytime site?`)) return;
    try {
      await api.decks.share({ name: set.name, subject: set.folder === DEFAULT_FOLDER ? '' : set.folder, author: useProfile.getState().name, cards: set.cards.map(({ front, back }) => ({ front, back })) });
      toast('Shared to the deck library.');
      window.dispatchEvent(new Event('studytime:decks'));
    } catch (error) {
      toast((error as Error).message, 'error');
    }
  };

  return (
    <Card>
      <CardHeader title="Your sets" />
      <FieldRow>
        <Field label="Folder" htmlFor="gameFolderSelect">
          <Select id="gameFolderSelect" value={l.folderFilter} onChange={(e) => l.update({ folderFilter: e.target.value })}>
            <option value="all">All folders</option>
            {folders.map((f) => <option key={f} value={f}>{f} ({l.sets.filter((s) => s.folder === f).length})</option>)}
          </Select>
        </Field>
        <Field label="Set" htmlFor="gameSetSelect">
          <Select id="gameSetSelect" value={set.id} onChange={(e) => l.update({ selectedId: e.target.value })}>
            {list.map((s) => { const d = s.cards.filter((c) => isDue(c)).length; return <option key={s.id} value={s.id}>{s.name}{d ? ` · ${d} due` : ''}</option>; })}
          </Select>
        </Field>
      </FieldRow>
      <Note className="mt-2" >{set.cards.length} cards · {due} due for review · in {set.folder}</Note>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <Select aria-label="Move set to folder" className="h-8 w-auto text-[13px]" value={set.folder} onChange={(e) => {
          let folder = e.target.value;
          if (folder === '__new') {
            folder = (prompt('New folder name (e.g. BIO 101):') || '').trim().slice(0, 40);
            if (!folder) return;
            l.addFolder(folder);
          }
          l.updateSet(set.id, { folder });
          toast(`Moved to ${folder}.`);
        }}>
          {folders.map((f) => <option key={f}>{f}</option>)}
          <option value="__new">+ New folder…</option>
        </Select>
        <Button variant="link" size="sm" onClick={() => { const n = prompt('Rename set:', set.name)?.trim(); if (n) l.updateSet(set.id, { name: n.slice(0, 60) }); }}>Rename</Button>
        <Button variant="link" size="sm" onClick={share}>Share to library</Button>
        <Button variant="link" size="sm" className="text-danger" onClick={() => confirm(`Delete “${set.name}” and its ${set.cards.length} cards?`) && l.deleteSet(set.id)}>Delete set</Button>
      </div>

      <Field label="Add a card">
        <div className="flex flex-wrap gap-2">
          <Input className="min-w-36 flex-1" maxLength={180} value={front} onChange={(e) => setFront(e.target.value)} placeholder="Term or question" aria-label="Term or question" />
          <Input className="min-w-36 flex-1" maxLength={180} value={back} onChange={(e) => setBack(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCard()} placeholder="Answer" aria-label="Answer" />
          <Button variant="secondary" onClick={addCard}>Add</Button>
        </div>
      </Field>
      <details open className="mt-4 rounded-lg border border-line px-4 py-3">
        <summary className="min-h-9 text-[13px] font-medium text-ink">Generate cards with AI</summary>
        <div className="mt-3 flex flex-wrap gap-2">
          <Input className="min-w-48 flex-[2]" maxLength={2000} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="A topic or pasted notes, e.g. The French Revolution" aria-label="Topic for AI flashcards" />
          <Select className="w-auto" value={count} onChange={(e) => setCount(Number(e.target.value))} aria-label="Number of cards">
            {[10, 15, 25].map((n) => <option key={n} value={n}>{n} cards</option>)}
          </Select>
          <Button loading={busy} onClick={generate}>Generate</Button>
        </div>
      </details>
      <details className="mt-3 text-sm">
        <summary className="font-semibold text-ink-2">Paste many cards at once</summary>
        <Note>One card per line: <code>term - answer</code>, <code>term: answer</code>, or tab-separated.</Note>
        <Textarea className="mt-2" rows={5} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder="Mitosis - Cell division that makes two identical cells" />
        <Button variant="secondary" className="mt-2" onClick={() => {
          const cards = parseBulkCards(bulk);
          if (!cards.length) return toast('Put one card per line, like: term - answer');
          l.addCards(set.id, cards);
          setBulk('');
          toast(`${cards.length} card${cards.length === 1 ? '' : 's'} added.`);
        }}>Add cards</Button>
      </details>
      <form className="mt-5 flex gap-2 border-t border-line pt-5" onSubmit={(e) => { e.preventDefault(); if (!newName.trim()) return toast('Name your study set first.'); l.addSet(newName, [], targetFolder); setNewName(''); toast('Study set created. Add your first card.'); }}>
        <Input value={newName} maxLength={60} onChange={(e) => setNewName(e.target.value)} placeholder="New set name, e.g. Biology Unit 1" aria-label="New set name" />
        <Button type="submit" variant="secondary">Create set</Button>
      </form>
      <div className="mt-4 max-h-72 overflow-y-auto">
        {set.cards.length ? set.cards.map((c, i) => (
          <div key={c.id} className="grid grid-cols-[1fr_1fr_auto] items-center gap-3 border-b border-line py-2.5 text-[13px] last:border-0">
            <strong className="break-words">{i + 1}. {c.front}</strong>
            <span className="break-words text-muted">{c.back}</span>
            <button type="button" onClick={() => l.removeCard(set.id, c.id)} aria-label={`Remove card ${i + 1}`} className="p-1 text-muted hover:text-danger"><Icon name="close" className="size-4" /></button>
          </div>
        )) : <Empty>Add a term and answer to begin.</Empty>}
      </div>
    </Card>
  );
}

function DeckLibrary() {
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
    <Card>
      <CardHeader title="Ready-made decks" description="Start from a free deck or one shared by other students." action={<Segmented value={tab} onChange={setTab} options={[{ value: 'starter', label: 'Starter decks' }, { value: 'shared', label: 'Shared by students' }]} />} />
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search decks" aria-label="Search decks" />
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
                toast(`“${d.name}” added to your sets.`);
              }}>{added ? 'Added' : 'Add to my sets'}</Button>
            </article>
          );
        }) : <p className="text-sm text-muted sm:col-span-2">{tab === 'shared' ? 'No shared decks yet. Share one of your sets to start the library.' : 'No decks match your search.'}</p>}
      </div>
    </Card>
  );
}

const MODE_INFO: Record<Mode, { icon: IconName; text: string }> = {
  review: { icon: 'reset', text: 'Due cards first. Rate how well you knew each one.' },
  flashcards: { icon: 'games', text: 'Flip through the set at your own pace.' },
  quiz: { icon: 'check', text: 'Multiple choice made from your own cards.' },
  matching: { icon: 'copy', text: 'Pair every term with its answer.' },
  blank: { icon: 'pen', text: 'Type the answer from memory.' },
  speed: { icon: 'clock', text: 'As many as you can in 60 seconds.' },
};

function Play() {
  const l = useLearning();
  const set = l.sets.find((s) => s.id === l.selectedId) ?? l.sets[0];
  const [mode, setMode] = useState<Mode>('review');
  const due = set.cards.filter((c) => isDue(c)).length;
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-surface px-4 py-3">
        <label className="flex min-w-0 items-center gap-2 text-[13px] text-muted">
          Set
          <Select aria-label="Study set" className="h-8 w-auto max-w-[260px] text-[13px]" value={set.id} onChange={(e) => l.update({ selectedId: e.target.value })}>
            {l.sets.map((s) => { const d = s.cards.filter((c) => isDue(c)).length; return <option key={s.id} value={s.id}>{s.name}{d ? ` · ${d} due` : ''}</option>; })}
          </Select>
        </label>
        <span className="tnum text-[13px] text-muted"><strong className="font-semibold text-ink">{set.cards.length}</strong> cards</span>
        <span className="tnum text-[13px] text-muted"><strong className="font-semibold text-ink">{due}</strong> due today</span>
        <span className="text-[13px] text-muted">{set.folder}</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" role="tablist" aria-label="Game">
        {MODES.map((m) => (
          <button key={m.id} type="button" role="tab" aria-selected={mode === m.id} onClick={() => setMode(m.id)} className={cn('flex items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors', mode === m.id ? 'border-accent bg-accent-soft shadow-sm' : 'border-line bg-surface hover:border-line-strong/50')}>
            <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', mode === m.id ? 'bg-accent-fill text-white' : 'bg-surface-3 text-ink-2')}><Icon name={MODE_INFO[m.id].icon} className="size-4" /></span>
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-[14px] font-semibold">{m.label}{m.id === 'review' && due > 0 && <Badge tone="accent">{due} due</Badge>}</span>
              <span className="block text-[12px] leading-[18px] text-muted">{MODE_INFO[m.id].text}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="min-h-80 rounded-xl border border-line bg-surface p-6 max-sm:p-4">
        {set.cards.length ? <GameStage key={`${set.id}-${mode}`} set={set} mode={mode} /> : <Empty title="This set has no cards yet" action={<p className="text-[13px] text-muted">Add some under Manage cards, or pick a ready-made deck.</p>}>Games need at least a few cards to play.</Empty>}
      </div>
    </div>
  );
}

export function GamesPage({ embedded = false }: { embedded?: boolean } = {}) {
  // A review block on the calendar links here with ?set=<id> to open that set.
  useState(() => {
    const id = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('set') : null;
    if (id && useLearning.getState().sets.some((x) => x.id === id)) useLearning.getState().update({ selectedId: id });
    return id;
  });
  const sets = useLearning((s) => s.sets);
  const [tab, setTab] = useState<'play' | 'manage' | 'library'>('play');
  const totalDue = useMemo(() => sets.reduce((n, s) => n + s.cards.filter((c) => isDue(c)).length, 0), [sets]);
  return (
    <>
      {!embedded && <PageHeader title="Study games" action={<Badge tone="accent">Due today: {totalDue}</Badge>} />}
      <Tabs className="mb-4" label="Study games" value={tab} onChange={setTab} options={[{ value: 'play', label: 'Play', count: totalDue }, { value: 'manage', label: 'Manage cards' }, { value: 'library', label: 'Deck library' }]} />
      {tab === 'play' && <Play />}
      {tab === 'play' && <p className="mt-3 text-[13px] text-muted">Pop quizzes pick from these cards after your focus sessions. <button type="button" className="font-medium text-ink underline underline-offset-4" onClick={() => window.dispatchEvent(new Event('studytime:popquiz'))}>Try one now</button></p>}
      {tab === 'manage' && <SetManager />}
      {tab === 'library' && <DeckLibrary />}
    </>
  );
}
