import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryStorage } from '@/lib/server/storage/memory';
import { setStorage } from '@/lib/server/storage';
import { createCircle, joinCircle } from '@/lib/server/services/circles';
import { createDrop, endDrop, extendDrop, getDrop, joinDrop, leaveDrop, listDrops, postMessage, setJoinStatus } from '@/lib/server/services/drops';

beforeEach(() => setStorage(new MemoryStorage()));
const H = 3_600_000;
const base = () => ({ name: 'Ana', spotName: 'McKeldin 3rd floor', lat: 38.986, lng: -76.945, subject: 'STAT400', note: '', startsAt: Date.now(), endsAt: Date.now() + 2 * H, audience: 'everyone' as const, school: 'State U', vibe: 'quiet' as const, seats: null as number | null });
const nobody = { school: '', circle: '', memberId: '' };

describe('drop a spot', () => {
  it('shows everyone-drops to all, school drops to the same school, circle drops to members only', async () => {
    const circle = await createCircle('Ana');
    const friend = await joinCircle(circle.code, 'Ben');
    await createDrop(base(), null);
    await createDrop({ ...base(), spotName: 'Library', audience: 'school' }, null);
    await createDrop({ ...base(), spotName: 'Ana room study', audience: 'circle' }, { code: circle.code, memberId: circle.memberId });
    expect((await listDrops(nobody)).map((d) => d.spotName)).toEqual(['McKeldin 3rd floor']);
    expect((await listDrops({ ...nobody, school: 'state u' })).length).toBe(2);
    expect((await listDrops({ school: '', circle: circle.code, memberId: friend.memberId })).map((d) => d.spotName)).toContain('Ana room study');
    expect((await listDrops({ school: '', circle: circle.code, memberId: 'f'.repeat(32) })).map((d) => d.spotName)).not.toContain('Ana room study');
  });

  it('hides the owner and checks times', async () => {
    await createDrop(base(), null);
    const [d] = await listDrops(nobody);
    expect(d).not.toHaveProperty('owner');
    await expect(createDrop({ ...base(), endsAt: base().startsAt - 1 }, null)).rejects.toThrow('after the start');
    await expect(createDrop({ ...base(), endsAt: base().startsAt + 13 * H }, null)).rejects.toThrow('12 hours');
    await expect(createDrop({ ...base(), audience: 'circle' }, null)).rejects.toThrow('friend circle');
  });

  it('lets people join and leave, and only the owner end or extend it', async () => {
    const { id, token } = await createDrop(base(), null);
    const j = await joinDrop(id, 'Ben');
    expect((await listDrops(nobody))[0].joiners.map((x) => x.name)).toEqual(['Ben']);
    await expect(leaveDrop(id, j.joinerId, 'nope')).rejects.toThrow('own join');
    await leaveDrop(id, j.joinerId, j.token);
    expect((await listDrops(nobody))[0].joiners).toEqual([]);
    await expect(endDrop(id, 'nope')).rejects.toThrow('Only the person');
    const ext = await extendDrop(id, token, Date.now() + 4 * H);
    expect(ext.endsAt).toBeGreaterThan(Date.now() + 3 * H);
    await endDrop(id, token);
    expect(await listDrops(nobody)).toEqual([]);
  });

  it('fills seats, tracks arrivals, and keeps a short thread', async () => {
    const { id, token } = await createDrop({ ...base(), seats: 1, vibe: 'group' }, null);
    const ben = await joinDrop(id, 'Ben');
    await expect(joinDrop(id, 'Cy')).rejects.toThrow('seat');
    await expect(setJoinStatus(id, ben.joinerId, 'nope', 'here')).rejects.toThrow('own join');
    expect((await setJoinStatus(id, ben.joinerId, ben.token, 'here')).joiners[0].status).toBe('here');
    await postMessage(id, 'Ben', 'Got the window table', null);
    const after = await postMessage(id, 'Ana', 'On my way back from coffee', token);
    expect(after.messages.map((m) => [m.name, m.host])).toEqual([['Ben', false], ['Ana', true]]);
    const d = await getDrop(id);
    expect(d.vibe).toBe('group');
    expect(d).not.toHaveProperty('joinerOwners');
  });
});


import { companions, distanceKm, dropStats, fmtDistance, hotSpots, recentPlaces } from '@/features/drop/logic';
import type { DropView } from '@/lib/types';

const view = (over: Partial<DropView>): DropView => ({ id: 'a', name: 'Ana', spotName: 'McKeldin', lat: 38.986, lng: -76.945, subject: '', note: '', startsAt: 0, endsAt: 10 * H, audience: 'everyone', school: '', vibe: 'quiet', seats: null, createdAt: 0, joiners: [], messages: [], ...over });

