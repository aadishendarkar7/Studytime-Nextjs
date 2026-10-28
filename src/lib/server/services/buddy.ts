import 'server-only';
import { getStorage } from '../storage';
import { HttpError } from '../http';
import { publicId, secret } from '../ids';
import type { BuddyView } from '@/lib/types';

/*
 * Focus Buddy: silent pairing with someone who is focusing right now.
 * No video and no chat; each side only sees the other's name, task and timer.
 */
const KEY = 'buddy';
const ACTIVE_MS = 45_000;

interface Stored extends BuddyView { owner: string; school: string; match: string | null }
export interface BuddyInput { name: string; course: string; task: string; school: string; endsAt: number }

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const view = ({ owner, school, match, ...b }: Stored): BuddyView => (void [owner, school, match], b);

async function all() {
  const s = getStorage();
  const now = Date.now();
  const list = Object.values(await s.hgetall<Stored>(KEY));
  const old = list.filter((b) => b.endsAt < now - 30 * 60_000 || (b.status === 'left' && now - b.lastSeen > 10 * 60_000));
  await Promise.all(old.map((b) => s.hdel(KEY, b.id)));
  return list.filter((b) => !old.includes(b));
}

export async function joinQueue(input: BuddyInput) {
  const now = Date.now();
  if (input.endsAt < now + 2 * 60_000 || input.endsAt > now + 4 * 3_600_000) throw new HttpError(400, 'Start a session of at least a few minutes to find a buddy.');
  const token = secret(20);
  const b: Stored = { id: secret(6), owner: publicId(token), name: input.name, course: input.course, task: input.task, school: input.school, startedAt: now, endsAt: input.endsAt, status: 'focusing', lastSeen: now, match: null };
  await getStorage().hset(KEY, b.id, b);
  return { id: b.id, token };
}

async function mine(id: string, token: string | null) {
  const b = await getStorage().hget<Stored>(KEY, id);
  if (!b) throw new HttpError(404, 'This focus session has ended.');
  if (!token || b.owner !== publicId(token)) throw new HttpError(403, 'Not your session.');
  return b;
}

/** Refreshes your presence and, if you are still alone, pairs you with the best match. */
export async function poll(id: string, token: string | null) {
  const s = getStorage();
  let me = await mine(id, token);
  const now = Date.now();
  me = { ...me, lastSeen: me.status === 'focusing' ? now : me.lastSeen };
  if (!me.match && me.status === 'focusing') {
    const score = (o: Stored) => (me.course && norm(o.course) === norm(me.course) ? 2 : 0) + (me.school && norm(o.school) === norm(me.school) ? 1 : 0);
    const candidates = (await all())
      .filter((o) => o.id !== me.id && !o.match && o.status === 'focusing' && now - o.lastSeen < ACTIVE_MS && o.endsAt > now + 60_000)
      .sort((a, b) => score(b) - score(a) || a.startedAt - b.startedAt);
    const other = candidates[0];
    // Give a same-course match 20 seconds to turn up before pairing across courses.
    const patient = other && me.course && score(other) < 2 && now - me.startedAt < 20_000;
    if (other && !patient) {
      me.match = other.id;
      await s.hset(KEY, other.id, { ...other, match: me.id });
    }
  }
  await s.hset(KEY, me.id, me);
  const buddy = me.match ? await s.hget<Stored>(KEY, me.match) : null;
  return { me: view(me), buddy: buddy ? view(buddy) : null, sameCourse: Boolean(buddy && me.course && norm(buddy.course) === norm(me.course)) };
}

export async function setStatus(id: string, token: string | null, status: 'done' | 'left') {
  const me = await mine(id, token);
  await getStorage().hset(KEY, id, { ...me, status, lastSeen: Date.now() });
  return { ok: true };
}
