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

type View = 'day' | 'week' | 'month' | 'year';
type Kind = 'event' | 'block' | 'due';
interface Item { key: string; id: string; kind: Kind; title: string; start: number; end: number; allDay: boolean; color: string; sub: string; done?: boolean; group?: Item[] }

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
    // A due date that was already copied into the planner shows once, as a deadline.
    const open = reminders.filter((r) => !r.done && !hidden.has('deadlines'));
    const copied = (title: string, at: number) => open.some((r) => r.title === title.slice(0, 120) && Math.abs(r.dueAt - at) < 86_400_000);
    for (const f of calendarFeeds) {
      if (hidden.has(f.id)) continue;
      for (const e of f.events) if (!copied(e.title, e.start)) out.push({ key: `${f.id}${e.uid}`, id: e.uid, kind: 'event', title: e.title, start: e.start, end: e.end, allDay: e.allDay || e.end - e.start <= 60_000, color: f.color, sub: e.location || f.name });
    }
    if (!hidden.has('blocks')) for (const b of studyBlocks) out.push({ key: b.id, id: b.id, kind: 'block', title: b.title, start: b.start, end: b.end, allDay: false, color: 'var(--accent-fill)', sub: 'Study block', done: b.done });
    const due: Item[] = open.map((r) => ({ key: r.id, id: r.id, kind: 'due', title: r.title, start: r.dueAt, end: r.dueAt, allDay: true, color: 'var(--danger)', sub: `Due ${fmt(r.dueAt)}` }));
    // Several deadlines on one day collapse into a single "3 due" item, so busy days stay readable.
    const byDay = new Map<number, Item[]>();
    for (const d of due) byDay.set(startOfDay(d.start), [...(byDay.get(startOfDay(d.start)) ?? []), d]);
    for (const [day, list] of byDay) {
      if (list.length === 1) out.push(list[0]);
      else out.push({ key: `due-${day}`, id: `due-${day}`, kind: 'due', title: `${list.length} due`, start: Math.min(...list.map((l) => l.start)), end: Math.min(...list.map((l) => l.start)), allDay: true, color: 'var(--danger)', sub: list.map((l) => l.title).join(', '), group: list.sort((a, b) => a.start - b.start) });
    }
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

/** Apple Calendar's red: today's date, the current-time line. */
const RED = '#eb4d3d';
/** An event in its calendar's color: a light wash, a solid bar on the left, text in a deeper shade. */
const tint = (c: string): React.CSSProperties => ({ background: `color-mix(in srgb, ${c} 20%, var(--surface))`, color: `color-mix(in srgb, ${c} 72%, var(--ink))`, borderLeft: `3px solid ${c}` });
const monthStart = (ms: number, add = 0) => { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth() + add, 1).getTime(); };
const hourLabel = (h: number) => new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: 'numeric' });

