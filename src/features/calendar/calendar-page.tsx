'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, FieldRow, Input, Select } from '@/components/ui/field';
import { Icon } from '@/components/ui/icons';
import { Segmented } from '@/components/ui/segmented';
import { Sheet } from '@/components/ui/sheet';
import { Breakdown } from '@/features/planner/breakdown';
import { ReminderForm, ReminderList } from '@/features/planner/planner-page';
import { SyllabusImport } from '@/features/planner/syllabus-import';
import { useExtras } from '@/lib/stores/extras';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import type { ReminderType } from '@/lib/types';
import { useNow } from '@/lib/use-now';
import { cn, uid } from '@/lib/utils';
import { useStartBlock } from './block-row';
import { startOfDay } from './plan';
import { ExamPrepCard } from './exam-prep-card';
import { RoutineCard } from './routine-card';
import { ConnectCard, CrunchCard, PlanCard, ReviewCard, SubscribeCard } from './tools';

type View = 'day' | 'week' | 'month';
type Kind = 'event' | 'block' | 'due';
interface Item { key: string; id: string; kind: Kind; title: string; start: number; end: number; allDay: boolean; color: string; sub: string; done?: boolean }

const HOUR = 52;
const DAY = 86_400_000;
const addDays = (ms: number, n: number) => startOfDay(ms + n * DAY + DAY / 2);
const sunday = (ms: number) => addDays(ms, -new Date(ms).getDay());
const fmt = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const sameDay = (a: number, b: number) => startOfDay(a) === startOfDay(b);
const toInputDate = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const toInputTime = (ms: number) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

function useItems() {
  const { calendarFeeds, studyBlocks, hiddenCalendars } = useExtras();
  const reminders = useProfile((s) => s.reminders);
  return useMemo<Item[]>(() => {
    const hidden = new Set(hiddenCalendars);
    const out: Item[] = [];
    for (const f of calendarFeeds) {
      if (hidden.has(f.id)) continue;
      for (const e of f.events) out.push({ key: `${f.id}${e.uid}`, id: e.uid, kind: 'event', title: e.title, start: e.start, end: e.end, allDay: e.allDay || e.end - e.start <= 60_000, color: f.color, sub: e.location || f.name });
    }
    if (!hidden.has('blocks')) for (const b of studyBlocks) out.push({ key: b.id, id: b.id, kind: 'block', title: b.title, start: b.start, end: b.end, allDay: false, color: 'var(--accent-fill)', sub: 'Study block', done: b.done });
    if (!hidden.has('deadlines')) for (const r of reminders) if (!r.done) out.push({ key: r.id, id: r.id, kind: 'due', title: r.title, start: r.dueAt, end: r.dueAt, allDay: true, color: 'var(--danger)', sub: `Due ${fmt(r.dueAt)}` });
    return out;
  }, [calendarFeeds, studyBlocks, hiddenCalendars, reminders]);
}

/** Side-by-side columns for overlapping events, like Apple and Google Calendar. */
function lanes(items: Item[]) {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const placed: { item: Item; col: number; cols: number }[] = [];
  let cluster: { item: Item; col: number }[] = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    const cols = Math.max(1, ...cluster.map((c) => c.col + 1));
    for (const c of cluster) placed.push({ ...c, cols });
    cluster = [];
  };
  for (const item of sorted) {
    if (item.start >= clusterEnd) {
      flush();
      clusterEnd = -Infinity;
    }
    const taken = new Set(cluster.filter((c) => c.item.end > item.start).map((c) => c.col));
    let col = 0;
    while (taken.has(col)) col++;
    cluster.push({ item, col });
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  flush();
  return placed;
}

