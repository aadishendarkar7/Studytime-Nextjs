import 'server-only';
import type { Account } from '../accounts';
import { creditInvite, getAccount } from '../accounts';
import { HttpError } from '../http';
import { secret } from '../ids';
import { getStorage } from '../storage';
import type { FeedPost, PersonView, PostVisibility } from '@/lib/types';

/* Study highlights: a recap of a session that friends can see and cheer. Kept for 90 days. */
const POSTS = 'feed-posts';
const FOLLOWS = (id: string) => `follows:${id}`;
const FOLLOWERS = (id: string) => `followers:${id}`;
const USERS = 'users';
const BLOCKS = (id: string) => `blocks:${id}`;
const HIDDEN = (id: string) => `feed-hidden:${id}`;
const REPORTS = 'feed-reports';
/** A highlight reported by this many different people is hidden from everyone but its author. */
const HIDE_AFTER = 3;
const KEEP = 90 * 86_400_000;
const WEEK = 7 * 86_400_000;

const same = (a: string, b: string) => Boolean(a.trim()) && a.trim().toLowerCase() === b.trim().toLowerCase();

async function allPosts() {
  const s = getStorage();
  const now = Date.now();
  const list = Object.values(await s.hgetall<FeedPost>(POSTS));
  const old = list.filter((p) => p.at < now - KEEP);
  await Promise.all(old.map((p) => s.hdel(POSTS, p.id)));
  return list.filter((p) => p.at >= now - KEEP);
}

export const following = async (id: string) => Object.keys(await getStorage().hgetall<number>(FOLLOWS(id)));
const blocked = async (id: string) => new Set(Object.keys(await getStorage().hgetall<number>(BLOCKS(id))));

/** People this viewer should never see, and who should never see them: either side blocked. */
async function walls(viewer: Account) {
  const s = getStorage();
  const mine = await blocked(viewer.id);
  const hidden = new Set(Object.keys(await s.hgetall<number>(HIDDEN(viewer.id))));
  return { mine, hidden, blocks: async (otherId: string) => mine.has(otherId) || Boolean(await s.hget(BLOCKS(otherId), viewer.id)) };
}

/** Can this viewer see this post? */
export function visible(p: FeedPost & { reports?: number }, viewer: Account, follows: Set<string>) {
  if (p.userId === viewer.id) return true;
  if ((p.reports ?? 0) >= HIDE_AFTER) return false;
  if (p.visibility === 'everyone') return true;
  if (p.visibility === 'school') return same(p.school, viewer.profile.school) || follows.has(p.userId);
  return follows.has(p.userId);
}

export async function listFeed(viewer: Account, scope: 'following' | 'school' | 'mine', before = Infinity) {
  const follows = new Set(await following(viewer.id));
  const w = await walls(viewer);
  const posts = (await allPosts()).filter((p) => p.at < before && visible(p, viewer, follows) && !w.hidden.has(p.id) && !w.mine.has(p.userId));
  const authors = [...new Set(posts.map((p) => p.userId))];
  const theyBlocked = new Set((await Promise.all(authors.map(async (a) => ((await w.blocks(a)) ? a : null)))).filter(Boolean));
  return posts
    .filter((p) => !theyBlocked.has(p.userId))
    .filter((p) => (scope === 'mine' ? p.userId === viewer.id : scope === 'following' ? p.userId === viewer.id || follows.has(p.userId) : same(p.school, viewer.profile.school) || p.userId === viewer.id))
    .sort((a, b) => b.at - a.at)
    .slice(0, 40)
    .map(strip);
}

const strip = (p: FeedPost & { reports?: number; reporters?: string[] }): FeedPost => {
  const { reports, reporters, ...rest } = p;
  void reports;
  void reporters;
  return rest;
};

export async function createPost(author: Account, input: { minutes: number; subject: string; topics: string[]; place: string; with: string[]; note: string; visibility: PostVisibility; at?: number }) {
  const now = Date.now();
  const recent = (await allPosts()).filter((p) => p.userId === author.id && p.at > now - 86_400_000);
  if (recent.length >= 20) throw new HttpError(429, 'That is a lot of posts for one day. Try again tomorrow.');
  const post: FeedPost = {
    id: secret(8),
    userId: author.id,
    name: author.name,
    school: author.profile.school,
    major: author.profile.major,
    minutes: input.minutes,
    subject: input.subject,
    topics: input.topics,
    place: input.place,
    with: input.with,
    note: input.note,
    at: Math.min(now, Math.max(now - 3 * 86_400_000, input.at ?? now)),
    visibility: input.visibility,
    kudos: [],
    kudosNames: [],
  };
  await getStorage().hset(POSTS, post.id, post);
  return strip(post);
}

