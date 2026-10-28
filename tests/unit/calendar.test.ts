import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryStorage } from '@/lib/server/storage/memory';
import { setStorage } from '@/lib/server/storage';
import { checkFeedUrl, parseCalendar, renderFeed, saveFeed } from '@/lib/server/services/calendar';

beforeEach(() => setStorage(new MemoryStorage()));

const ICS = [
  'BEGIN:VCALENDAR', 'VERSION:2.0', 'X-WR-CALNAME:School',
  'BEGIN:VTIMEZONE', 'TZID:America/New_York',
  'BEGIN:DAYLIGHT', 'TZOFFSETFROM:-0500', 'TZOFFSETTO:-0400', 'TZNAME:EDT', 'DTSTART:19700308T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU', 'END:DAYLIGHT',
  'BEGIN:STANDARD', 'TZOFFSETFROM:-0400', 'TZOFFSETTO:-0500', 'TZNAME:EST', 'DTSTART:19701101T020000', 'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU', 'END:STANDARD',
  'END:VTIMEZONE',
  'BEGIN:VEVENT', 'UID:class1', 'SUMMARY:STAT400 Lecture', 'DTSTART;TZID=America/New_York:20261027T110000', 'DTEND;TZID=America/New_York:20261027T121500', 'RRULE:FREQ=WEEKLY;BYDAY=TU,TH;COUNT=6', 'EXDATE;TZID=America/New_York:20261029T110000', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:class1', 'RECURRENCE-ID;TZID=America/New_York:20261103T110000', 'SUMMARY:STAT400 Lecture (room change)', 'DTSTART;TZID=America/New_York:20261103T140000', 'DTEND;TZID=America/New_York:20261103T151500', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:hw', 'SUMMARY:Homework 5 [MATH240]', 'DTSTART;VALUE=DATE:20261030', 'DTEND;VALUE=DATE:20261031', 'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

describe('calendar import', () => {
  it('only accepts known calendar hosts over https and converts webcal', () => {
    expect(checkFeedUrl('webcal://calendar.google.com/calendar/ical/x/basic.ics').kind).toBe('google');
    expect(checkFeedUrl('https://umd.instructure.com/feeds/calendars/user_abc.ics').kind).toBe('canvas');
    expect(() => checkFeedUrl('https://evil.example.com/cal.ics')).toThrow('Google Calendar, Canvas');
    expect(() => checkFeedUrl('http://calendar.google.com/x')).toThrow('https');
    expect(() => checkFeedUrl('https://calendar.google.com.evil.io/x')).toThrow();
    expect(() => checkFeedUrl('not a url')).toThrow();
  });

  it('expands weekly classes in the right time zone, with exceptions and moved sessions', () => {
    const { name, events } = parseCalendar(ICS, Date.UTC(2026, 9, 1), Date.UTC(2026, 11, 31));
    expect(name).toBe('School');
    const lectures = events.filter((e) => e.title.startsWith('STAT400'));
    // 6 occurrences minus one EXDATE
    expect(lectures).toHaveLength(5);
    // Oct 27 11:00 EDT = 15:00 UTC
    expect(new Date(lectures[0].start).toISOString()).toBe('2026-10-27T15:00:00.000Z');
    // After the Nov 1 clock change, 11:00 EST = 16:00 UTC
    const nov5 = lectures.find((e) => new Date(e.start).getUTCDate() === 5)!;
    expect(new Date(nov5.start).getUTCHours()).toBe(16);
    const moved = lectures.find((e) => e.title.includes('room change'))!;
    expect(new Date(moved.start).toISOString()).toBe('2026-11-03T19:00:00.000Z');
    const hw = events.find((e) => e.uid === 'hw')!;
    expect(hw.allDay).toBe(true);
  });

  it('serves the Studytime plan as a subscribable calendar', async () => {
    const { token } = await saveFeed(null, [{ uid: 'b1', title: 'Prep: STAT400, midterm', start: Date.UTC(2026, 10, 2, 14), end: Date.UTC(2026, 10, 2, 15), allDay: false, description: '' }]);
    const ics = (await renderFeed(token))!;
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('SUMMARY:Prep: STAT400\\, midterm');
    expect(ics).toContain('DTSTART:20261102T140000Z');
    expect(parseCalendar(ics, 0, Date.UTC(2030, 0, 1)).events).toHaveLength(1);
    expect(await renderFeed('0'.repeat(48))).toBeNull();
    const again = await saveFeed(token, []);
    expect(again.token).toBe(token);
  });
});