describe('drop logic', () => {
  it('measures and formats distance', () => {
    expect(distanceKm({ lat: 38.986, lng: -76.945 }, { lat: 38.986, lng: -76.945 })).toBe(0);
    expect(Math.round(distanceKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }))).toBe(111);
    expect(fmtDistance(0.02, true)).toBe('50 ft');
    expect(fmtDistance(1.609344, true)).toBe('1.0 mi');
    expect(fmtDistance(0.144, false)).toBe('140 m');
  });

  it('groups live drops into busy spots by name or distance', () => {
    const hot = hotSpots([
      view({ id: 'a', joiners: [{ id: 'j', name: 'Ben', at: 0, status: 'here' }] }),
      view({ id: 'b', spotName: 'mckeldin!', lat: null, lng: null }),
      view({ id: 'c', spotName: 'McKeldin Library lobby', lat: 38.9861, lng: -76.9451 }),
      view({ id: 'd', spotName: 'Stamp', lat: 38.988, lng: -76.944 }),
      view({ id: 'e', spotName: 'Later', startsAt: 5 * H }),
    ], H);
    expect(hot.map((h) => [h.name, h.people])).toEqual([['McKeldin', 4], ['Stamp', 1]]);
  });

  it('keeps recent places unique and totals history', () => {
    const now = new Date(2026, 9, 20, 12).getTime();
    const log = [
      { id: '1', spotName: 'McKeldin', subject: '', vibe: 'quiet' as const, lat: null, lng: null, at: now - 3 * 24 * H, minutes: 120, role: 'host' as const, with: ['Ben'] },
      { id: '2', spotName: 'mckeldin', subject: '', vibe: 'quiet' as const, lat: null, lng: null, at: now - 2 * 24 * H, minutes: 60, role: 'joined' as const, with: ['Ben', 'Cy'] },
      { id: '3', spotName: 'Stamp', subject: '', vibe: 'group' as const, lat: null, lng: null, at: now - 40 * 24 * H, minutes: 90, role: 'solo' as const, with: [] },
    ];
    expect(recentPlaces(log).map((e) => e.id)).toEqual(['2', '3']);
    const s = dropStats(log, now);
    expect(s).toMatchObject({ thisMonth: 2, total: 3, minutes: 270, people: 2, topSpot: { name: 'McKeldin', count: 2 }, withMost: { name: 'Ben', count: 2 } });
  });

  it('lists the people you studied with', () => {
    const d = view({ joiners: [{ id: 'j1', name: 'Ben', at: 0, status: 'coming' }, { id: 'j2', name: 'Cy', at: 0, status: 'here' }] });
    expect(companions(d, { host: true })).toEqual(['Ben', 'Cy']);
    expect(companions(d, { host: false, joinerId: 'j1' })).toEqual(['Ana', 'Cy']);
  });
});

import { achievements, level } from '@/features/ranks/achievements';

describe('achievements and levels', () => {
  it('levels up every 150 more points', () => {
    expect(level(0)).toMatchObject({ level: 1, into: 0, span: 150 });
    expect(level(149).level).toBe(1);
    expect(level(150)).toMatchObject({ level: 2, into: 0, span: 300 });
    expect(level(450).level).toBe(3);
  });

  it('counts progress from saved data', () => {
    const s = (day: string, hour: number, minutes = 60) => ({ id: day + hour, at: new Date(`${day}T${String(hour).padStart(2, '0')}:00:00`).toISOString(), day, minutes, points: 0, subject: '', location: '' });
    const list = achievements({
      sessions: [s('2026-10-19', 8), s('2026-10-20', 14), s('2026-10-21', 14), s('2026-10-22', 14), s('2026-10-23', 14)],
      dropLog: [{ id: 'a', spotName: 'McKeldin', subject: '', vibe: 'quiet', lat: null, lng: null, at: 1, minutes: 60, role: 'host', with: ['Ben', 'Cy'] }],
      checkins: [], water: { '2026-10-20': 8 }, waterGoal: 8, resets: 0, flashcardSets: 2, notes: 0, now: Date.now(),
    });
    const get = (id: string) => list.find((a) => a.id === id)!;
    expect(get('first-session').done).toBe(true);
    expect(get('ten-hours')).toMatchObject({ have: 5, done: false });
    expect(get('five-days').done).toBe(true);
    expect(get('early').done).toBe(true);
    expect(get('first-drop').done).toBe(true);
    expect(get('crew')).toMatchObject({ have: 2, need: 5 });
    expect(get('cards')).toMatchObject({ have: 1, done: true });
  });
});
