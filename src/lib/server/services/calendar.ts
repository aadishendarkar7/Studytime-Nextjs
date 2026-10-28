import 'server-only';
import ICAL from 'ical.js';
import { getStorage } from '../storage';
import { HttpError } from '../http';
import { secret } from '../ids';

/**
 * Calendar hosts the server will fetch from. Fetching any URL a visitor types
 * would let the server be pointed at private addresses, so only the big
 * calendar services and Canvas are allowed.
 */
const ALLOWED_HOSTS = ['calendar.google.com', 'instructure.com', 'outlook.office365.com', 'outlook.live.com', 'outlook.office.com', 'icloud.com'];

export type FeedKind = 'google' | 'canvas' | 'outlook' | 'apple' | 'other';

export function checkFeedUrl(raw: string): { url: URL; kind: FeedKind } {
  let url: URL;
  try {
    url = new URL(raw.trim().replace(/^webcals?:\/\//i, 'https://'));
  } catch {
    throw new HttpError(400, 'That does not look like a calendar link.');
  }
  if (url.protocol !== 'https:') throw new HttpError(400, 'Use the https link for your calendar.');
  const host = url.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
    throw new HttpError(400, 'Studytime can import Google Calendar, Canvas, Outlook and iCloud calendar links.');
  }
  const kind: FeedKind = host.endsWith('google.com') ? 'google' : host.endsWith('instructure.com') ? 'canvas' : host.includes('outlook') ? 'outlook' : host.endsWith('icloud.com') ? 'apple' : 'other';
  return { url, kind };
}

async function download(start: URL): Promise<string> {
  let url = start;
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(12_000), headers: { Accept: 'text/calendar, */*' } });
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get('location');
      if (!next) break;
      url = checkFeedUrl(new URL(next, url).toString()).url; // every redirect must stay on an allowed host
      continue;
    }
    if (res.status === 404 || res.status === 401 || res.status === 403) throw new HttpError(400, 'The calendar service refused that link. Copy the private or secret address again.');
    if (!res.ok) throw new HttpError(502, `The calendar service answered with an error (${res.status}). Try again later.`);
    const length = Number(res.headers.get('content-length') || 0);
    if (length > 5_000_000) throw new HttpError(413, 'That calendar is too large to import.');
    const text = await res.text();
    if (text.length > 5_000_000) throw new HttpError(413, 'That calendar is too large to import.');
    if (!text.includes('BEGIN:VCALENDAR')) throw new HttpError(400, 'That link did not return a calendar. Use the iCal or ICS address.');
    return text;
  }
  throw new HttpError(502, 'The calendar link redirected too many times.');
}

export interface ParsedEvent { uid: string; title: string; start: number; end: number; allDay: boolean; location: string }

/** Expands recurring events (weekly classes and so on) into single events inside [from, to]. */
export function parseCalendar(text: string, from: number, to: number): { name: string; events: ParsedEvent[] } {
  let root: ICAL.Component;
  try {
    root = new ICAL.Component(ICAL.parse(text));
  } catch {
    throw new HttpError(400, 'That calendar file could not be read.');
  }
  for (const tz of root.getAllSubcomponents('vtimezone')) {
    try {
      ICAL.TimezoneService.register(new ICAL.Timezone(tz));
    } catch {
      /* ignore a broken time zone block; events fall back to UTC */
    }
  }
  const name = String(root.getFirstPropertyValue('x-wr-calname') || '');
  const events: ParsedEvent[] = [];
  const push = (e: ICAL.Event, start: ICAL.Time, end: ICAL.Time | null, key: string) => {
    const s = start.toJSDate().getTime();
    const allDay = start.isDate;
    const en = end ? end.toJSDate().getTime() : s + (allDay ? 86_400_000 : 3_600_000);
    if (en < from || s > to) return;
    events.push({ uid: key, title: (e.summary || 'Busy').slice(0, 200), start: s, end: Math.max(en, s), allDay, location: (e.location || '').slice(0, 200) });
  };

  const vevents = root.getAllSubcomponents('vevent');
  // Changed single occurrences of a recurring event are separate VEVENTs with RECURRENCE-ID.
  const overrides = new Map<string, ICAL.Event>();
  for (const v of vevents) {
    const e = new ICAL.Event(v);
    if (e.isRecurrenceException()) overrides.set(`${e.uid}|${e.recurrenceId.toJSDate().getTime()}`, e);
  }
  for (const v of vevents) {
    if (events.length >= 3000) break;
    const e = new ICAL.Event(v);
    if (e.isRecurrenceException()) continue;
    if ((v.getFirstPropertyValue('status') || '') === 'CANCELLED') continue;
    if (!e.isRecurring()) {
      push(e, e.startDate, e.endDate, e.uid);
      continue;
    }
    const it = e.iterator();
    for (let i = 0, next = it.next(); next && i < 1000; i++, next = it.next()) {
      const at = next.toJSDate().getTime();
      if (at > to) break;
      const changed = overrides.get(`${e.uid}|${at}`);
      if (changed) {
        push(changed, changed.startDate, changed.endDate, `${e.uid}|${at}`);
        continue;
      }
      const d = e.getOccurrenceDetails(next);
      push(e, d.startDate, d.endDate, `${e.uid}|${at}`);
    }
  }
  events.sort((a, b) => a.start - b.start);
  return { name, events };
}

export async function importCalendar(raw: string) {
  const { url, kind } = checkFeedUrl(raw);
  const text = await download(url);
  const now = Date.now();
  const parsed = parseCalendar(text, now - 14 * 86_400_000, now + 150 * 86_400_000);
  return { kind, ...parsed };
}

// ---------- Studytime's own subscribe link ----------

export interface FeedEvent { uid: string; title: string; start: number; end: number; allDay: boolean; description: string }
const FEED_TTL = 180 * 86_400;

export async function saveFeed(token: string | null, events: FeedEvent[]) {
  const s = getStorage();
  const key = token && /^[a-f0-9]{48}$/.test(token) ? token : secret(24);
  await s.set(`calfeed:${key}`, { events, updatedAt: Date.now() }, FEED_TTL);
  return { token: key };
}

export async function deleteFeed(token: string) {
  if (/^[a-f0-9]{48}$/.test(token)) await getStorage().del(`calfeed:${token}`);
}

const icsText = (v: string) => v.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsTime = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsDate = (ms: number) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
};
/** Lines longer than 75 octets are folded as the iCalendar format requires. */
const fold = (line: string) => line.match(/.{1,73}/g)!.join('\r\n ');

export async function renderFeed(token: string): Promise<string | null> {
  if (!/^[a-f0-9]{48}$/.test(token)) return null;
  const feed = await getStorage().get<{ events: FeedEvent[]; updatedAt: number }>(`calfeed:${token}`);
  if (!feed) return null;
  const stamp = icsTime(feed.updatedAt);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Studytime//Study plan//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Studytime', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H'];
  for (const e of feed.events) {
    lines.push('BEGIN:VEVENT', `UID:${e.uid}@studytime`, `DTSTAMP:${stamp}`);
    if (e.allDay) lines.push(`DTSTART;VALUE=DATE:${icsDate(e.start)}`, `DTEND;VALUE=DATE:${icsDate(e.end)}`);
    else lines.push(`DTSTART:${icsTime(e.start)}`, `DTEND:${icsTime(e.end)}`);
    lines.push(`SUMMARY:${icsText(e.title)}`);
    if (e.description) lines.push(`DESCRIPTION:${icsText(e.description)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
