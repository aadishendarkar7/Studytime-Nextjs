'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field, FieldRow, Input, Select, Textarea } from '@/components/ui/field';
import { Icon } from '@/components/ui/icons';
import { Segmented } from '@/components/ui/segmented';
import { api } from '@/lib/api';
import { useExtras } from '@/lib/stores/extras';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import { CATEGORIES, type EventView } from '@/lib/types';
import { useNow } from '@/lib/use-now';
import { uid } from '@/lib/utils';

const time = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
function dayLabel(ms: number, now: number) {
  const d = new Date(ms).toDateString();
  if (d === new Date(now).toDateString()) return 'Today';
  if (d === new Date(now + 86_400_000).toDateString()) return 'Tomorrow';
  return new Date(ms).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}
const localDate = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function CreateEvent({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const p = useProfile();
  const x = useExtras();
  const [f, setF] = useState(() => ({ title: '', course: p.courses[0] ?? '', category: 'Anything goes', place: '', date: localDate(Date.now() + 86_400_000), start: '18:00', end: '20:00', capacity: '', audience: (p.school ? 'school' : 'everyone') as 'school' | 'everyone', note: '' }));
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<typeof f>) => setF((v) => ({ ...v, ...patch }));
  const submit = async () => {
    const startsAt = new Date(`${f.date}T${f.start}`).getTime();
    let endsAt = new Date(`${f.date}T${f.end}`).getTime();
    if (endsAt <= startsAt) endsAt += 86_400_000;
    if (!f.title.trim() || !f.place.trim()) return toast('Add a title and a place.', 'error');
    setBusy(true);
    try {
      const r = await api.events.create({ host: p.name, title: f.title, course: f.course, category: f.category, place: f.place, startsAt, endsAt, capacity: f.capacity ? Number(f.capacity) : null, school: p.school, audience: f.audience, note: f.note });
      x.update({ myEvents: [...useExtras.getState().myEvents, r] });
      toast(f.audience === 'school' ? `Posted for students at ${p.school}.` : 'Posted for everyone.');
      onCreated();
      onClose();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} title="New study event">
      <Field label="Title" htmlFor="evTitle" className="mt-0"><Input id="evTitle" maxLength={80} value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="STAT400 midterm review" /></Field>
      <FieldRow>
        <Field label="Course" hint="optional" htmlFor="evCourse"><Input id="evCourse" list="evCourses" maxLength={60} value={f.course} onChange={(e) => set({ course: e.target.value })} /></Field>
        <Field label="Category" htmlFor="evCat"><Select id="evCat" value={f.category} onChange={(e) => set({ category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
      </FieldRow>
      <datalist id="evCourses">{p.courses.map((c) => <option key={c} value={c} />)}</datalist>
      <Field label="Where" htmlFor="evPlace"><Input id="evPlace" maxLength={100} value={f.place} onChange={(e) => set({ place: e.target.value })} placeholder="McKeldin Library, room 6107" /></Field>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <Field label="Date" htmlFor="evDate" className="mt-0"><Input id="evDate" type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} /></Field>
        <Field label="Starts" htmlFor="evStart" className="mt-0"><Input id="evStart" type="time" value={f.start} onChange={(e) => set({ start: e.target.value })} /></Field>
        <Field label="Ends" htmlFor="evEnd" className="mt-0"><Input id="evEnd" type="time" value={f.end} onChange={(e) => set({ end: e.target.value })} /></Field>
      </div>
      <FieldRow>
        <Field label="Spots" hint="optional" htmlFor="evCap"><Input id="evCap" type="number" min={2} max={200} value={f.capacity} onChange={(e) => set({ capacity: e.target.value })} placeholder="No limit" /></Field>
        <Field label="Who can see it">
          <Segmented className="[&>button]:flex-1" wrap={false} label="Who can see it" value={f.audience} onChange={(audience) => set({ audience })} options={[{ value: 'school', label: 'My school' }, { value: 'everyone', label: 'Everyone' }]} />
        </Field>
      </FieldRow>
      <Field label="Note" hint="optional" htmlFor="evNote"><Textarea id="evNote" rows={2} maxLength={300} value={f.note} onChange={(e) => set({ note: e.target.value })} placeholder="Bring past exams. We will go problem by problem." /></Field>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button loading={busy} onClick={submit}>Post event</Button>
      </div>
    </Dialog>
  );
}

function EventRow({ e, reload }: { e: EventView; reload: () => void }) {
  const p = useProfile();
  const x = useExtras();
  const now = useNow(60_000);
  const mine = x.myEvents.find((m) => m.id === e.id);
  const going = x.eventRsvps.find((r) => r.eventId === e.id);
  const full = e.capacity !== null && e.going.length >= e.capacity;
  const live = e.startsAt <= now && e.endsAt > now;
  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      reload();
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  };
  return (
    <li className="flex flex-wrap items-start gap-4 px-4 py-3.5">
      <div className="tnum w-24 shrink-0 text-[13px]">
        <p className="font-semibold">{time(e.startsAt)}</p>
        <p className="text-muted">{time(e.endsAt)}</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-[14px] font-semibold">{e.title}{live && <span className="inline-flex items-center gap-1 text-[12px] font-medium text-ok"><span className="size-1.5 rounded-full bg-ok" />Happening now</span>}</p>
        <p className="text-[13px] text-muted">{[e.course, e.category, e.place].filter(Boolean).join(' · ')}</p>
        <p className="mt-0.5 text-[12px] text-muted">Hosted by {mine ? 'you' : e.host} · {e.going.length}{e.capacity ? ` of ${e.capacity}` : ''} going{e.going.length ? `: ${e.going.slice(0, 4).map((g) => g.name).join(', ')}${e.going.length > 4 ? '…' : ''}` : ''}</p>
        {e.note && <p className="mt-1 text-[13px] text-ink-2">{e.note}</p>}
      </div>
      <div className="flex shrink-0 gap-1.5">
        <Button size="sm" variant="ghost" onClick={() => {
          if (x.studyBlocks.some((b) => b.href === `/drop?tab=events#${e.id}`)) return toast('Already on your calendar.');
          x.update({ studyBlocks: [...x.studyBlocks, { id: uid(), title: e.title, subject: e.course, start: e.startsAt, end: e.endsAt, source: 'manual', href: `/drop?tab=events#${e.id}`, done: false }] });
          toast('Added to your calendar.');
        }}>Add to calendar</Button>
        {mine ? (
          <Button size="sm" variant="danger" onClick={() => confirm('Cancel this event for everyone?') && act(async () => { await api.events.remove(e.id, mine.token); x.update({ myEvents: x.myEvents.filter((m) => m.id !== e.id) }); })}>Cancel event</Button>
        ) : going ? (
          <Button size="sm" variant="secondary" onClick={() => act(async () => { await api.events.cancel(e.id, going.rsvpId, going.token); x.update({ eventRsvps: x.eventRsvps.filter((r) => r.eventId !== e.id) }); })}><Icon name="check" className="size-4" /> Going</Button>
        ) : (
          <Button size="sm" disabled={full} onClick={() => act(async () => { const r = await api.events.rsvp(e.id, p.name); x.update({ eventRsvps: [...x.eventRsvps, { eventId: e.id, rsvpId: r.rsvpId, token: r.token }] }); toast(`You are going. ${e.host} can see your name.`); })}>{full ? 'Full' : 'RSVP'}</Button>
        )}
      </div>
    </li>
  );
}

/** Campus study events: planned group sessions with a time, place and RSVPs. */
export function EventsTab() {
  const school = useProfile((s) => s.school);
  const x = useExtras();
  const now = useNow(60_000);
  const [events, setEvents] = useState<EventView[] | null>(null);
  const [category, setCategory] = useState('all');
  const [mineOnly, setMineOnly] = useState(false);
  const [creating, setCreating] = useState(false);
  const load = useCallback(() => api.events.list(school).then((r) => setEvents(r.events)).catch((e) => (toast((e as Error).message, 'error'), setEvents([]))), [school]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    const id = setInterval(() => void load(), 60_000);
    return () => (clearTimeout(t), clearInterval(id));
  }, [load]);
  const shown = useMemo(() => (events ?? []).filter((e) => (category === 'all' || e.category === category) && (!mineOnly || x.myEvents.some((m) => m.id === e.id) || x.eventRsvps.some((r) => r.eventId === e.id))), [events, category, mineOnly, x.myEvents, x.eventRsvps]);
  const days = useMemo(() => {
    const m = new Map<string, EventView[]>();
    for (const e of shown) {
      const k = new Date(e.startsAt).toDateString();
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    return [...m.values()];
  }, [shown]);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select aria-label="Category" className="h-8 w-auto text-[13px]" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </Select>
        <Segmented wrap={false} label="Show" value={mineOnly ? 'mine' : 'all'} onChange={(v) => setMineOnly(v === 'mine')} options={[{ value: 'all', label: school ? `At ${school}` : 'All events' }, { value: 'mine', label: 'Going or hosting' }]} />
        <Button size="sm" className="ml-auto" onClick={() => setCreating(true)}><Icon name="plus" className="size-4" /> New event</Button>
      </div>
      {events === null ? <p className="text-[13px] text-muted">Loading events</p> : days.length ? days.map((list) => (
        <section key={list[0].id}>
          <h2 className="mb-2 font-sans text-[13px] font-semibold">{dayLabel(list[0].startsAt, now)}</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">{list.map((e) => <EventRow key={e.id} e={e} reload={load} />)}</ul>
        </section>
      )) : (
        <Empty title={category === 'all' && !mineOnly ? 'No study events yet' : 'Nothing matches'} action={<Button size="sm" onClick={() => setCreating(true)}>Post the first one</Button>}>
          Plan a review session, a quiet study block or a problem-set night, and students at {school || 'your school'} can RSVP.
        </Empty>
      )}
      {creating && <CreateEvent onClose={() => setCreating(false)} onCreated={load} />}
    </div>
  );
}

