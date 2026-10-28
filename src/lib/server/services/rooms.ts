import 'server-only';
import { getStorage } from '../storage';
import { HttpError } from '../http';
import { code as makeCode, publicId, secret } from '../ids';

/** Rooms are deleted a week after anyone last opened them. */
const ROOM_TTL = 7 * 86_400;
/** A member counts as here if their page checked in within this window. */
export const ONLINE_MS = 75_000;
const MAX_MEMBERS = 30;

export type MemberStatus = 'focusing' | 'break' | 'idle';

interface Member {
  name: string;
  status: MemberStatus;
  subject: string;
  endsAt: number | null;
  weekMinutes: number;
  weeklyGoal: number;
  lastSeen: number;
  joinedAt: number;
}

interface Meta {
  name: string;
  createdAt: number;
  group: { startsAt: number; endsAt: number; minutes: number; by: string } | null;
  kudos: { id: string; to: string; from: string; at: number }[];
}

export interface RoomView {
  code: string;
  name: string;
  me: string;
  group: Meta['group'];
  members: { id: string; name: string; status: MemberStatus; subject: string; endsAt: number | null; weekMinutes: number; weeklyGoal: number; online: boolean; lastSeen: number }[];
  kudos: { id: string; from: string; at: number }[];
}

const metaKey = (c: string) => `roommeta:${c}`;
const membersKey = (c: string) => `roommembers:${c}`;

async function loadMeta(c: string) {
  const meta = await getStorage().get<Meta>(metaKey(c));
  if (!meta) throw new HttpError(404, 'Room not found. It may have closed after a week without visitors.');
  return meta;
}

async function touch(c: string, meta: Meta) {
  const s = getStorage();
  await s.set(metaKey(c), meta, ROOM_TTL);
  await s.expire(membersKey(c), ROOM_TTL);
}

export async function createRoom(roomName: string, name: string) {
  const s = getStorage();
  let c = makeCode(6);
  for (let i = 0; i < 5 && (await s.get(metaKey(c))); i++) c = makeCode(6);
  await s.set<Meta>(metaKey(c), { name: roomName, createdAt: Date.now(), group: null, kudos: [] }, ROOM_TTL);
  const { memberId } = await joinRoom(c, name);
  return { code: c, memberId };
}

export async function joinRoom(c: string, name: string) {
  const meta = await loadMeta(c);
  const s = getStorage();
  if ((await s.hlen(membersKey(c))) >= MAX_MEMBERS) throw new HttpError(409, 'This room is full.');
  const memberId = secret(16);
  const now = Date.now();
  await s.hset<Member>(membersKey(c), memberId, { name, status: 'idle', subject: '', endsAt: null, weekMinutes: 0, weeklyGoal: 0, lastSeen: now, joinedAt: now });
  await touch(c, meta);
  return { memberId };
}

async function view(c: string, meta: Meta, memberId: string, since: number): Promise<RoomView> {
  const all = await getStorage().hgetall<Member>(membersKey(c));
  const now = Date.now();
  const me = publicId(memberId);
  const members = Object.entries(all)
    .map(([id, m]) => ({ id: publicId(id), name: m.name, status: m.status, subject: m.subject, endsAt: m.endsAt, weekMinutes: m.weekMinutes, weeklyGoal: m.weeklyGoal, lastSeen: m.lastSeen, online: now - m.lastSeen < ONLINE_MS }))
    .sort((a, b) => Number(b.online) - Number(a.online) || b.weekMinutes - a.weekMinutes);
  return {
    code: c,
    name: meta.name,
    me,
    group: meta.group && meta.group.endsAt > now ? meta.group : null,
    members,
    kudos: meta.kudos.filter((k) => k.to === me && k.at > since).map(({ id, from, at }) => ({ id, from, at })),
  };
}

async function member(c: string, memberId: string) {
  const m = await getStorage().hget<Member>(membersKey(c), memberId);
  if (!m) throw new HttpError(403, 'You are not in this room. Join it again with the code.');
  return m;
}

/** Called every few seconds by each open page: updates the member and returns the room. */
export async function heartbeat(c: string, memberId: string, update: Omit<Member, 'lastSeen' | 'joinedAt'>, since: number) {
  const meta = await loadMeta(c);
  const m = await member(c, memberId);
  await getStorage().hset<Member>(membersKey(c), memberId, { ...m, ...update, lastSeen: Date.now() });
  await touch(c, meta);
  return view(c, meta, memberId, since);
}

export async function startGroup(c: string, memberId: string, minutes: number) {
  const meta = await loadMeta(c);
  const m = await member(c, memberId);
  const startsAt = Date.now() + 30_000; // a short countdown so others can join
  meta.group = { startsAt, endsAt: startsAt + minutes * 60_000, minutes, by: m.name };
  await touch(c, meta);
  return view(c, meta, memberId, Date.now());
}

export async function sendKudos(c: string, memberId: string, to: string) {
  const meta = await loadMeta(c);
  const m = await member(c, memberId);
  if (to === publicId(memberId)) throw new HttpError(400, 'Send kudos to someone else in the room.');
  const recent = meta.kudos.filter((k) => k.from === m.name && k.to === to && Date.now() - k.at < 60_000);
  if (recent.length) throw new HttpError(429, 'You just sent them kudos.');
  meta.kudos = [...meta.kudos, { id: secret(4), to, from: m.name, at: Date.now() }].slice(-60);
  await touch(c, meta);
  return { ok: true };
}

export async function leaveRoom(c: string, memberId: string) {
  await getStorage().hdel(membersKey(c), memberId);
  return { ok: true };
}
