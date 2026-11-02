'use client';
import { useEffect, useMemo, useState } from 'react';
import { Badge, PageHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Hero, HeroButton } from '@/components/ui/hero';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { Icon, type IconName } from '@/components/ui/icons';
import { Segmented } from '@/components/ui/segmented';
import { api } from '@/lib/api';
import { resolveConnection } from '@/lib/ai/client';
import { allFolders, DEFAULT_FOLDER, useLearning } from '@/lib/stores/learning';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import type { Deck, StudySet } from '@/lib/types';
import { cn } from '@/lib/utils';
import { activeCollections, COLLECTIONS, isActive, windowLabel, type Collection } from './collections';
import { STARTER_DECKS } from './decks';
import { GameStage, type Mode } from './modes';
import { isDue } from './srs';
import { askConfirm, askText } from '@/lib/stores/ask';
import { moreCards, NewSet } from './new-set';

/** Adds every deck in a collection you have not added yet. */
function addCollection(c: Collection) {
  const l = useLearning.getState();
  const fresh = c.decks.filter((d) => !l.sets.some((s) => s.sourceDeck === d.id));
  for (const d of fresh) l.addSet(d.name, d.cards, c.title, d.id);
  toast(fresh.length ? `${c.mark} Added ${fresh.length} deck${fresh.length === 1 ? '' : 's'} from ${c.title}.` : 'You already have these decks.');
  return fresh.length;
}

