import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryStorage } from '@/lib/server/storage/memory';
import { setStorage } from '@/lib/server/storage';
import { joinQueue, poll, setStatus } from '@/lib/server/services/buddy';
import { createPact, joinPact, leavePact, reportPact } from '@/lib/server/services/pacts';
import { cancelRsvp, createEvent, deleteEvent, listEvents, rsvp } from '@/lib/server/services/events';
import { awardFor } from '@/features/focus/logic';

beforeEach(() => setStorage(new MemoryStorage()));
const H = 3_600_000;

describe('focus buddy', () => {
  it('pairs people focusing now, preferring the same course', async () => {
    const end = Date.now() + H;
    const a = await joinQueue({ name: 'Ana', course: 'STAT400', task: 'HW 6', school: 'UMD', endsAt: end });
    const b = await joinQueue({ name: 'Ben', course: 'CHEM135', task: 'Lab', school: 'UMD', endsAt: end });
    const c = await joinQueue({ name: 'Cy', course: 'stat 400', task: 'Review', school: 'UMD', endsAt: end });
    await poll(b.id, b.token);
    await poll(c.id, c.token);
    const r = await poll(a.id, a.token);
    expect(r.buddy?.name).toBe('Cy');
    expect(r.sameCourse).toBe(true);
    expect((await poll(c.id, c.token)).buddy?.name).toBe('Ana');
    await expect(poll(a.id, 'nope')).rejects.toThrow('Not your');
    await setStatus(c.id, c.token, 'done');
    expect((await poll(a.id, a.token)).buddy?.status).toBe('done');
    await expect(joinQueue({ name: 'D', course: '', task: '', school: '', endsAt: Date.now() + 30_000 })).rejects.toThrow('few minutes');
  });
});

describe('weekly pact', () => {
  it('holds two people and their weekly minutes', async () => {
    const p = await createPact('Ana', 300);
    const j = await joinPact(p.code, 'Ben');
    await expect(joinPact(p.code, 'Cy')).rejects.toThrow('two people');
    const v = await reportPact(p.code, j.memberId, j.token, { name: 'Ben', minutes: 120 });
    expect(v.members.map((m) => [m.name, m.minutes])).toEqual([['Ana', 0], ['Ben', 120]]);
    await expect(reportPact(p.code, p.memberId, j.token, { name: 'x', minutes: 1 })).rejects.toThrow('not in this pact');
    await leavePact(p.code, j.memberId, j.token);
    await leavePact(p.code, p.memberId, p.token);
    await expect(joinPact(p.code, 'Dee')).rejects.toThrow('No pact');
  });
});

describe('study events', () => {
  const base = () => ({ host: 'Ana', title: 'STAT400 midterm review', course: 'STAT400', category: 'Math & stats', place: 'McKeldin 6107', startsAt: Date.now() + H, endsAt: Date.now() + 3 * H, capacity: 2, school: 'UMD', audience: 'school' as const, note: '' });
  it('lists by school, fills up, and only the host can cancel', async () => {
    const e = await createEvent(base());
    await createEvent({ ...base(), title: 'Open to all', audience: 'everyone', school: '' });
    expect((await listEvents('')).map((x) => x.title)).toEqual(['Open to all']);
    expect((await listEvents('umd')).length).toBe(2);
    const r1 = await rsvp(e.id, 'Ben');
    await rsvp(e.id, 'Cy');
    await expect(rsvp(e.id, 'Dee')).rejects.toThrow('full');
    expect((await cancelRsvp(e.id, r1.rsvpId, r1.token)).going.map((g) => g.name)).toEqual(['Cy']);
    await expect(deleteEvent(e.id, 'nope')).rejects.toThrow('host');
    await deleteEvent(e.id, e.token);
    await expect(createEvent({ ...base(), endsAt: base().startsAt - 1 })).rejects.toThrow('after the start');
  });
});

describe('custom lengths', () => {
  it('keeps preset points and fills in between', () => {
    expect([5, 15, 30, 60, 90].map(awardFor)).toEqual([3, 10, 25, 60, 100]);
    expect(awardFor(45)).toBe(43);
    expect(awardFor(120)).toBe(133);
    expect(awardFor(1)).toBe(1);
  });
});