async function postFor(viewer: Account, id: string) {
  const p = await getStorage().hget<FeedPost>(POSTS, id);
  if (!p || !visible(p, viewer, new Set(await following(viewer.id))) || (p.userId !== viewer.id && (await (await walls(viewer)).blocks(p.userId)))) throw new HttpError(404, 'This post is gone.');
  return p;
}

/** Report a highlight: it disappears for you now, and for everyone after a few reports. */
export async function reportPost(viewer: Account, id: string, reason: string) {
  const s = getStorage();
  const p = (await postFor(viewer, id)) as FeedPost & { reports?: number; reporters?: string[] };
  if (p.userId === viewer.id) throw new HttpError(400, 'You cannot report your own highlight.');
  await s.hset(HIDDEN(viewer.id), id, Date.now());
  if ((p.reporters ?? []).includes(viewer.id)) return;
  await s.hset(POSTS, id, { ...p, reports: (p.reports ?? 0) + 1, reporters: [...(p.reporters ?? []), viewer.id] });
  await s.hset(REPORTS, `${id}:${viewer.id}`, { postId: id, author: p.userId, authorName: p.name, reporter: viewer.id, reason, at: Date.now(), subject: p.subject, note: p.note, place: p.place });
}

/** Block someone: you stop seeing each other, and any follows between you are removed. */
export async function block(viewer: Account, targetId: string, on: boolean) {
  if (targetId === viewer.id) throw new HttpError(400, 'You cannot block yourself.');
  const s = getStorage();
  if (on) {
    await s.hset(BLOCKS(viewer.id), targetId, Date.now());
    await follow(viewer, targetId, false).catch(() => undefined);
    await s.hdel(FOLLOWS(targetId), viewer.id);
    await s.hdel(FOLLOWERS(viewer.id), targetId);
  } else await s.hdel(BLOCKS(viewer.id), targetId);
}

export async function blockedPeople(viewer: Account) {
  const ids = [...(await blocked(viewer.id))];
  const people = await Promise.all(ids.map((id) => getAccount(id)));
  return people.filter((a): a is Account => Boolean(a)).map((a) => ({ id: a.id, name: a.name, school: a.profile.school }));
}

/** When an account is deleted: its highlights, follows and blocks go too. */
export async function removeUserSocial(id: string) {
  const s = getStorage();
  for (const p of await allPosts()) if (p.userId === id) await s.hdel(POSTS, p.id);
  for (const other of Object.keys(await s.hgetall<number>(FOLLOWS(id)))) await s.hdel(FOLLOWERS(other), id);
  for (const other of Object.keys(await s.hgetall<number>(FOLLOWERS(id)))) await s.hdel(FOLLOWS(other), id);
  await Promise.all([s.del(FOLLOWS(id)), s.del(FOLLOWERS(id)), s.del(BLOCKS(id)), s.del(HIDDEN(id))]);
}

export async function deletePost(viewer: Account, id: string) {
  const p = await getStorage().hget<FeedPost>(POSTS, id);
  if (!p) return;
  if (p.userId !== viewer.id) throw new HttpError(403, 'You can only delete your own posts.');
  await getStorage().hdel(POSTS, id);
}

export async function toggleKudos(viewer: Account, id: string) {
  const p = await postFor(viewer, id);
  const has = p.kudos.includes(viewer.id);
  const next: FeedPost = has
    ? { ...p, kudos: p.kudos.filter((k) => k !== viewer.id), kudosNames: p.kudosNames.filter((_, i) => p.kudos[i] !== viewer.id) }
    : { ...p, kudos: [...p.kudos, viewer.id], kudosNames: [...p.kudosNames, viewer.name] };
  await getStorage().hset(POSTS, id, next);
  return strip(next);
}

export async function follow(viewer: Account, targetId: string, on: boolean) {
  if (targetId === viewer.id) throw new HttpError(400, 'You cannot follow yourself.');
  if (!(await getAccount(targetId))) throw new HttpError(404, 'That person was not found.');
  const s = getStorage();
  if (on && (await (await walls(viewer)).blocks(targetId))) throw new HttpError(404, 'That person was not found.');
  if (on) {
    if ((await s.hlen(FOLLOWS(viewer.id))) >= 500) throw new HttpError(400, 'You can follow up to 500 people.');
    await s.hset(FOLLOWS(viewer.id), targetId, Date.now());
    await s.hset(FOLLOWERS(targetId), viewer.id, Date.now());
  } else {
    await s.hdel(FOLLOWS(viewer.id), targetId);
    await s.hdel(FOLLOWERS(targetId), viewer.id);
  }
}