function MiniMonth({ anchor, onPick, today, onMonth, compact }: { anchor: number; onPick: (ms: number) => void; today: number; onMonth?: (ms: number) => void; compact?: boolean }) {
  const [month, setMonth] = useState(() => monthStart(anchor));
  const [seen, setSeen] = useState(anchor);
  // Follow the main calendar when it moves to another month.
  if (seen !== anchor) {
    setSeen(anchor);
    if (monthStart(anchor) !== month) setMonth(monthStart(anchor));
  }
  const start = sunday(month);
  const m = new Date(month).getMonth();
  const isThisMonth = monthStart(today) === month;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        {onMonth ? (
          <button type="button" onClick={() => onMonth(month)} className="text-[15px] font-semibold hover:underline" style={isThisMonth ? { color: RED } : undefined}>{new Date(month).toLocaleDateString(undefined, { month: 'long' })}</button>
        ) : (
          <strong className="text-[14px] font-semibold">{new Date(month).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</strong>
        )}
        {!compact && (
          <span className="flex">
            <button type="button" aria-label="Previous month" onClick={() => setMonth(monthStart(month, -1))} className="grid size-7 place-items-center rounded-md text-muted hover:bg-surface-3 hover:text-ink"><Icon name="chevron" className="size-3.5 rotate-180" /></button>
            <button type="button" aria-label="Next month" onClick={() => setMonth(monthStart(month, 1))} className="grid size-7 place-items-center rounded-md text-muted hover:bg-surface-3 hover:text-ink"><Icon name="chevron" className="size-3.5" /></button>
          </span>
        )}
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] font-medium text-muted">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i} className="py-1">{d}</span>)}</div>
      <div className="grid grid-cols-7 text-center text-[12px]">
        {Array.from({ length: 42 }, (_, i) => {
          const d = addDays(start, i);
          const inMonth = new Date(d).getMonth() === m;
          if (compact && !inMonth) return <span key={d} className="size-7" />;
          const isToday = d === today;
          const picked = !compact && sameDay(d, anchor);
          return (
            <button
              key={d}
              type="button"
              onClick={() => onPick(d)}
              className={cn('tnum mx-auto grid size-7 place-items-center rounded-full', isToday && picked ? 'font-semibold text-white' : isToday ? 'font-semibold' : picked ? 'bg-ink font-semibold text-bg' : inMonth ? 'text-ink hover:bg-surface-3' : 'text-muted/50 hover:bg-surface-3')}
              style={isToday ? (picked ? { background: RED } : { color: RED }) : undefined}
            >
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
  // Open at the first event on screen, or an hour before now, whichever is earlier (8 AM on an empty day).
  const [startHour] = useState(() => {
    const h = new Date().getHours();
    const firsts = days.flatMap((d) => items.filter((i) => !i.allDay && i.start >= d && i.start < addDays(d, 1)).map((i) => new Date(i.start).getHours()));
    return Math.max(0, Math.min(h >= 7 && h <= 21 ? h - 1 : 8, ...firsts));
  });
  useEffect(() => {
    scroller.current?.scrollTo({ top: Math.max(0, startHour * HOUR - 10) });
  }, [startHour]);
  const allDay = (d: number) => items.filter((i) => i.allDay && sameDay(i.start, d));
  const timed = (d: number) => items.filter((i) => !i.allDay && i.start < addDays(d, 1) && i.end > d);
  const nowTop = ((now - startOfDay(now)) / 3_600_000) * HOUR;
  const showNow = days.includes(today);
  const single = days.length === 1;
  const cols = `56px repeat(${days.length}, minmax(0, 1fr))`;
  const weekend = (d: number) => !single && [0, 6].includes(new Date(d).getDay());
  return (
    <div className="overflow-hidden rounded-[10px] border border-line bg-surface">
      <div className="grid border-b border-line" style={{ gridTemplateColumns: cols }}>
        <span />
        {days.map((d) => {
          const isToday = d === today;
          return (
            <div key={d} className={cn('flex items-center gap-1.5 px-2 py-2.5', single ? 'justify-start' : 'justify-center', weekend(d) && 'bg-surface-2')}>
              <span className={cn('text-[13px]', isToday ? 'font-semibold' : 'text-ink-2')} style={isToday ? { color: RED } : undefined}>{new Date(d).toLocaleDateString(undefined, { weekday: single ? 'long' : 'short' })}</span>
              <span className={cn('tnum grid h-7 min-w-7 place-items-center rounded-full px-1 text-[15px]', isToday ? 'font-semibold text-white' : 'text-ink')} style={isToday ? { background: RED } : undefined}>{new Date(d).getDate()}</span>
            </div>
          );
        })}
      </div>
      <div className="grid border-b border-line" style={{ gridTemplateColumns: cols }}>
        <span className="pt-1.5 pr-2 text-right text-[11px] text-muted">all-day</span>
        {days.map((d) => (
          <div key={d} className={cn('grid min-h-7 content-start gap-0.5 border-l border-line p-0.5', weekend(d) && 'bg-surface-2')}>
            {allDay(d).slice(0, 3).map((i) => (
              <button key={i.key} type="button" onClick={() => onOpen(i)} title={i.title} className="truncate rounded-[4px] px-1.5 text-left text-[12px] leading-5 font-medium" style={tint(i.color)}>{i.kind === 'due' && !i.group ? `Due: ${i.title}` : i.title}</button>
            ))}
            {allDay(d).length > 3 && <span className="px-1 text-[11px] text-muted">{allDay(d).length - 3} more</span>}
          </div>
        ))}
      </div>
      <div ref={scroller} className="relative h-[min(66vh,680px)] overflow-y-auto">
        <div className="relative grid" style={{ gridTemplateColumns: cols }}>
          <div className="relative">
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="tnum relative pr-2 text-right text-[11px] text-muted" style={{ height: HOUR }}>
                {h > 0 && !(showNow && Math.abs(h * HOUR - nowTop) < 12) && <span className="relative -top-2">{hourLabel(h)}</span>}
              </div>
            ))}
            {showNow && <span className="tnum absolute right-1.5 -translate-y-1/2 text-[11px] font-semibold" style={{ top: nowTop, color: RED }}>{fmt(now).replace(/\s?[AP]M$/i, '')}</span>}
          </div>
          {days.map((d) => (
            <div
              key={d}
              className={cn('relative cursor-cell border-l border-line', weekend(d) && 'bg-surface-2')}
              style={{ height: 24 * HOUR, backgroundImage: 'linear-gradient(var(--line) 1px, transparent 1px)', backgroundSize: `100% ${HOUR}px` }}
              onClick={(e) => {
                if (e.target !== e.currentTarget) return;
                const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
                onCreate(d + Math.floor((y / HOUR) * 4) * 15 * 60_000);
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
                    className={cn('absolute overflow-hidden rounded-[5px] px-1.5 py-0.5 text-left text-[12px] leading-4 transition-[filter] hover:brightness-95', i.done && 'opacity-50 line-through')}
                    style={{ top: top + 1, height: h, left: `calc(${(col / n) * 100}% + 1px)`, width: `calc(${100 / n}% - 3px)`, ...tint(i.color) }}
                  >
                    {h > 34 && <span className="tnum block truncate text-[11px] opacity-80">{fmt(i.start)}</span>}
                    <span className="block truncate font-semibold">{i.title}</span>
                    {h > 54 && i.sub && <span className="block truncate opacity-80">{i.sub}</span>}
                  </button>
                );
              })}
              {d === today && (
                <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: nowTop }}>
                  <span className="absolute -top-[4px] -left-[4px] size-2.5 rounded-full" style={{ background: RED }} />
                  <span className="block h-[2px]" style={{ background: RED }} />
                </div>
              )}
            </div>
          ))}
          {showNow && !single && <div className="pointer-events-none absolute right-0 left-14 h-px opacity-40" style={{ top: nowTop, background: RED }} />}
        </div>
      </div>
    </div>
  );
}

