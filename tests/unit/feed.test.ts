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
