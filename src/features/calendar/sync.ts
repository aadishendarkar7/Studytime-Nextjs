'use client';
import { api } from '@/lib/api';
import { useExtras, type CalendarFeed, type CalEvent, type StudyBlock } from '@/lib/stores/extras';
import { useProfile } from '@/lib/stores/profile';
import type { ReminderType } from '@/lib/types';
import { uid } from '@/lib/utils';
import { clockMinutes, type Interval, type Proposal } from './plan';

export const FEED_COLORS = ['#2f6f9f', '#7a5aa6', '#3d7a52', '#b07a1f', '#a3483b', '#4d5a66'];
const REFRESH_MS = 15 * 60_000;

const DEADLINE_WORDS = /\b(due|exam|midterm|final|quiz|test|assignment|homework|hw|project|paper|essay|lab report|problem set|pset)\b/i;
const EXAM_WORDS = /\b(exam|midterm|final|quiz|test)\b/i;

export function guessKind(url: string): CalendarFeed['kind'] {
  const u = url.toLowerCase();
  if (u.includes('google.com')) return 'google';
  if (u.includes('instructure.com')) return 'canvas';
  if (u.includes('outlook')) return 'outlook';
  if (u.includes('icloud.com')) return 'apple';
  return 'other';
}

const endOfDay = (ms: number) => {
  const d = new Date(ms);
  d.setHours(23, 59, 0, 0);
  return d.getTime();
};

/**
 * Turns calendar events into planner deadlines. Canvas feeds are all due dates.
 * For other calendars only events whose titles look like deadlines count.
 */
function addDeadlines(feed: CalendarFeed) {
  const p = useProfile.getState();
  const now = Date.now();
  let added = 0;
  for (const e of feed.events) {
    if (e.start < now) continue;
    if (feed.kind !== 'canvas' && !(DEADLINE_WORDS.test(e.title) && (e.allDay || e.end - e.start <= 60_000))) continue;
    const type: ReminderType = EXAM_WORDS.test(e.title) ? 'exam' : /homework|hw|problem set|pset/i.test(e.title) ? 'homework' : 'assignment';
    const dueAt = e.allDay ? endOfDay(e.start) : e.start;
    if (p.reminders.some((r) => r.title === e.title && Math.abs(r.dueAt - dueAt) < 60_000)) continue;
    if (p.addReminder({ title: e.title.slice(0, 120), type, dueAt, lead: type === 'exam' ? 2880 : 1440, source: 'calendar' })) added++;
  }
  return added;
}

export async function refreshFeed(id: string) {
  const feed = useExtras.getState().calendarFeeds.find((f) => f.id === id);
  if (!feed) return 0;
  const set = (patch: Partial<CalendarFeed>) => useExtras.setState((s) => ({ calendarFeeds: s.calendarFeeds.map((f) => (f.id === id ? { ...f, ...patch } : f)) }));
  try {
    const r = await api.calendar.import(feed.url);
    set({ events: r.events, lastSync: Date.now(), error: '', name: feed.name || r.name || 'Calendar' });
    const updated = useExtras.getState().calendarFeeds.find((f) => f.id === id)!;
    return updated.addDeadlines ? addDeadlines(updated) : 0;
  } catch (e) {
    set({ error: (e as Error).message, lastSync: Date.now() });
    throw e;
  }
}

export async function addFeed(url: string, name: string, addDeadlinesToPlanner: boolean) {
  const x = useExtras.getState();
  if (x.calendarFeeds.some((f) => f.url.trim() === url.trim())) throw new Error('That calendar is already connected.');
  const r = await api.calendar.import(url);
  const feed: CalendarFeed = {
    id: uid(),
    name: name.trim() || r.name || (r.kind === 'canvas' ? 'Canvas' : 'Calendar'),
    url: url.trim(),
    kind: r.kind,
    color: FEED_COLORS[x.calendarFeeds.length % FEED_COLORS.length],
    addDeadlines: addDeadlinesToPlanner,
    lastSync: Date.now(),
    error: '',
    events: r.events,
  };
  x.update({ calendarFeeds: [...x.calendarFeeds, feed] });
  const added = addDeadlinesToPlanner ? addDeadlines(feed) : 0;
  return { feed, added };
}

/** Refreshes every connected calendar that has not been refreshed in 15 minutes. */
export async function refreshStale() {
  const now = Date.now();
  for (const f of useExtras.getState().calendarFeeds) {
    if (!f.lastSync || now - f.lastSync > REFRESH_MS) await refreshFeed(f.id).catch(() => undefined);
  }
}

export type ShownEvent = CalEvent & { color: string; feed: string };

export function allEvents(feeds: CalendarFeed[]): ShownEvent[] {
  return feeds.flatMap((f) => f.events.map((e) => ({ ...e, color: f.color, feed: f.name })));
}

/** Timed events from connected calendars, used as busy time when planning. */
export function busyTimes(feeds: CalendarFeed[], now = Date.now()): Interval[] {
  return feeds.flatMap((f) => f.events.filter((e) => !e.allDay && e.end > now && e.end - e.start > 60_000).map((e) => ({ start: e.start, end: e.end })));
}

export function acceptProposals(proposals: Proposal[]) {
  const x = useExtras.getState();
  const blocks: StudyBlock[] = proposals.map((p) => ({ id: uid(), title: p.title, subject: p.subject, start: p.start, end: p.end, source: p.source, reminderId: p.reminderId, href: p.href, done: false }));
  x.update({ studyBlocks: [...x.studyBlocks, ...blocks].sort((a, b) => a.start - b.start) });
  return blocks;
}

export function isPastWindDown(windDown: string, now = new Date()) {
  const wd = clockMinutes(windDown);
  if (wd === null) return false;
  const mins = now.getHours() * 60 + now.getMinutes();
  // After wind-down until 4am counts as "late".
  return mins >= wd || mins < 4 * 60;
}

/** Sends the plan to the Studytime subscribe link, if the student made one. */
export async function syncOutgoing() {
  const x = useExtras.getState();
  if (!x.outgoingFeed) return;
  const now = Date.now();
  const from = now - 7 * 86_400_000;
  const blocks = x.studyBlocks.filter((b) => b.end > from).slice(0, 400).map((b) => ({ uid: `block-${b.id}`, title: b.title, start: b.start, end: b.end, allDay: false, description: 'Study block planned in Studytime' }));
  const deadlines = useProfile
    .getState()
    .reminders.filter((r) => !r.done && r.dueAt > from)
    .slice(0, 200)
    .map((r) => ({ uid: `due-${r.id}`, title: `Due: ${r.title}`, start: r.dueAt - 15 * 60_000, end: r.dueAt, allDay: false, description: `${r.type[0].toUpperCase()}${r.type.slice(1)} from your Studytime planner` }));
  const { token } = await api.calendar.saveFeed(x.outgoingFeed.token, [...blocks, ...deadlines]);
  if (token !== x.outgoingFeed.token) x.update({ outgoingFeed: { token } });
}

export const feedUrl = (token: string) => `${location.origin}/api/calendar/feed/${token}.ics`;