function MonthGrid({ anchor, items, today, onDay, onOpen }: { anchor: number; items: Item[]; today: number; onDay: (ms: number) => void; onOpen: (i: Item) => void }) {
  const first = monthStart(anchor);
  const start = sunday(first);
  const m = new Date(first).getMonth();
  const daysIn = new Date(new Date(first).getFullYear(), m + 1, 0).getDate();
  const weeks = Math.ceil((new Date(first).getDay() + daysIn) / 7);
  return (
    <div className="overflow-hidden rounded-[10px] border border-line bg-surface">
      <div className="grid grid-cols-7 border-b border-line text-[12px] text-ink-2">{Array.from({ length: 7 }, (_, i) => <span key={i} className="px-2 py-2 text-right">{new Date(addDays(start, i)).toLocaleDateString(undefined, { weekday: 'short' })}</span>)}</div>
      <div className="grid grid-cols-7">
        {Array.from({ length: weeks * 7 }, (_, i) => {
          const d = addDays(start, i);
          const inMonth = new Date(d).getMonth() === m;
          const isToday = d === today;
          const firstOfMonth = new Date(d).getDate() === 1;
          const list = items.filter((x) => (x.allDay ? sameDay(x.start, d) : x.start < addDays(d, 1) && x.end > d)).sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start - b.start);
          return (
            <div key={d} onDoubleClick={() => onDay(d)} className={cn('min-h-[118px] border-r border-b border-line p-1 max-sm:min-h-[58px] [&:nth-child(7n)]:border-r-0', [0, 6].includes(new Date(d).getDay()) && 'bg-surface-2', i >= (weeks - 1) * 7 && 'border-b-0')}>
              <div className="flex justify-end max-sm:justify-center">
                <button type="button" onClick={() => onDay(d)} className={cn('tnum flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[13px]', isToday ? 'font-semibold text-white' : inMonth ? 'text-ink hover:bg-surface-3' : 'text-muted/60 hover:bg-surface-3')} style={isToday ? { background: RED } : undefined}>
                  {firstOfMonth && !isToday && <span className="mr-1 max-sm:hidden">{new Date(d).toLocaleDateString(undefined, { month: 'short' })}</span>}
                  {new Date(d).getDate()}
                </button>
              </div>
              {list.length > 0 && (
                <span className="mt-1 flex justify-center gap-[3px] sm:hidden" aria-hidden>
                  {list.slice(0, 4).map((x) => <span key={x.key} className="size-1.5 rounded-full" style={{ background: x.color }} />)}
                </span>
              )}
              <div className="mt-0.5 grid gap-px max-sm:hidden">
                {list.slice(0, 3).map((x) =>
                  x.allDay ? (
                    <button key={x.key} type="button" onClick={() => onOpen(x)} title={x.title} className="truncate rounded-[4px] px-1.5 text-left text-[12px] leading-5 font-medium" style={tint(x.color)}>{x.title}</button>
                  ) : (
                    <button key={x.key} type="button" onClick={() => onOpen(x)} title={x.title} className={cn('flex min-w-0 items-center gap-1.5 rounded-[4px] px-1 text-left text-[12px] leading-5 hover:bg-surface-3', x.done && 'opacity-50')}>
                      <span className="size-2 shrink-0 rounded-full" style={{ background: x.color }} />
                      <span className="min-w-0 flex-1 truncate max-sm:hidden">{x.title}</span>
                      <span className="tnum shrink-0 text-[11px] text-muted max-lg:hidden">{fmt(x.start).replace(':00', '')}</span>
                    </button>
                  ),
                )}
                {list.length > 3 && <button type="button" onClick={() => onDay(d)} className="px-1 text-left text-[11px] font-medium text-muted hover:text-ink">{list.length - 3} more</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function YearGrid({ anchor, today, onDay, onMonth }: { anchor: number; today: number; onDay: (ms: number) => void; onMonth: (ms: number) => void }) {
  const year = new Date(anchor).getFullYear();
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-7 rounded-[10px] border border-line bg-surface p-5 sm:grid-cols-3 xl:grid-cols-4 max-sm:gap-x-3 max-sm:p-3">
      {Array.from({ length: 12 }, (_, i) => {
        const month = new Date(year, i, 1).getTime();
        return <MiniMonth key={`${year}-${i}`} anchor={month} today={today} onPick={onDay} onMonth={onMonth} compact />;
      })}
    </div>
  );
}

/** Apple's day view: the timeline on the left, the month and the day's events on the right. */
function DayPanel({ anchor, items, today, onPick, onOpen }: { anchor: number; items: Item[]; today: number; onPick: (ms: number) => void; onOpen: (i: Item) => void }) {
  const list = items.filter((x) => (x.allDay ? sameDay(x.start, anchor) : x.start < addDays(anchor, 1) && x.end > anchor)).sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start - b.start);
  return (
    <aside className="hidden content-start gap-5 rounded-[10px] border border-line bg-surface p-4 xl:grid">
      <MiniMonth anchor={anchor} today={today} onPick={onPick} />
      <div className="border-t border-line pt-4">
        <p className="text-[13px] font-semibold">{new Date(anchor).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        {list.length ? (
          <ul className="mt-2 grid gap-1.5">
            {list.map((x) => (
              <li key={x.key}>
                <button type="button" onClick={() => onOpen(x)} className="w-full rounded-[5px] px-2 py-1.5 text-left text-[13px] leading-5" style={tint(x.color)}>
                  <span className="block truncate font-semibold">{x.title}</span>
                  <span className="tnum block truncate text-[12px] opacity-80">{x.allDay ? (x.kind === 'due' ? x.sub : 'All day') : `${fmt(x.start)} to ${fmt(x.end)}`}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="mt-1 text-[13px] text-muted">Nothing scheduled.</p>}
      </div>
    </aside>
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

function DueGroupDialog({ item, onClose }: { item: Item; onClose: () => void }) {
  const p = useProfile();
  const list = (item.group ?? []).filter((g) => p.reminders.some((r) => r.id === g.id && !r.done));
  return (
    <Dialog open onClose={onClose} title={`Due ${new Date(item.start).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}`}>
      {list.length ? (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {list.map((g) => (
            <li key={g.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="size-2.5 shrink-0 rounded-full bg-danger" />
              <span className="min-w-0 flex-1"><strong className="block truncate text-[14px] font-medium">{g.title}</strong><span className="tnum text-[12px] text-muted">{fmt(g.start)}</span></span>
              <Button size="sm" variant="secondary" onClick={() => (p.setReminderDone(g.id, true), toast('Marked done.'))}>Done</Button>
              <button type="button" aria-label={`Delete ${g.title}`} onClick={() => p.deleteReminder(g.id)} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-3 hover:text-danger"><Icon name="trash" className="size-4" /></button>
            </li>
          ))}
        </ul>
      ) : <p className="text-[14px] text-muted">All done for this day.</p>}
      <div className="mt-5 flex justify-end"><Button variant="ghost" onClick={onClose}>Close</Button></div>
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

/** Three tabs instead of eight: everything about due dates, everything about planning study time, and connections. */
type PlanTab = 'deadlines' | 'study' | 'calendars';
const PLAN_TABS: { value: PlanTab; label: string }[] = [
  { value: 'deadlines', label: 'Deadlines' },
  { value: 'study', label: 'Study plan' },
  { value: 'calendars', label: 'Connect calendars' },
];
/** Old links (?plan=syllabus and so on) still land on the right tab. */
const OLD_TABS: Record<string, PlanTab> = { suggest: 'deadlines', syllabus: 'deadlines', breakdown: 'deadlines', routine: 'study', exams: 'study', busy: 'study' };

function More({ title, children, open }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group mt-3 rounded-xl border border-line">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-[14px] font-semibold">{title}<Icon name="chevron" className="size-3.5 text-muted transition-transform group-open:rotate-90" /></summary>
      <div className="border-t border-line px-4 py-3">{children}</div>
    </details>
  );
}

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
    return q ? (PLAN_TABS.some((t) => t.value === q) ? (q as PlanTab) : OLD_TABS[q] ?? null) : null;
  });

  const changeView = (v: View) => (setView(v), x.update({ calendarView: v }));
  const step = (dir: number) => setAnchor((a) => (view === 'day' ? addDays(a, dir) : view === 'week' ? addDays(a, 7 * dir) : view === 'year' ? startOfDay(new Date(new Date(a).getFullYear() + dir, 0, 1).getTime()) : startOfDay(monthStart(a, dir))));
  const days = view === 'day' ? [anchor] : Array.from({ length: 7 }, (_, i) => addDays(sunday(anchor), i));
  const a = new Date(anchor);
  // Apple's title: the month in bold, the year in regular weight.
  const title: [string, string] = view === 'year'
    ? [String(a.getFullYear()), '']
    : view === 'day'
      ? [`${a.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })},`, String(a.getFullYear())]
      : view === 'week' && new Date(days[0]).getMonth() !== new Date(days[6]).getMonth()
        ? [`${new Date(days[0]).toLocaleDateString(undefined, { month: 'short' })} to ${new Date(days[6]).toLocaleDateString(undefined, { month: 'short' })}`, String(new Date(days[6]).getFullYear())]
        : [new Date(view === 'week' ? days[0] : anchor).toLocaleDateString(undefined, { month: 'long' }), String(new Date(view === 'week' ? days[0] : anchor).getFullYear())];

  const toggle = (id: string) => x.update({ hiddenCalendars: x.hiddenCalendars.includes(id) ? x.hiddenCalendars.filter((h) => h !== id) : [...x.hiddenCalendars, id] });
  const mine = [
    { id: 'blocks', name: 'Study blocks', color: 'var(--accent-fill)' },
    { id: 'deadlines', name: 'Deadlines', color: 'var(--danger)' },
  ];
  const subscribed = x.calendarFeeds.map((f) => ({ id: f.id, name: f.name, color: f.color }));
  const newAt = () => setCreating(Date.now() + 60 * 60_000 - (Date.now() % (15 * 60_000)));

  // Keyboard shortcuts like Apple Calendar: t = today, d/w/m/y = view, arrows = move.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable], dialog')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 't') setAnchor(startOfDay(Date.now()));
      else if (e.key === 'd') changeView('day');
      else if (e.key === 'w') changeView('week');
      else if (e.key === 'm') changeView('month');
      else if (e.key === 'y') changeView('year');
      else if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const calList = (heading: string, list: { id: string; name: string; color: string }[]) => (
    <div>
      <p className="mb-1 px-2 text-[12px] font-semibold text-muted">{heading}</p>
      <ul className="grid">
        {list.map((c) => {
          const on = !x.hiddenCalendars.includes(c.id);
          return (
            <li key={c.id}>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1 text-[14px] hover:bg-surface-3">
                <input type="checkbox" checked={on} onChange={() => toggle(c.id)} className="sr-only" />
                <span className="grid size-[15px] shrink-0 place-items-center rounded-[4px]" style={{ background: on ? c.color : 'transparent', border: `1.5px solid ${c.color}` }}>{on && <Icon name="check" className="size-2.5 text-white" />}</span>
                <span className="truncate">{c.name}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <>
      <div className="mt-6 grid gap-5 max-sm:mt-3 lg:grid-cols-[220px_minmax(0,1fr)] [&>*]:min-w-0">
        <aside className="hidden content-start gap-5 lg:grid">
          {calList('Studytime', mine)}
          <div>
            {subscribed.length > 0 && calList('Subscriptions', subscribed)}
            <button type="button" onClick={() => setPlan('calendars')} className="mt-1 flex items-center gap-2 rounded-md px-2 py-1 text-left text-[13px] text-muted hover:bg-surface-3 hover:text-ink">
              <Icon name="plus" className="size-3.5" /> Add Google, Canvas or Moodle
            </button>
          </div>
          <div className="border-t border-line pt-4"><MiniMonth anchor={anchor} today={today} onPick={(d) => (setAnchor(d), view === 'year' && changeView('day'))} /></div>
        </aside>

        <section>
          <div className="mb-4 flex items-center gap-2">
            <button type="button" aria-label="New event" title="New event" onClick={newAt} className="grid size-9 shrink-0 place-items-center rounded-md border border-line bg-surface text-ink-2 hover:bg-surface-3 hover:text-ink"><Icon name="plus" className="size-4" /></button>
            <div role="tablist" aria-label="View" className="mx-auto flex rounded-[8px] bg-surface-3 p-0.5 max-sm:flex-1">
              {(['day', 'week', 'month', 'year'] as const).map((v) => (
                <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => changeView(v)} className={cn('h-8 rounded-[6px] px-4 text-[13px] font-medium capitalize transition-colors max-sm:flex-1 max-sm:px-2', view === v ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.12)]' : 'text-ink-2 hover:text-ink')}>{v}</button>
              ))}
            </div>
            <Button variant="secondary" className="shrink-0" onClick={() => setPlan(x.calendarFeeds.length ? 'study' : 'calendars')}>Plan</Button>
          </div>

          <div className="mb-3 flex items-end justify-between gap-3">
            <h1 className="text-[28px] leading-9 tracking-tight max-sm:text-[22px] max-sm:leading-7">
              <strong className="font-bold">{title[0]}</strong>{title[1] && <span className="font-normal"> {title[1]}</span>}
            </h1>
            <span className="flex shrink-0 overflow-hidden rounded-md border border-line bg-surface">
              <button type="button" aria-label="Previous" onClick={() => step(-1)} className="grid h-8 w-8 place-items-center text-ink-2 hover:bg-surface-3 hover:text-ink"><Icon name="chevron" className="size-3.5 rotate-180" /></button>
              <button type="button" onClick={() => setAnchor(today)} className="h-8 border-x border-line px-3 text-[13px] font-medium hover:bg-surface-3">Today</button>
              <button type="button" aria-label="Next" onClick={() => step(1)} className="grid h-8 w-8 place-items-center text-ink-2 hover:bg-surface-3 hover:text-ink"><Icon name="chevron" className="size-3.5" /></button>
            </span>
          </div>

          {view === 'year' ? (
            <YearGrid anchor={anchor} today={today} onDay={(d) => (setAnchor(d), changeView('day'))} onMonth={(m) => (setAnchor(startOfDay(m)), changeView('month'))} />
          ) : view === 'month' ? (
            <MonthGrid anchor={anchor} items={items} today={today} onDay={(d) => (setAnchor(d), changeView('day'))} onOpen={setOpened} />
          ) : view === 'day' ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
              <TimeGrid days={days} items={items} today={today} now={now} onCreate={setCreating} onOpen={setOpened} />
              <DayPanel anchor={anchor} items={items} today={today} onPick={setAnchor} onOpen={setOpened} />
            </div>
          ) : (
            <TimeGrid days={days} items={items} today={today} now={now} onCreate={setCreating} onOpen={setOpened} />
          )}
          <p className="mt-2 text-[13px] text-muted max-sm:hidden">Click an empty time to add a study block or deadline. Keys: T today, D W M Y views, arrows to move.</p>
        </section>
      </div>

      {creating !== null && <CreateDialog key={creating} at={creating} onClose={() => setCreating(null)} />}
      {opened && (opened.group ? <DueGroupDialog item={opened} onClose={() => setOpened(null)} /> : <EventDialog item={opened} onClose={() => setOpened(null)} />)}
      <Sheet open={plan !== null} onClose={() => setPlan(null)} title="Plan" wide>
        {plan && (
          <>
            <Segmented className="mb-4" label="Planning tools" value={plan} onChange={setPlan} options={PLAN_TABS} />
            {plan === 'deadlines' && (
              <>
                <ReminderForm />
                <ReminderList />
                <More title="Plan study time for these deadlines"><PlanCard /></More>
                <More title="Import deadlines from a syllabus"><SyllabusImport /></More>
                <More title="Break a big assignment into steps"><Breakdown /></More>
              </>
            )}
            {plan === 'study' && (
              <>
                <RoutineCard onConnect={() => setPlan('calendars')} />
                <More title="Exam prep" open={!!examParam}><ExamPrepCard initial={examParam} /><div className="mt-4"><ReviewCard /></div></More>
                <More title="Busy weeks ahead"><CrunchCard /></More>
              </>
            )}
            {plan === 'calendars' && <><ConnectCard /><SubscribeCard /></>}
          </>
        )}
      </Sheet>
    </>
  );
}
