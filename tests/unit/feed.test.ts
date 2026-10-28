import { beforeEach, describe, expect, it } from 'vitest';
import { createAccount, updateAccount } from '@/lib/server/accounts';
import { setStorage } from '@/lib/server/storage';
import { MemoryStorage } from '@/lib/server/storage/memory';
import { createPost, deletePost, follow, getPerson, listFeed, searchPeople, toggleKudos } from '@/lib/server/services/feed';

async function person(name: string, school: string, courses: string[] = []) {
  const a = await createAccount({ email: `${name.toLowerCase()}@x.edu`, password: 'password1', name });
  return updateAccount(a.id, { profile: { school, courses }, onboarded: true });
}
const base = { minutes: 50, subject: 'STAT400', topics: ['CLT'], place: 'McKeldin', with: ['Sam'], note: '' };

beforeEach(() => setStorage(new MemoryStorage()));

describe('study highlights', () => {
  it('shows followers-only highlights to followers and school ones to classmates', async () => {
    const aadi = await person('Aadi', 'UMD', ['STAT400']);
    const maya = await person('Maya', 'UMD', ['STAT400']);
    const lee = await person('Lee', 'Georgetown');
    const p1 = await createPost(aadi, { ...base, visibility: 'followers' });
    const p2 = await createPost(aadi, { ...base, visibility: 'school' });
    expect((await listFeed(maya, 'school')).map((p) => p.id)).toEqual([p2.id]);
    expect(await listFeed(lee, 'school')).toEqual([]);
    await follow(maya, aadi.id, true);
    expect((await listFeed(maya, 'following')).map((p) => p.id).sort()).toEqual([p1.id, p2.id].sort());
    await follow(maya, aadi.id, false);
    expect((await listFeed(maya, 'following')).map((p) => p.id)).toEqual([]);
    await expect(toggleKudos(lee, p1.id)).rejects.toThrow(/gone/);
  });

  it('cheers toggle and only the author can delete', async () => {
    const aadi = await person('Aadi', 'UMD');
    const maya = await person('Maya', 'UMD');
    const p = await createPost(aadi, { ...base, visibility: 'everyone' });
    expect((await toggleKudos(maya, p.id)).kudosNames).toEqual(['Maya']);
    expect((await toggleKudos(maya, p.id)).kudos).toEqual([]);
    await expect(deletePost(maya, p.id)).rejects.toThrow(/own/);
    await deletePost(aadi, p.id);
    expect(await listFeed(aadi, 'mine')).toEqual([]);
  });

  it('suggests classmates and counts followers and weekly minutes', async () => {
    const aadi = await person('Aadi', 'UMD', ['STAT400']);
    const maya = await person('Maya', 'UMD', ['STAT400']);
    await person('Lee', 'Georgetown');
    expect((await searchPeople(aadi, '')).map((p) => p.name)).toEqual(['Maya']);
    expect((await searchPeople(aadi, 'lee')).map((p) => p.name)).toEqual(['Lee']);
    await follow(aadi, maya.id, true);
    await createPost(maya, { ...base, minutes: 90, visibility: 'followers' });
    const { person: view, posts } = await getPerson(aadi, maya.id);
    expect(view).toMatchObject({ following: true, followers: 1, weekMinutes: 90, posts: 1 });
    expect(posts).toHaveLength(1);
  });
});

describe('safety and growth', () => {
  it('blocking hides both ways and removes follows', async () => {
    const { block } = await import('@/lib/server/services/feed');
    const aadi = await person('Aadi', 'UMD');
    const troll = await person('Troll', 'UMD');
    await follow(troll, aadi.id, true);
    await createPost(troll, { ...base, visibility: 'everyone' });
    await createPost(aadi, { ...base, visibility: 'everyone' });
    await block(aadi, troll.id, true);
    expect((await listFeed(aadi, 'school')).every((p) => p.userId !== troll.id)).toBe(true);
    expect((await listFeed(troll, 'school')).every((p) => p.userId !== aadi.id)).toBe(true);
    expect((await searchPeople(troll, 'aadi')).length).toBe(0);
    await expect(follow(troll, aadi.id, true)).rejects.toThrow(/not found/);
  });

  it('hides a highlight from the reporter, and from everyone after three reports', async () => {
    const { reportPost } = await import('@/lib/server/services/feed');
    const author = await person('Author', 'UMD');
    const r = await Promise.all(['A', 'B', 'C', 'D'].map((n) => person(`R${n}`, 'UMD')));
    const p = await createPost(author, { ...base, visibility: 'school' });
    await reportPost(r[0], p.id, 'spam');
    expect(await listFeed(r[0], 'school')).toEqual([]);
    expect((await listFeed(r[3], 'school')).length).toBe(1);
    await reportPost(r[1], p.id, 'spam');
    await reportPost(r[2], p.id, 'spam');
    expect(await listFeed(r[3], 'school')).toEqual([]);
    expect((await listFeed(author, 'mine')).length).toBe(1);
  });

  it('invites credit the inviter and make them follow each other', async () => {
    const { joinedByInvite } = await import('@/lib/server/services/feed');
    const { getAccount } = await import('@/lib/server/accounts');
    const inviter = await person('Inviter', 'UMD');
    const fresh = await person('Fresh', 'UMD');
    await joinedByInvite(inviter.id, fresh.id);
    await joinedByInvite(inviter.id, fresh.id);
    expect((await getAccount(inviter.id))?.invites).toBe(1);
    expect((await getPerson(fresh, inviter.id)).person.following).toBe(true);
    expect((await getPerson(inviter, fresh.id)).person.following).toBe(true);
  });

  it('class pages list classmates in the course and its highlights', async () => {
    const { classPage } = await import('@/lib/server/services/feed');
    const aadi = await person('Aadi', 'UMD', ['STAT400']);
    await person('Maya', 'UMD', ['stat 400']);
    await person('Lee', 'UMD', ['MATH240']);
    await createPost(aadi, { ...base, subject: 'STAT 400 review', visibility: 'school' });
    const c = await classPage(aadi, 'stat400');
    expect(c.members.map((m) => m.name).sort()).toEqual(['Maya', 'You']);
    expect(c.posts).toHaveLength(1);
  });
});