async function personView(viewer: Account, a: Account, follows: Set<string>, posts: FeedPost[]): Promise<PersonView> {
  const s = getStorage();
  const mine = posts.filter((p) => p.userId === a.id);
  return {
    id: a.id,
    name: a.name,
    school: a.profile.school,
    major: a.profile.major,
    year: a.profile.year,
    following: follows.has(a.id),
    followsYou: Boolean(await s.hget(FOLLOWS(a.id), viewer.id)),
    followers: await s.hlen(FOLLOWERS(a.id)),
    weekMinutes: mine.filter((p) => p.at > Date.now() - WEEK && visible(p, viewer, follows)).reduce((n, p) => n + p.minutes, 0),
    posts: mine.filter((p) => visible(p, viewer, follows)).length,
  };
}

/** Search people by name, or with no query: people at your school and in your classes first. */
export async function searchPeople(viewer: Account, q: string) {
  const w = await walls(viewer);
  const everyone = Object.values(await getStorage().hgetall<Account>(USERS)).filter((a) => a.id !== viewer.id && a.onboarded && !w.mine.has(a.id));
  const theyBlocked = new Set((await Promise.all(everyone.map(async (a) => ((await getStorage().hget(BLOCKS(a.id), viewer.id)) ? a.id : null)))).filter(Boolean));
  const all = everyone.filter((a) => !theyBlocked.has(a.id));
  const follows = new Set(await following(viewer.id));
  const query = q.trim().toLowerCase();
  const myCourses = new Set(viewer.profile.courses.map((c) => c.toUpperCase()));
  const score = (a: Account) => (same(a.profile.school, viewer.profile.school) ? 2 : 0) + a.profile.courses.filter((c) => myCourses.has(c.toUpperCase())).length;
  const matches = (query ? all.filter((a) => a.name.toLowerCase().includes(query) || a.profile.school.toLowerCase().includes(query) || a.profile.major.toLowerCase().includes(query)) : all.filter((a) => score(a) > 0 || follows.has(a.id)))
    .sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name))
    .slice(0, 30);
  const posts = await allPosts();
  return Promise.all(matches.map((a) => personView(viewer, a, follows, posts)));
}

export async function getPerson(viewer: Account, id: string) {
  const a = await getAccount(id);
  if (!a || (id !== viewer.id && (await (await walls(viewer)).blocks(id)))) throw new HttpError(404, 'That person was not found.');
  const follows = new Set(await following(viewer.id));
  const posts = await allPosts();
  return { person: await personView(viewer, a, follows, posts), posts: posts.filter((p) => p.userId === id && visible(p, viewer, follows)).sort((x, y) => y.at - x.at).slice(0, 20).map(strip) };
}

/** A new account made from someone's invite link: credit them, and follow each other. */
export async function joinedByInvite(inviterId: string, newId: string) {
  const inviter = await creditInvite(inviterId, newId);
  const fresh = await getAccount(newId);
  if (!inviter || !fresh) return;
  await follow(fresh, inviter.id, true).catch(() => undefined);
  await follow(inviter, fresh.id, true).catch(() => undefined);
}

/** Public: who sent this invite link. */
export async function inviteCard(id: string) {
  const a = await getAccount(id);
  if (!a) throw new HttpError(404, 'This invite link is not valid.');
  return { name: a.name, school: a.profile.school };
}

export const courseKey = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** A class page: classmates in the course at your school, and highlights about it. */
export async function classPage(viewer: Account, course: string) {
  const key = courseKey(course);
  if (!key) throw new HttpError(400, 'Pick a class.');
  const w = await walls(viewer);
  const follows = new Set(await following(viewer.id));
  const everyone = Object.values(await getStorage().hgetall<Account>(USERS)).filter((a) => a.onboarded && !w.mine.has(a.id) && a.profile.courses.some((c) => courseKey(c) === key) && (!viewer.profile.school || same(a.profile.school, viewer.profile.school)));
  const posts = (await allPosts()).filter((p) => visible(p, viewer, follows) && !w.hidden.has(p.id) && !w.mine.has(p.userId) && [p.subject, ...p.topics].some((t) => courseKey(t).includes(key)));
  const week = Date.now() - 7 * 86_400_000;
  const minutes = new Map<string, number>();
  for (const p of posts) if (p.at > week) minutes.set(p.userId, (minutes.get(p.userId) ?? 0) + p.minutes);
  return {
    course: key,
    members: everyone
      .map((a) => ({ id: a.id, name: a.id === viewer.id ? 'You' : a.name, major: a.profile.major, year: a.profile.year, following: follows.has(a.id), me: a.id === viewer.id, weekMinutes: minutes.get(a.id) ?? 0 }))
      .sort((a, b) => b.weekMinutes - a.weekMinutes || a.name.localeCompare(b.name))
      .slice(0, 200),
    posts: posts.sort((a, b) => b.at - a.at).slice(0, 30).map(strip),
  };
}