import { QUESTIONS, styleFor } from '@/features/profile/style';

describe('study style quiz', () => {
  it('maps answers to one of eight styles', () => {
    expect(styleFor([0, 1, 0, 1, 1, 0]).name).toBe('Sunrise Sprinter');
    expect(styleFor([2, 0, 1, 0, 0, 1]).name).toBe('Late Library Crew');
    expect(QUESTIONS).toHaveLength(6);
  });
});

import { periodStart, wrap } from '@/features/wrapped/logic';

describe('wrapped', () => {
  it('sums a period and finds favorites', () => {
    const now = new Date(2026, 9, 28, 20).getTime();
    const s = (day: number, hour: number, minutes: number, subject: string) => { const at = new Date(2026, 9, day, hour); return { id: `${day}${hour}`, at: at.toISOString(), day: `2026-10-${String(day).padStart(2, '0')}`, minutes, points: 0, subject, location: '' }; };
    const w = wrap({
      sessions: [s(26, 21, 60, 'STAT400'), s(27, 21, 90, 'STAT400'), s(28, 10, 30, 'MATH240'), s(19, 21, 60, 'STAT400')],
      dropLog: [{ id: 'a', spotName: 'McKeldin', subject: '', vibe: 'quiet', lat: null, lng: null, at: new Date(2026, 9, 27, 19).getTime(), minutes: 90, role: 'host', with: ['Ben'] }],
      water: { '2026-10-27': 6, '2026-10-01': 8 }, checkins: [], from: periodStart('week', now), now,
    });
    expect(w).toMatchObject({ minutes: 180, sessions: 3, days: 3, longest: 90, weekday: 'Tuesday', hour: 21, spot: 'McKeldin', people: 1, buddy: 'Ben', hosted: 1, glasses: 6, change: null });
    expect(w.subjects[0]).toEqual({ name: 'STAT400', minutes: 150 });
    expect(new Date(periodStart('semester', now)).getMonth()).toBe(7);
  });
});

import { packsEarned, petMood, rollItem, treeStage } from '@/features/garden/logic';

describe('garden', () => {
  it('grows the tree with focus minutes', () => {
    expect(treeStage(0)).toMatchObject({ stage: 0, name: 'Seed', next: { name: 'Sprout', need: 60 } });
    expect(treeStage(500).name).toBe('Sapling');
    expect(treeStage(99999)).toMatchObject({ name: 'Grand oak', next: null });
  });
  it('sets the pet mood from today', () => {
    const now = Date.now();
    expect(petMood({ today: 60, goal: 60, lastSessionAt: now, now })).toBe('thriving');
    expect(petMood({ today: 0, goal: 60, lastSessionAt: now - 86_400_000, now })).toBe('sleepy');
    expect(petMood({ today: 0, goal: 60, lastSessionAt: null, now })).toBe('missing');
  });
  it('gives a pack per hour and rolls by rarity', () => {
    expect(packsEarned(179)).toBe(2);
    expect(rollItem(0.01, 0).rarity).toBe('epic');
    expect(rollItem(0.2, 0).rarity).toBe('rare');
    expect(rollItem(0.99, 0.99).rarity).toBe('common');
  });
});

import { pickQuestion } from '@/features/games/pop-quiz';

describe('pop quiz', () => {
  it('asks a due card with four different answers', () => {
    const card = (id: string, back: string, due: number | null) => ({ id, front: `Q ${id}`, back, ...(due === null ? {} : { srs: { due, interval: 1, ease: 2.5, reps: 1, lapses: 0 } }) });
    const set = { id: 's', name: 'Bio', folder: 'General', createdAt: 0, cards: [card('a', 'A', Date.now() + 1e9), card('b', 'B', Date.now() + 1e9), card('c', 'C', 0), card('d', 'D', Date.now() + 1e9)] } as never;
    const q = pickQuestion([set])!;
    expect(q.cardId).toBe('c');
    expect(q.options.sort()).toEqual(['A', 'B', 'C', 'D']);
    expect(pickQuestion([{ id: 't', name: 'x', folder: 'General', createdAt: 0, cards: [card('a', 'A', null)] } as never])).toBeNull();
  });
});