function MiniMonth({ anchor, onPick, today }: { anchor: number; onPick: (ms: number) => void; today: number }) {
  const [month, setMonth] = useState(() => { const d = new Date(anchor); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); });
  const start = sunday(month);
  const m = new Date(month).getMonth();
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <strong className="text-[14px] font-semibold">{new Date(month).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</strong>
        <span className="flex">
          <button type="button" aria-label="Previous month" onClick={() => setMonth(new Date(new Date(month).getFullYear(), new Date(month).getMonth() - 1, 1).getTime())} className="grid size-7 place-items-center rounded-md hover:bg-surface-3"><Icon name="chevron" className="size-3.5 rotate-180" /></button>
          <button type="button" aria-label="Next month" onClick={() => setMonth(new Date(new Date(month).getFullYear(), new Date(month).getMonth() + 1, 1).getTime())} className="grid size-7 place-items-center rounded-md hover:bg-surface-3"><Icon name="chevron" className="size-3.5" /></button>
        </span>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] text-muted">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i} className="py-1">{d}</span>)}</div>
      <div className="grid grid-cols-7 text-center text-[12px]">
        {Array.from({ length: 42 }, (_, i) => {
          const d = addDays(start, i);
          const inMonth = new Date(d).getMonth() === m;
          return (
            <button key={d} type="button" onClick={() => onPick(d)} className={cn('tnum mx-auto grid size-7 place-items-center rounded-full', d === today ? 'bg-accent-fill font-semibold text-white' : sameDay(d, anchor) ? 'bg-accent-soft font-semibold text-accent-ink' : inMonth ? 'text-ink hover:bg-surface-3' : 'text-muted/60 hover:bg-surface-3')}>
              {new Date(d).getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TimeGrid({ days, items, today, now, onCreate, onOpen }: { days: number[]; items: Item[]; today: number; now: number; onCreate: (ms: number) => void; onOpen: (i: Item) => void }) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Open scrolled to an hour before now, or 8 AM.
    const h = new Date().getHours();
    scroller.current?.scrollTo({ top: Math.max(0, (h >= 7 && h <= 21 ? h - 1 : 8) * HOUR) });
  }, []);
  const allDay = (d: number) => items.filter((i) => i.allDay && sameDay(i.start, d));
  const timed = (d: number) => items.filter((i) => !i.allDay && i.start < addDays(d, 1) && i.end > d);
  const nowTop = ((now - startOfDay(now)) / 3_600_000) * HOUR;
  const cols = `52px repeat(${days.length}, minmax(0, 1fr))`;
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="grid border-b border-line" style={{ gridTemplateColumns: cols }}>
        <span />
        {days.map((d) => (
          <div key={d} className="border-l border-line px-1.5 pt-2 pb-1.5 text-center">
            <p className="text-[12px] font-medium text-muted uppercase">{new Date(d).toLocaleDateString(undefined, { weekday: 'short' })}</p>
            <p className={cn('tnum mx-auto mt-0.5 grid size-9 place-items-center rounded-full text-[20px]', d === today ? 'bg-accent-fill font-semibold text-white' : 'text-ink')}>{new Date(d).getDate()}</p>
            <div className="mt-1 grid gap-0.5">
              {allDay(d).slice(0, 3).map((i) => (
                <button key={i.key} type="button" onClick={() => onOpen(i)} title={i.title} className="truncate rounded-md px-1.5 py-0.5 text-left text-[12px] font-medium text-white" style={{ background: i.color }}>{i.kind === 'due' ? `Due: ${i.title}` : i.title}</button>
              ))}
              {allDay(d).length > 3 && <span className="text-[11px] text-muted">+{allDay(d).length - 3} more</span>}
            </div>
          </div>
        ))}
      </div>
      <div ref={scroller} className="relative h-[min(68vh,680px)] overflow-y-auto">
        <div className="grid" style={{ gridTemplateColumns: cols }}>
          <div>{Array.from({ length: 24 }, (_, h) => <div key={h} className="tnum relative pr-2 text-right text-[11px] text-muted" style={{ height: HOUR }}><span className="relative -top-2">{h ? new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: 'numeric' }) : ''}</span></div>)}</div>
          {days.map((d) => (
            <div
              key={d}
              className="relative cursor-cell border-l border-line"
              style={{ height: 24 * HOUR, backgroundImage: 'linear-gradient(var(--line) 1px, transparent 1px)', backgroundSize: `100% ${HOUR}px` }}
              onClick={(e) => {
                if (e.target !== e.currentTarget) return;
                const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
                const minutes = Math.floor((y / HOUR) * 4) * 15;
                onCreate(d + minutes * 60_000);
              }}
            >
              {lanes(timed(d)).map(({ item: i, col, cols: n }) => {
                const top = Math.max(0, ((Math.max(i.start, d) - d) / 3_600_000) * HOUR);
                const bottom = Math.min(24 * HOUR, ((Math.min(i.end, addDays(d, 1)) - d) / 3_600_000) * HOUR);
                const h = Math.max(20, bottom - top - 2);
                return (
                  <button
                    key={i.key}
                    type="button"
                    onClick={() => onOpen(i)}
                    title={`${i.title}, ${fmt(i.start)} to ${fmt(i.end)}`}
                    className={cn('absolute overflow-hidden rounded-lg px-1.5 py-1 text-left text-[12px] leading-4 transition-shadow hover:shadow-md', i.kind === 'block' ? 'border-l-[3px] border-accent bg-accent-soft text-accent-ink' : 'text-white', i.done && 'opacity-50 line-through')}
                    style={{ top: top + 1, height: h, left: `calc(${(col / n) * 100}% + 2px)`, width: `calc(${100 / n}% - 4px)`, background: i.kind === 'block' ? undefined : i.color }}
                  >
                    <strong className="block truncate font-semibold">{i.title}</strong>
                    {h > 36 && <span className="block truncate opacity-90">{fmt(i.start)}{i.sub && h > 52 ? ` · ${i.sub}` : ''}</span>}
                  </button>
                );
              })}
              {d === today && (
                <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: nowTop }}>
                  <span className="absolute -top-[5px] -left-[5px] size-2.5 rounded-full bg-danger" />
                  <span className="block h-0.5 bg-danger" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MonthGrid({ anchor, items, today, onDay, onOpen }: { anchor: number; items: Item[]; today: number; onDay: (ms: number) => void; onOpen: (i: Item) => void }) {
  const first = new Date(new Date(anchor).getFullYear(), new Date(anchor).getMonth(), 1).getTime();
  const start = sunday(first);
  const m = new Date(first).getMonth();
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="grid grid-cols-7 border-b border-line text-center text-[12px] font-medium text-muted uppercase">{Array.from({ length: 7 }, (_, i) => <span key={i} className="py-2">{new Date(addDays(start, i)).toLocaleDateString(undefined, { weekday: 'short' })}</span>)}</div>
      <div className="grid grid-cols-7">
        {Array.from({ length: 42 }, (_, i) => {
          const d = addDays(start, i);
          const list = items.filter((x) => (x.allDay ? sameDay(x.start, d) : x.start < addDays(d, 1) && x.end > d)).sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start - b.start);
          return (
            <div key={d} className={cn('min-h-28 border-r border-b border-line p-1.5 max-sm:min-h-20 [&:nth-child(7n)]:border-r-0', new Date(d).getMonth() !== m && 'bg-surface-2')}>
              <button type="button" onClick={() => onDay(d)} className={cn('tnum grid size-7 place-items-center rounded-full text-[13px]', d === today ? 'bg-accent-fill font-semibold text-white' : new Date(d).getMonth() === m ? 'hover:bg-surface-3' : 'text-muted')}>{new Date(d).getDate()}</button>
              <div className="mt-0.5 grid gap-0.5">
                {list.slice(0, 3).map((x) => (
                  <button key={x.key} type="button" onClick={() => onOpen(x)} className="flex min-w-0 items-center gap-1 rounded px-1 text-left text-[12px] leading-5 hover:bg-surface-3">
                    <span className="size-2 shrink-0 rounded-full" style={{ background: x.color }} />
                    <span className="truncate max-sm:hidden">{x.allDay ? '' : `${fmt(x.start).replace(':00', '')} `}{x.title}</span>
                  </button>
                ))}
                {list.length > 3 && <button type="button" onClick={() => onDay(d)} className="px-1 text-left text-[11px] font-medium text-muted hover:text-ink">+{list.length - 3} more</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CreateDialog({ at, onClose }: { at: number; onClose: () => void }) {
  const x = useExtras();
  const addReminder = useProfile((s) => s.addReminder);
  const [kind, setKind] = useState<'block' | 'due'>('block');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(toInputDate(at));
  const [from, setFrom] = useState(toInputTime(at));
  const [to, setTo] = useState(toInputTime(at + 60 * 60_000));
  const [type, setType] = useState<ReminderType>('assignment');
  const save = () => {
    if (!title.trim()) return toast('Give it a title.', 'error');
    const start = new Date(`${date}T${from}`).getTime();
    if (kind === 'block') {
      const end = new Date(`${date}T${to}`).getTime();
      if (!(end > start)) return toast('The end has to be after the start.', 'error');
      x.update({ studyBlocks: [...x.studyBlocks, { id: uid(), title: title.trim().slice(0, 120), subject: title.trim().slice(0, 60), start, end, source: 'manual' as const, done: false }].sort((a, b) => a.start - b.start) });
      toast('Study block added.');
    } else {
      addReminder({ title: title.trim().slice(0, 120), type, dueAt: start, lead: type === 'exam' ? 2880 : 1440 });
      toast('Deadline added.');
    }
    onClose();
  };
  return (
    <Dialog open onClose={onClose} title="New">
      <Segmented className="[&>button]:flex-1" wrap={false} label="Type" value={kind} onChange={setKind} options={[{ value: 'block', label: 'Study block' }, { value: 'due', label: 'Deadline' }]} />
      <Field label="Title" htmlFor="newTitle"><Input id="newTitle" autoFocus maxLength={120} value={title} placeholder={kind === 'block' ? 'Review chapter 5' : 'STAT400 homework 6'} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} /></Field>
      <FieldRow>
        <Field label="Date" htmlFor="newDate"><Input id="newDate" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        {kind === 'due' ? (
          <Field label="Type" htmlFor="newType"><Select id="newType" value={type} onChange={(e) => setType(e.target.value as ReminderType)}><option value="homework">Homework</option><option value="assignment">Assignment</option><option value="exam">Exam</option></Select></Field>
        ) : <span />}
      </FieldRow>
      <FieldRow>
        <Field label={kind === 'block' ? 'Starts' : 'Due at'} htmlFor="newFrom"><Input id="newFrom" type="time" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        {kind === 'block' && <Field label="Ends" htmlFor="newTo"><Input id="newTo" type="time" value={to} onChange={(e) => setTo(e.target.value)} /></Field>}
      </FieldRow>
      <div className="mt-5 flex gap-2"><Button onClick={save}>Save</Button><Button variant="ghost" onClick={onClose}>Cancel</Button></div>
    </Dialog>
  );
}

function EventDialog({ item, onClose }: { item: Item; onClose: () => void }) {
  const x = useExtras();
  const p = useProfile();
  const start = useStartBlock();
  const block = item.kind === 'block' ? x.studyBlocks.find((b) => b.id === item.id) : undefined;
  const when = item.kind === 'due' ? `Due ${new Date(item.start).toLocaleString(undefined, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
    : item.allDay ? new Date(item.start).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
    : `${new Date(item.start).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}, ${fmt(item.start)} to ${fmt(item.end)}`;
  return (
    <Dialog open onClose={onClose} title={item.title}>
      <div className="flex items-start gap-3">
        <span className="mt-1.5 size-3 shrink-0 rounded-full" style={{ background: item.color }} />
        <div className="text-[15px] leading-6">
          <p>{when}</p>
          <p className="text-muted">{item.kind === 'event' ? item.sub : item.kind === 'block' ? 'Study block' : 'Deadline in your planner'}</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {block && !block.done && <Button onClick={() => (start(block), onClose())}>{block.href ? 'Review now' : 'Start studying'}</Button>}
        {block && <Button variant="secondary" onClick={() => (x.update({ studyBlocks: x.studyBlocks.map((b) => (b.id === block.id ? { ...b, done: !b.done } : b)) }), onClose())}>{block.done ? 'Mark not done' : 'Mark done'}</Button>}
        {block && <Button variant="danger" onClick={() => (x.update({ studyBlocks: x.studyBlocks.filter((b) => b.id !== block.id) }), onClose())}>Delete</Button>}
        {item.kind === 'due' && <Button variant="secondary" onClick={() => (p.setReminderDone(item.id, true), toast('Marked done.'), onClose())}>Mark done</Button>}
        {item.kind === 'due' && <Button variant="danger" onClick={() => (p.deleteReminder(item.id), onClose())}>Delete</Button>}
        {item.kind === 'event' && <Button variant="secondary" onClick={onClose}>Close</Button>}
      </div>
    </Dialog>
  );
}

type PlanTab = 'routine' | 'suggest' | 'deadlines' | 'syllabus' | 'breakdown' | 'exams' | 'busy' | 'calendars';
const PLAN_TABS: { value: PlanTab; label: string }[] = [
  { value: 'routine', label: 'Weekly routine' },
  { value: 'exams', label: 'Exam prep' },
  { value: 'suggest', label: 'Deadlines plan' },
  { value: 'deadlines', label: 'Deadlines' },
  { value: 'syllabus', label: 'Import syllabus' },
  { value: 'breakdown', label: 'Break it down' },
  { value: 'busy', label: 'Busy weeks' },
  { value: 'calendars', label: 'Connect calendars' },
];

export function CalendarPage() {
  const x = useExtras();
  const items = useItems();
  const now = useNow(60_000);
  const today = startOfDay(now);
  const [view, setView] = useState<View>(() => (typeof window !== 'undefined' && window.innerWidth < 768 ? 'day' : x.calendarView));
  const [anchor, setAnchor] = useState(() => startOfDay(Date.now()));
  const [creating, setCreating] = useState<number | null>(null);
  const [opened, setOpened] = useState<Item | null>(null);
  const [examParam] = useState(() => (typeof location !== 'undefined' ? new URLSearchParams(location.search).get('exam') : null));
  const [plan, setPlan] = useState<PlanTab | null>(() => {
    const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('plan') : null;
    return PLAN_TABS.some((t) => t.value === q) ? (q as PlanTab) : null;
  });

  const changeView = (v: View) => (setView(v), x.update({ calendarView: v }));
  const step = (dir: number) => setAnchor((a) => (view === 'day' ? addDays(a, dir) : view === 'week' ? addDays(a, 7 * dir) : startOfDay(new Date(new Date(a).getFullYear(), new Date(a).getMonth() + dir, 1).getTime())));
  const days = view === 'day' ? [anchor] : Array.from({ length: 7 }, (_, i) => addDays(sunday(anchor), i));
  const title = view === 'month'
    ? new Date(anchor).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : view === 'week'
      ? (() => { const a = new Date(days[0]); const b = new Date(days[6]); return a.getMonth() === b.getMonth() ? a.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : `${a.toLocaleDateString(undefined, { month: 'short' })} to ${b.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`; })()
      : new Date(anchor).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  const toggle = (id: string) => x.update({ hiddenCalendars: x.hiddenCalendars.includes(id) ? x.hiddenCalendars.filter((h) => h !== id) : [...x.hiddenCalendars, id] });
  const calendars = [
    { id: 'blocks', name: 'Study blocks', color: 'var(--accent-fill)' },
    { id: 'deadlines', name: 'Deadlines', color: 'var(--danger)' },
    ...x.calendarFeeds.map((f) => ({ id: f.id, name: f.name, color: f.color })),
  ];

  // Keyboard shortcuts like Apple and Google: t = today, d/w/m = view, arrows = move.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable], dialog')) return;
      if (e.key === 't') setAnchor(startOfDay(Date.now()));
      else if (e.key === 'd') changeView('day');
      else if (e.key === 'w') changeView('week');
      else if (e.key === 'm') changeView('month');
      else if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <>
      <div className="mt-6 grid gap-5 max-sm:mt-4 lg:grid-cols-[240px_minmax(0,1fr)] [&>*]:min-w-0">
        <aside className="hidden content-start gap-6 lg:grid">
          <Button size="lg" onClick={() => setCreating(Date.now() + 60 * 60_000 - (Date.now() % (15 * 60_000)))}><Icon name="plus" className="size-4" /> Create</Button>
          <MiniMonth anchor={anchor} today={today} onPick={setAnchor} />
          <div>
            <p className="mb-2 text-[13px] font-semibold text-muted">My calendars</p>
            <ul className="grid gap-0.5">
              {calendars.map((c) => {
                const on = !x.hiddenCalendars.includes(c.id);
                return (
                  <li key={c.id}>
                    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[14px] hover:bg-surface-3">
                      <input type="checkbox" checked={on} onChange={() => toggle(c.id)} className="sr-only" />
                      <span className="grid size-4 place-items-center rounded" style={{ background: on ? c.color : 'transparent', border: `2px solid ${c.color}` }}>{on && <Icon name="check" className="size-3 text-white" />}</span>
                      <span className="truncate">{c.name}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <Button variant="link" size="sm" className="mt-1 ml-2" onClick={() => setPlan('calendars')}>+ Add Google or Canvas</Button>
          </div>
        </aside>

        <section>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => setAnchor(today)}>Today</Button>
            <span className="flex">
              <button type="button" aria-label="Previous" onClick={() => step(-1)} className="grid size-10 place-items-center rounded-full hover:bg-surface-3"><Icon name="chevron" className="size-4 rotate-180" /></button>
              <button type="button" aria-label="Next" onClick={() => step(1)} className="grid size-10 place-items-center rounded-full hover:bg-surface-3"><Icon name="chevron" className="size-4" /></button>
            </span>
            <h1 className="mr-auto text-[26px] leading-8 max-sm:text-[21px]">{title}</h1>
            <Segmented wrap={false} label="View" value={view} onChange={changeView} options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]} />
            <Button onClick={() => setPlan(x.calendarFeeds.length ? 'routine' : 'calendars')}><Icon name="sparkle" className="size-4" /> Plan</Button>
            <Button variant="secondary" className="lg:hidden" aria-label="Create" onClick={() => setCreating(Date.now())}><Icon name="plus" className="size-4" /></Button>
          </div>
          {view === 'month'
            ? <MonthGrid anchor={anchor} items={items} today={today} onDay={(d) => (setAnchor(d), changeView('day'))} onOpen={setOpened} />
            : <TimeGrid days={days} items={items} today={today} now={now} onCreate={setCreating} onOpen={setOpened} />}
          <p className="mt-2 text-[13px] text-muted max-sm:hidden">Click an empty time to add a study block or deadline. Keys: T today, D W M views, arrows to move.</p>
        </section>
      </div>

      {creating !== null && <CreateDialog key={creating} at={creating} onClose={() => setCreating(null)} />}
      {opened && <EventDialog item={opened} onClose={() => setOpened(null)} />}
      <Sheet open={plan !== null} onClose={() => setPlan(null)} title="Plan" wide>
        {plan && (
          <>
            <Segmented className="mb-4" label="Planning tools" value={plan} onChange={setPlan} options={PLAN_TABS} />
            {plan === 'suggest' && <PlanCard />}
            {plan === 'deadlines' && <><ReminderForm /><ReminderList /></>}
            {plan === 'syllabus' && <SyllabusImport />}
            {plan === 'breakdown' && <Breakdown />}
            {plan === 'exams' && <><ExamPrepCard initial={examParam} /><div className="mt-4"><ReviewCard /></div></>}
            {plan === 'routine' && <RoutineCard onConnect={() => setPlan('calendars')} />}
            {plan === 'busy' && <CrunchCard />}
            {plan === 'calendars' && <><ConnectCard /><SubscribeCard /></>}
          </>
        )}
      </Sheet>
    </>
  );
}
