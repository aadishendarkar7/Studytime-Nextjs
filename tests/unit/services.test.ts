import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryStorage } from '@/lib/server/storage/memory';
import { setStorage } from '@/lib/server/storage';
import { createCircle, joinCircle, updateCircleMember } from '@/lib/server/services/circles';
import { advanceClass, answerClass, authorize, classLeaderboard, createClass, joinClass } from '@/lib/server/services/classes';
import { registerProfile, scopedLeaderboard, updateProfile } from '@/lib/server/services/leaderboard';
import { listDecks, shareDeck } from '@/lib/server/services/decks';

beforeEach(() => setStorage(new MemoryStorage()));

const cards = [{ front: 'Q1', back: 'A' }, { front: 'Q2', back: 'B' }, { front: 'Q3', back: 'C' }];

describe('circles', () => {
  it('creates, joins, and ranks members', async () => {
    const c = await createCircle('Ana');
    const b = await joinCircle(c.code, 'Ben');
    await updateCircleMember(c.code, c.memberId, { name: 'Ana', minutes: 30, streak: 2 });
    const { members } = await updateCircleMember(c.code, b.memberId, { name: 'Ben', minutes: 90, streak: 1 });
    expect(members.map((m) => m.name)).toEqual(['Ben', 'Ana']);
    expect(members[0].id).toBe(b.publicId);
    await expect(joinCircle('DEADBEEF', 'X')).rejects.toThrow('Invite code not found');
  });
});

describe('class study', () => {
  it('runs a full round with scoring and host-only control', async () => {
    const host = await createClass({ name: 'Bio', setName: 'Set', student: 'Host', cards });
    const kid = await joinClass(host.code, 'Kid');
    const h = await authorize(host.code, host.token);
    let view = await advanceClass(h.room, host.token);
    expect(view.round?.status).toBe('question');
    expect(view.round?.options).toContain('A');
    const k = await authorize(host.code, kid.token);
    await expect(advanceClass(k.room, kid.token)).rejects.toThrow('Only the host');
    view = await answerClass(k.room, kid.token, 'A');
    expect(view.round?.yourAnswer).toBe('A');
    await expect(answerClass(k.room, kid.token, 'A')).rejects.toThrow('already answered');
    view = await advanceClass((await authorize(host.code, host.token)).room, host.token);
    expect(view.round?.correct).toBe('A');
    expect(view.members.find((m) => m.name === 'Kid')?.score).toBe(100);
    const board = await classLeaderboard(host.code, kid.token);
    expect(board.entries.every((e) => e.id.length === 16)).toBe(true);
  });
  it('requires two distinct answers', async () => {
    await expect(createClass({ name: 'x', setName: 'y', student: 'z', cards: [{ front: 'a', back: 'same' }, { front: 'b', back: 'same' }] })).rejects.toThrow('two cards');
  });
});

describe('leaderboards', () => {
  it('filters by school and major, case-insensitively', async () => {
    const a = await registerProfile();
    const b = await registerProfile();
    const c = await registerProfile();
    await updateProfile(a.token, { name: 'A', school: 'State U', major: 'Biology', year: '1', minutes: 50 });
    await updateProfile(b.token, { name: 'B', school: 'state u', major: 'Business', year: '1', minutes: 80 });
    await updateProfile(c.token, { name: 'C', school: 'Other', major: 'Biology', year: '1', minutes: 99 });
    expect((await scopedLeaderboard(a.token, 'school')).entries.map((e) => e.name)).toEqual(['B', 'A']);
    expect((await scopedLeaderboard(a.token, 'major')).entries.map((e) => e.name)).toEqual(['A']);
    await expect(scopedLeaderboard('nope', 'school')).rejects.toThrow('not found');
  });
});

describe('decks', () => {
  it('shares and lists newest first', async () => {
    await shareDeck({ name: 'One', subject: '', author: 'A', cards });
    await new Promise((r) => setTimeout(r, 2));
    await shareDeck({ name: 'Two', subject: 'Bio', author: 'B', cards });
    expect((await listDecks()).map((d) => d.name)).toEqual(['Two', 'One']);
  });
});

describe('storage', () => {
  it('expires keys and counts rate-limit windows', async () => {
    const s = new MemoryStorage();
    await s.set('k', 1, 0.001);
    await new Promise((r) => setTimeout(r, 5));
    expect(await s.get('k')).toBeNull();
    expect(await s.incr('rl', 60)).toBe(1);
    expect(await s.incr('rl', 60)).toBe(2);
  });
});