/** Special collections that are live right now, shown above your sets. */
function CollectionBanner() {
  const sets = useLearning((s) => s.sets);
  const live = activeCollections();
  if (!live.length) return null;
  return (
    <div className="grid gap-2">
      {live.map((c) => {
        const have = c.decks.every((d) => sets.some((s) => s.sourceDeck === d.id));
        return (
          <section key={c.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-accent/30 bg-accent-soft px-4 py-3">
            <span className="text-[28px] leading-none" aria-hidden="true">{c.mark}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-accent-ink">Special collection, until {windowLabel(c).split(' to ')[1]}</p>
              <p className="text-[15px] font-semibold">{c.title}</p>
              <p className="text-[13px] text-ink-2">{c.blurb} {c.decks.map((d) => d.name).join(', ')}.</p>
            </div>
            <Button size="sm" variant={have ? 'secondary' : 'primary'} disabled={have} onClick={() => addCollection(c)}>{have ? 'Added' : `Add ${c.decks.length} deck${c.decks.length === 1 ? '' : 's'}`}</Button>
          </section>
        );
      })}
    </div>
  );
}

function CollectionsTab({ onAdded }: { onAdded?: () => void }) {
  const sets = useLearning((s) => s.sets);
  const list = [...COLLECTIONS].sort((a, b) => Number(isActive(b)) - Number(isActive(a)));
  return (
    <div className="mt-4 grid max-h-[60vh] gap-3 overflow-y-auto">
      {list.map((c) => {
        const live = isActive(c);
        const have = c.decks.every((d) => sets.some((s) => s.sourceDeck === d.id));
        return (
          <article key={c.id} className={cn('flex items-start gap-3 rounded-xl border p-4', live ? 'border-accent/40 bg-accent-soft' : 'border-line')}>
            <span className="text-[24px] leading-none" aria-hidden="true">{c.mark}</span>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold">{c.title}</h3>
              <p className="text-[13px] text-muted">{live ? 'Available now' : `Comes back ${windowLabel(c)}`}, {c.decks.reduce((n, d) => n + d.cards.length, 0)} cards</p>
              <p className="mt-1 text-[13px] text-ink-2">{c.blurb}</p>
            </div>
            <Button size="sm" variant="secondary" disabled={!live || have} onClick={() => addCollection(c) && onAdded?.()}>{have ? 'Added' : live ? 'Add' : 'Locked'}</Button>
          </article>
        );
      })}
    </div>
  );
}

function DeckLibrary({ onAdded }: { onAdded?: () => void }) {
  const l = useLearning();
  const [tab, setTab] = useState<'starter' | 'shared' | 'special'>(() => (activeCollections().length ? 'special' : 'starter'));
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
        <Segmented value={tab} onChange={setTab} options={[{ value: 'special', label: 'Special collections' }, { value: 'starter', label: 'Starter' }, { value: 'shared', label: 'From students' }]} />
        {tab !== 'special' && <Input className="h-9 min-w-40 flex-1" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search decks" aria-label="Search decks" />}
      </div>
      {tab === 'special' ? <CollectionsTab onAdded={onAdded} /> : (
      <div className="mt-4 grid max-h-[60vh] gap-3 overflow-y-auto sm:grid-cols-2">
        {tab === 'shared' && shared === null ? <p className="text-sm text-muted">Loading…</p> : decks.length ? decks.map((d) => {
          const added = l.sets.some((s) => s.sourceDeck === d.id);
          return (
            <article key={d.id} className="flex flex-col gap-1.5 border border-line p-4 rounded-xl">
              <Badge className="self-start">{d.subject || 'General'}</Badge>
              <h3 className="mt-1 font-semibold">{d.name}</h3>
              <p className="text-[13px] text-muted">{d.cards.length} cards{d.author ? `, by ${d.author}` : ''}</p>
              <p className="flex-1 text-xs text-muted">{d.cards.slice(0, 3).map((c) => c.front).join(', ')}</p>
              <Button variant="secondary" className="mt-2" onClick={async () => {
                if (added && !await askConfirm('You already added this deck. Add another copy?')) return;
                l.addSet(d.name, d.cards, d.subject || DEFAULT_FOLDER, d.id);
                toast(`“${d.name}” added.`);
                onAdded?.();
              }}>{added ? 'Added' : 'Add'}</Button>
            </article>
          );
        }) : <p className="text-sm text-muted sm:col-span-2">{tab === 'shared' ? 'No shared decks yet' : 'No matches'}</p>}
      </div>
      )}
    </div>
  );
}

const dueIn = (set: StudySet) => set.cards.filter((c) => isDue(c)).length;

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
    if (!await askConfirm(`Share “${set.name}” with everyone on Brainwick?`)) return;
    try {
      await api.decks.share({ name: set.name, subject: set.folder === DEFAULT_FOLDER ? '' : set.folder, author: useProfile.getState().name, cards: set.cards.map(({ front, back }) => ({ front, back })) });
      toast('Shared.');
      window.dispatchEvent(new Event('studytime:decks'));
    } catch (error) {
      toast((error as Error).message, 'error');
    }
  };
  const [more, setMore] = useState(false);
  const addMore = async () => {
    if (resolveConnection().mode === 'none') return toast('The AI tutor is not set up on this site yet.', 'error');
    setMore(true);
    try {
      const cards = await moreCards(set.name, set.cards);
      const have = new Set(set.cards.map((c) => c.front.trim().toLowerCase()));
      const fresh = cards.filter((c) => !have.has(c.front.trim().toLowerCase()));
      l.addCards(set.id, fresh);
      toast(`${fresh.length} new cards added.`);
    } catch (error) {
      toast((error as Error).message, 'error');
    } finally {
      setMore(false);
    }
  };
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-3 rounded-[10px] border border-line bg-surface-2 px-3 py-2.5">
        <Icon name="sparkle" className="size-4 shrink-0 text-accent-ink" />
        <p className="min-w-0 flex-1 text-[13px] text-ink-2">Let the AI add cards this set is missing.</p>
        <Button size="sm" variant="secondary" loading={more} onClick={() => void addMore()}>Add 10 more</Button>
      </div>
      <form className="flex flex-wrap gap-2" onSubmit={(e) => (e.preventDefault(), add())}>
        <Input className="min-w-36 flex-1" maxLength={180} value={front} onChange={(e) => setFront(e.target.value)} placeholder="Front" aria-label="Front" />
        <Input className="min-w-36 flex-1" maxLength={180} value={back} onChange={(e) => setBack(e.target.value)} placeholder="Back" aria-label="Back" />
        <Button type="submit" variant="secondary" disabled={!front.trim() || !back.trim()}>Add</Button>
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
        <Select aria-label="Folder" className="h-8 w-auto text-[13px]" value={set.folder} onChange={async (e) => {
          let folder = e.target.value;
          if (folder === '__new') {
            folder = ((await askText('New folder', { placeholder: 'Folder name, like BIO 101', ok: 'Create' })) || '').trim().slice(0, 40);
            if (!folder) return;
            l.addFolder(folder);
          }
          l.updateSet(set.id, { folder });
        }}>
          {folders.map((f) => <option key={f}>{f}</option>)}
          <option value="__new">New folder…</option>
        </Select>
        <Button size="sm" variant="ghost" onClick={async () => { const n = (await askText('Rename set', { value: set.name }))?.trim(); if (n) l.updateSet(set.id, { name: n.slice(0, 60) }); }}>Rename</Button>
        <Button size="sm" variant="ghost" onClick={share}>Share</Button>
        <Button size="sm" variant="ghost" className="ml-auto text-danger" onClick={async () => await askConfirm(`Delete “${set.name}”?`) && l.deleteSet(set.id)}>Delete set</Button>
      </div>
    </div>
  );
}

