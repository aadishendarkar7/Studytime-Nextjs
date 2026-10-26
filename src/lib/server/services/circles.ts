import 'server-only';
import { getStorage } from '../storage';
import { HttpError } from '../http';
import { code as makeCode, publicId, secret } from '../ids';
import type { CircleMemberView } from '@/lib/types';

const TTL = 60 * 60 * 24 * 180; // circles live 180 days after their last activity
const MAX_MEMBERS = 50;
interface Member { name: string; minutes: number; streak: number; updatedAt: number }

const metaKey = (c: string) => `circle:${c}`;
const membersKey = (c: string) => `circle:${c}:m`;

async function touch(c: string) {
  const s = getStorage();
  await Promise.all([s.expire(metaKey(c), TTL), s.expire(membersKey(c), TTL)]);
}

async function addMember(c: string, name: string) {
  const id = secret();
  await getStorage().hset<Member>(membersKey(c), id, { name, minutes: 0, streak: 0, updatedAt: Date.now() });
  await touch(c);
  return { memberId: id, publicId: publicId(id) };
}

export async function createCircle(name: string) {
  const s = getStorage();
  let c: string;
  do c = makeCode(8);
  while (await s.get(metaKey(c)));
  await s.set(metaKey(c), { createdAt: Date.now() }, TTL);
  return { code: c, ...(await addMember(c, name)) };
}

export async function joinCircle(c: string, name: string) {
  const s = getStorage();
  if (!(await s.get(metaKey(c)))) throw new HttpError(404, 'Invite code not found');
  if ((await s.hlen(membersKey(c))) >= MAX_MEMBERS) throw new HttpError(400, 'This circle is full');
  return addMember(c, name);
}

export async function updateCircleMember(c: string, memberId: string, update: { name: string; minutes: number; streak: number }) {
  const s = getStorage();
  const current = await s.hget<Member>(membersKey(c), memberId);
  if (!current) throw new HttpError(404, 'Circle member not found');
  await s.hset<Member>(membersKey(c), memberId, { ...update, updatedAt: Date.now() });
  await touch(c);
  return { members: await listMembers(c) };
}

export async function listMembers(c: string): Promise<CircleMemberView[]> {
  const all = await getStorage().hgetall<Member>(membersKey(c));
  return Object.entries(all)
    .map(([id, m]) => ({ id: publicId(id), name: m.name, minutes: m.minutes, streak: m.streak }))
    .sort((a, b) => b.minutes - a.minutes);
}
