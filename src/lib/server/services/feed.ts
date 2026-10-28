import 'server-only';
import type { Account } from '../accounts';
import { getAccount } from '../accounts';
import { HttpError } from '../http';
import { secret } from '../ids';
import { getStorage } from '../storage';
import type { FeedPost, PersonView, PostVisibility } from '@/lib/types';

/* Study highlights: a recap of a session that friends can see and cheer. Kept for 90 days. */
const POSTS = 'feed-posts';
const FOLLOWS = (id: string) => `follows:${id}`;
const FOLLOWERS = (id: string) => `followers:${id}`;
const USERS = 'users';
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

/** Can this viewer see this post? */
export function visible(p: FeedPost, viewer: Account, follows: Set<string>) {
  if (p.userId === viewer.id) return true;
  if (p.visibility === 'everyone') return true;
  if (p.visibility === 'school') return same(p.school, viewer.profile.school) || follows.has(p.userId);
  return follows.has(p.userId);
}

export async function listFeed(viewer: Account, scope: 'following' | 'school' | 'mine', before = Infinity) {
  const follows = new Set(await following(viewer.id));
  return (await allPosts())
    .filter((p) => p.at < before && visible(p, viewer, follows))
    .filter((p) => (scope === 'mine' ? p.userId === viewer.id : scope === 'following' ? p.userId === viewer.id || follows.has(p.userId) : same(p.school, viewer.profile.school) || p.userId === viewer.id))
    .sort((a, b) => b.at - a.at)
    .slice(0, 40);
}

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
  return post;
}

async function postFor(viewer: Account, id: string) {
  const p = await getStorage().hget<FeedPost>(POSTS, id);
  if (!p || !visible(p, viewer, new Set(await following(viewer.id)))) throw new HttpError(404, 'This post is gone.');
  return p;
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
  return next;
}

export async function follow(viewer: Account, targetId: string, on: boolean) {
  if (targetId === viewer.id) throw new HttpError(400, 'You cannot follow yourself.');
  if (!(await getAccount(targetId))) throw new HttpError(404, 'That person was not found.');
  const s = getStorage();
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
  const all = Object.values(await getStorage().hgetall<Account>(USERS)).filter((a) => a.id !== viewer.id && a.onboarded);
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
  if (!a) throw new HttpError(404, 'That person was not found.');
  const follows = new Set(await following(viewer.id));
  const posts = await allPosts();
  return { person: await personView(viewer, a, follows, posts), posts: posts.filter((p) => p.userId === id && visible(p, viewer, follows)).sort((x, y) => y.at - x.at).slice(0, 20) };
}
