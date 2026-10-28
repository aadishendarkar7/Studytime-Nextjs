import 'server-only';
import { getStorage } from '../storage';
import { HttpError } from '../http';
import { code as makeCode, currentWeek, publicId, secret } from '../ids';
import type { PactView } from '@/lib/types';

/*
 * Weekly accountability pact: two people, one weekly focus goal each.
 * Both see each other's progress. The bonus only counts if both reach the goal.
 */
const KEY = 'pacts';
interface Member { id: string; owner: string; name: string; minutes: number; week: string; updatedAt: number }
interface Stored { code: string; goal: number; createdAt: number; members: Member[] }

const view = (p: Stored): PactView => {
  const week = currentWeek();
  return { code: p.code, goal: p.goal, week, members: p.members.map((m) => ({ id: m.id, name: m.name, minutes: m.week === week ? m.minutes : 0, updatedAt: m.updatedAt })) };
};

export async function createPact(name: string, goal: number) {
  const token = secret(20);
  const pact: Stored = { code: makeCode(6), goal, createdAt: Date.now(), members: [{ id: secret(4), owner: publicId(token), name, minutes: 0, week: currentWeek(), updatedAt: Date.now() }] };
  await getStorage().hset(KEY, pact.code, pact);
  return { code: pact.code, memberId: pact.members[0].id, token };
}

async function load(code: string) {
  const p = await getStorage().hget<Stored>(KEY, code.toUpperCase());
  if (!p) throw new HttpError(404, 'No pact with that code. Check it with your partner.');
  return p;
}

export async function joinPact(code: string, name: string) {
  const p = await load(code);
  if (p.members.length >= 2) throw new HttpError(409, 'This pact already has two people.');
  const token = secret(20);
  const m: Member = { id: secret(4), owner: publicId(token), name, minutes: 0, week: currentWeek(), updatedAt: Date.now() };
  await getStorage().hset(KEY, p.code, { ...p, members: [...p.members, m] });
  return { memberId: m.id, token, pact: view({ ...p, members: [...p.members, m] }) };
}

function member(p: Stored, memberId: string, token: string | null) {
  const m = p.members.find((x) => x.id === memberId);
  if (!m || !token || m.owner !== publicId(token)) throw new HttpError(403, 'You are not in this pact.');
  return m;
}

export async function reportPact(code: string, memberId: string, token: string | null, update: { name: string; minutes: number; goal?: number }) {
  const p = await load(code);
  member(p, memberId, token);
  const next: Stored = { ...p, goal: update.goal ?? p.goal, members: p.members.map((m) => (m.id === memberId ? { ...m, name: update.name, minutes: update.minutes, week: currentWeek(), updatedAt: Date.now() } : m)) };
  await getStorage().hset(KEY, p.code, next);
  return view(next);
}

export async function leavePact(code: string, memberId: string, token: string | null) {
  const p = await load(code);
  member(p, memberId, token);
  const left = p.members.filter((m) => m.id !== memberId);
  if (left.length) await getStorage().hset(KEY, p.code, { ...p, members: left });
  else await getStorage().hdel(KEY, p.code);
  return { ok: true };
}