/** One open set: pick how to study it, or edit its cards. */
type Play = 'cards' | 'quiz' | 'blank' | 'matching' | 'speed';
const PLAY: { id: Play; label: string; icon: IconName }[] = [
  { id: 'cards', label: 'Flip cards', icon: 'games' },
  { id: 'quiz', label: 'Quiz', icon: 'check' },
  { id: 'blank', label: 'Type it', icon: 'pen' },
  { id: 'matching', label: 'Match', icon: 'layers' },
  { id: 'speed', label: 'Speed round', icon: 'flame' },
];

/** One open set: three ways to study it, and an Edit button. */
function SetView({ set, onBack }: { set: StudySet; onBack: () => void }) {
  const due = dueIn(set);
  const [play, setPlay] = useState<Play>('cards');
  const [editing, setEditing] = useState(!set.cards.length);
  // Flip cards uses spaced review when cards are due, otherwise flips through the whole set.
  const mode: Mode = play === 'cards' ? (due ? 'review' : 'flashcards') : play;
  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3">
        <Button size="sm" variant="ghost" aria-label="All sets" onClick={onBack}><Icon name="chevron" className="size-4 rotate-180" /></Button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[20px] leading-7">{set.name}</h2>
          <p className="tnum text-[13px] text-muted">{set.cards.length} cards{due ? `, ${due} to review` : ''}</p>
        </div>
        <Button variant="secondary" onClick={() => setEditing(true)}>Edit cards</Button>
      </div>
      <div role="tablist" aria-label="How to study" className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {PLAY.map((m) => (
          <button key={m.id} type="button" role="tab" aria-selected={play === m.id} disabled={!set.cards.length || (m.id !== 'cards' && set.cards.length < 4)} onClick={() => setPlay(m.id)} className={cn('flex items-center justify-center gap-2 rounded-xl border py-3 text-[14px] font-semibold transition-colors disabled:opacity-40', play === m.id ? 'border-ink bg-surface-3 text-ink' : 'border-line bg-surface text-ink-2 hover:border-ink/30')}>
            <Icon name={m.icon} className="size-[18px]" /> {m.label}
          </button>
        ))}
      </div>
      <div className="min-h-72 panel p-5 max-sm:p-4">
        {set.cards.length ? <GameStage key={`${set.id}-${mode}`} set={set} mode={mode} /> : (
          <div className="grid place-items-center py-10 text-center">
            <p className="text-[15px] font-semibold">No cards yet</p>
            <Button className="mt-3" onClick={() => setEditing(true)}>Add cards</Button>
          </div>
        )}
      </div>
      <Dialog open={editing} onClose={() => setEditing(false)} title={`Edit ${set.name}`}>
        {editing && <EditCards set={set} />}
      </Dialog>
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
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const removePicked = async () => {
    if (!picked.length || !await askConfirm(`Delete ${picked.length} set${picked.length === 1 ? '' : 's'}? This cannot be undone.`)) return;
    picked.forEach((id) => l.deleteSet(id));
    toast(`Deleted ${picked.length} set${picked.length === 1 ? '' : 's'}.`);
    setPicked([]);
    setSelecting(false);
  };
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
          {/* Spaced review is the point of flashcards, so what is due gets the spotlight. */}
          {totalDue > 0 ? (
            <Hero
              title={`${totalDue} ${totalDue === 1 ? 'card is' : 'cards are'} due today`}
              sub="A few minutes now and they stick for weeks. Cards you get right come back later; the ones you miss come back sooner."
              action={<HeroButton onClick={() => { const first = shown.find((x) => dueIn(x) > 0); if (first) go(first.id); }}>Review now</HeroButton>}
            />
          ) : l.sets.length === 0 ? (
            <Hero title="Make your first flashcard set" sub="Upload slides, snap a page or pick one of your notes. The AI writes the cards." action={<HeroButton onClick={() => setPanel('new')}>New set</HeroButton>} />
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => setPanel('new')}>New set</Button>
            <Button variant="secondary" onClick={() => setPanel('decks')}>Browse decks</Button>
            {l.sets.length > 0 && <Button variant="ghost" onClick={() => (setSelecting(!selecting), setPicked([]))}>{selecting ? 'Cancel' : 'Select'}</Button>}
            {selecting && <Button variant="danger" disabled={!picked.length} onClick={removePicked}>Delete {picked.length || ''}</Button>}
            {selecting && <Button variant="ghost" onClick={() => setPicked(picked.length === shown.length ? [] : shown.map((s) => s.id))}>{picked.length === shown.length ? 'Select none' : 'Select all'}</Button>}
            
            {folders.length > 1 && (
              <Select aria-label="Folder" className={cn('h-9 w-auto text-[13px]', 'ml-auto')} value={folder} onChange={(e) => setFolder(e.target.value)}>
                <option value="all">All folders</option>
                {folders.map((f) => <option key={f}>{f}</option>)}
              </Select>
            )}
          </div>
          <CollectionBanner />
          <Dialog open={panel === 'new'} onClose={() => setPanel(null)} title="New flashcard set">
            {panel === 'new' && <NewSet onDone={go} />}
          </Dialog>
          <Dialog open={panel === 'decks'} onClose={() => setPanel(null)} title="Ready-made decks">
            {panel === 'decks' && <DeckLibrary onAdded={() => setPanel(null)} />}
          </Dialog>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((s) => {
              const due = dueIn(s);
              return (
                <li key={s.id} className={cn('relative flex flex-col panel p-4 transition-colors hover:border-ink/25', selecting && picked.includes(s.id) && 'border-ink bg-surface-3')}>
                  {selecting ? (
                    <input type="checkbox" aria-label={`Select ${s.name}`} checked={picked.includes(s.id)} onChange={() => toggle(s.id)} className="absolute top-3 right-3 size-5" />
                  ) : (
                    <button type="button" aria-label={`Delete ${s.name}`} title="Delete set" onClick={async () => await askConfirm(`Delete “${s.name}”?`) && (l.deleteSet(s.id), toast('Set deleted.'))} className="absolute top-2.5 right-2.5 grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-3 hover:text-danger"><Icon name="trash" className="size-4" /></button>
                  )}
                  <button type="button" onClick={() => (selecting ? toggle(s.id) : go(s.id))} className="grid min-w-0 pr-8 text-left">
                    <span className="text-[12px] text-muted">{s.folder}</span>
                    <strong className="mt-0.5 line-clamp-2 text-[16px] leading-6 font-semibold">{s.name}</strong>
                    <span className="mt-1 line-clamp-1 text-[13px] text-muted">{s.cards.slice(0, 3).map((c) => c.front).join(', ') || 'No cards yet'}</span>
                  </button>
                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
                    <span className="tnum flex-1 text-[13px] whitespace-nowrap text-muted">{s.cards.length} cards</span>
                    {due > 0 && <Badge tone="accent">{due} due</Badge>}
                    <Button size="sm" onClick={() => go(s.id)}>Study</Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}
