import 'server-only';
import { getStorage } from '../storage';
import { HttpError } from '../http';
import { publicId, secret } from '../ids';
import { isCircleMember } from './circles';
import type { DropInput, DropMessage, DropView } from '@/lib/types';

const KEY = 'drops';
const MAX = 5000;
const HOUR = 3_600_000;

interface Stored extends DropView {
  owner: string;
  circle: string;
  joinerOwners: Record<string, string>; // joiner public id -> hash of their token
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
/** Public shape. Older drops saved before vibes, seats and messages get defaults. */
const view = ({ owner, circle, joinerOwners, ...d }: Stored): DropView => {
  void [owner, circle, joinerOwners];
  return { ...d, vibe: d.vibe ?? 'quiet', seats: d.seats ?? null, category: d.category ?? 'Anything goes', messages: d.messages ?? [], joiners: d.joiners.map((j) => ({ ...j, status: j.status ?? 'coming' })) };
};
const MAX_MESSAGES = 80;

async function all(): Promise<Stored[]> {
  const s = getStorage();
  const now = Date.now();
  const list = Object.values(await s.hgetall<Stored>(KEY));
  // Drops disappear an hour after they end.
  const old = list.filter((d) => d.endsAt < now - HOUR);
  await Promise.all(old.map((d) => s.hdel(KEY, d.id)));
  return list.filter((d) => d.endsAt >= now - HOUR);
}

export interface Viewer { school: string; circle: string; memberId: string }

/** Drops this viewer may see: everyone-drops, drops at their school, and their circle's drops. */
export async function listDrops(viewer: Viewer) {
  const inCircle = viewer.circle ? await isCircleMember(viewer.circle, viewer.memberId) : false;
  const now = Date.now();
  return (await all())
    .filter((d) => d.endsAt > now && d.startsAt < now + 24 * HOUR)
    .filter((d) => d.audience === 'everyone' || (d.audience === 'school' && viewer.school && same(d.school, viewer.school)) || (d.audience === 'circle' && inCircle && d.circle === viewer.circle))
    .sort((a, b) => a.startsAt - b.startsAt)
    .slice(0, 200)
    .map(view);
}

export async function createDrop(input: DropInput, circle: { code: string; memberId: string } | null) {
  const now = Date.now();
  if (input.endsAt <= input.startsAt) throw new HttpError(400, 'The end time must be after the start time.');
  if (input.endsAt - input.startsAt > 12 * HOUR) throw new HttpError(400, 'A drop can last up to 12 hours.');
  if (input.startsAt > now + 7 * 24 * HOUR || input.endsAt < now) throw new HttpError(400, 'Pick a time between now and the next 7 days.');
  if (input.audience === 'circle' && (!circle || !(await isCircleMember(circle.code, circle.memberId)))) throw new HttpError(400, 'Join or create a friend circle first, or drop to your school.');
  if (input.audience === 'school' && !input.school) throw new HttpError(400, 'Add your school on your profile to drop to your school.');
  const s = getStorage();
  const existing = await all();
  if (existing.length >= MAX) throw new HttpError(503, 'Too many active drops right now. Try again soon.');
  const token = secret(24);
  const drop: Stored = { ...input, id: secret(6), createdAt: now, joiners: [], messages: [], owner: publicId(token), circle: input.audience === 'circle' ? circle!.code : '', joinerOwners: {} };
  await s.hset(KEY, drop.id, drop);
  return { id: drop.id, token };
}

async function load(id: string) {
  const d = await getStorage().hget<Stored>(KEY, id);
  if (!d || d.endsAt < Date.now() - HOUR) throw new HttpError(404, 'This drop has ended.');
  return d;
}

async function owned(id: string, token: string | null) {
  const d = await load(id);
  if (!token || d.owner !== publicId(token)) throw new HttpError(403, 'Only the person who dropped this can change it.');
  return d;
}

export async function endDrop(id: string, token: string | null) {
  await owned(id, token);
  await getStorage().hdel(KEY, id);
  return { ok: true };
}

export async function extendDrop(id: string, token: string | null, endsAt: number) {
  const d = await owned(id, token);
  if (endsAt <= Date.now() || endsAt - d.startsAt > 12 * HOUR) throw new HttpError(400, 'A drop can last up to 12 hours.');
  await getStorage().hset<Stored>(KEY, id, { ...d, endsAt });
  return view({ ...d, endsAt });
}

export async function joinDrop(id: string, name: string) {
  const d = await load(id);
  if (d.joiners.length >= (d.seats ?? 50)) throw new HttpError(409, 'Every seat at this table is taken.');
  if (d.endsAt < Date.now()) throw new HttpError(410, 'This drop has ended.');
  const token = secret(16);
  const jid = secret(4);
  const next: Stored = { ...d, joiners: [...d.joiners, { id: jid, name, at: Date.now(), status: 'coming' }], joinerOwners: { ...d.joinerOwners, [jid]: publicId(token) } };
  await getStorage().hset(KEY, id, next);
  return { joinerId: jid, token };
}

export async function leaveDrop(id: string, joinerId: string, token: string | null) {
  const d = await load(id);
  if (!token || d.joinerOwners[joinerId] !== publicId(token)) throw new HttpError(403, 'You can only take back your own join.');
  const { [joinerId]: gone, ...rest } = d.joinerOwners;
  void gone;
  await getStorage().hset<Stored>(KEY, id, { ...d, joiners: d.joiners.filter((j) => j.id !== joinerId), joinerOwners: rest });
  return { ok: true };
}

/** A single drop, for invite links. Knowing the id is what grants access. */
export async function getDrop(id: string) {
  return view(await load(id));
}

/** A joiner marks that they have arrived (or were wrong and are still on the way). */
export async function setJoinStatus(id: string, joinerId: string, token: string | null, status: 'coming' | 'here') {
  const d = await load(id);
  if (!token || d.joinerOwners[joinerId] !== publicId(token)) throw new HttpError(403, 'You can only update your own join.');
  const next: Stored = { ...d, joiners: d.joiners.map((j) => (j.id === joinerId ? { ...j, status } : j)) };
  await getStorage().hset(KEY, id, next);
  return view(next);
}

/** Short messages on a drop: "grabbed the table by the window", "running 10 min late". */
export async function postMessage(id: string, name: string, text: string, ownerToken: string | null) {
  const d = await load(id);
  if (d.endsAt < Date.now()) throw new HttpError(410, 'This drop has ended.');
  const host = !!ownerToken && d.owner === publicId(ownerToken);
  const msg: DropMessage = { id: secret(4), name, text, at: Date.now(), host };
  const next: Stored = { ...d, messages: [...(d.messages ?? []), msg].slice(-MAX_MESSAGES) };
  await getStorage().hset(KEY, id, next);
  return view(next);
}
