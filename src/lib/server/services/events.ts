import 'server-only';
import { getStorage } from '../storage';
import { HttpError } from '../http';
import { publicId, secret } from '../ids';
import type { EventInput, EventView } from '@/lib/types';

/* Campus study events: planned group sessions anyone at your school (or everyone) can join. */
const KEY = 'events';
const DAY = 86_400_000;
interface Stored extends EventView { owner: string; goingOwners: Record<string, string> }

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const view = ({ owner, goingOwners, ...e }: Stored): EventView => (void [owner, goingOwners], e);

async function all() {
  const s = getStorage();
  const now = Date.now();
  const list = Object.values(await s.hgetall<Stored>(KEY));
  const old = list.filter((e) => e.endsAt < now - DAY);
  await Promise.all(old.map((e) => s.hdel(KEY, e.id)));
  return list.filter((e) => e.endsAt >= now - DAY);
}

export async function listEvents(school: string) {
  const now = Date.now();
  return (await all())
    .filter((e) => e.endsAt > now && (e.audience === 'everyone' || (school && same(e.school, school))))
    .sort((a, b) => a.startsAt - b.startsAt)
    .slice(0, 200)
    .map(view);
}

export async function createEvent(input: EventInput) {
  const now = Date.now();
  if (input.endsAt <= input.startsAt) throw new HttpError(400, 'The end time must be after the start time.');
  if (input.endsAt - input.startsAt > 12 * 3_600_000) throw new HttpError(400, 'An event can last up to 12 hours.');
  if (input.startsAt > now + 60 * DAY || input.endsAt < now) throw new HttpError(400, 'Pick a time in the next 60 days.');
  if (input.audience === 'school' && !input.school) throw new HttpError(400, 'Add your school on your profile, or make the event open to everyone.');
  const token = secret(20);
  const e: Stored = { ...input, id: secret(6), createdAt: now, going: [], owner: publicId(token), goingOwners: {} };
  await getStorage().hset(KEY, e.id, e);
  return { id: e.id, token };
}

async function load(id: string) {
  const e = await getStorage().hget<Stored>(KEY, id);
  if (!e) throw new HttpError(404, 'This event was removed.');
  return e;
}

export async function rsvp(id: string, name: string) {
  const e = await load(id);
  if (e.endsAt < Date.now()) throw new HttpError(410, 'This event is over.');
  if (e.capacity !== null && e.going.length >= e.capacity) throw new HttpError(409, 'This event is full.');
  const token = secret(16);
  const gid = secret(4);
  const next: Stored = { ...e, going: [...e.going, { id: gid, name }], goingOwners: { ...e.goingOwners, [gid]: publicId(token) } };
  await getStorage().hset(KEY, id, next);
  return { rsvpId: gid, token, event: view(next) };
}

export async function cancelRsvp(id: string, rsvpId: string, token: string | null) {
  const e = await load(id);
  if (!token || e.goingOwners[rsvpId] !== publicId(token)) throw new HttpError(403, 'You can only cancel your own RSVP.');
  const { [rsvpId]: gone, ...rest } = e.goingOwners;
  void gone;
  const next: Stored = { ...e, going: e.going.filter((g) => g.id !== rsvpId), goingOwners: rest };
  await getStorage().hset(KEY, id, next);
  return view(next);
}

export async function deleteEvent(id: string, token: string | null) {
  const e = await load(id);
  if (!token || e.owner !== publicId(token)) throw new HttpError(403, 'Only the host can cancel this event.');
  await getStorage().hdel(KEY, id);
  return { ok: true };
}
