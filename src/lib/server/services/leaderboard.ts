import 'server-only';
import { getStorage } from '../storage';
import { HttpError } from '../http';
import { currentWeek, publicId, secret } from '../ids';
import type { LeaderboardResult, LeaderScope } from '@/lib/types';

interface Profile { name: string; school: string; major: string; year: string; minutes: number; week: string }
const KEY = 'lb:profiles';

export async function registerProfile() {
  const token = secret(24);
  await getStorage().hset<Profile>(KEY, token, { name: 'Student', school: '', major: '', year: '', minutes: 0, week: currentWeek() });
  return { token, id: publicId(token) };
}

async function load(token: string | null) {
  const profile = token ? await getStorage().hget<Profile>(KEY, token) : null;
  if (!profile || !token) throw new HttpError(401, 'Leaderboard profile not found');
  return profile;
}

export async function updateProfile(token: string | null, update: Omit<Profile, 'week'>) {
  await load(token);
  await getStorage().hset<Profile>(KEY, token!, { ...update, week: currentWeek() });
  return { id: publicId(token!) };
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export async function scopedLeaderboard(token: string | null, scope: Exclude<LeaderScope, 'class'>): Promise<LeaderboardResult> {
  const me = await load(token);
  const needed = scope === 'school' ? me.school : scope === 'major' ? me.major : me.year;
  if (!me.school || !needed) return { scope, label: '', entries: [], message: `Set your ${!me.school ? 'school' : scope} to view this board.` };
  const week = currentWeek();
  const all = await getStorage().hgetall<Profile>(KEY);
  const entries = Object.entries(all)
    .filter(([, p]) => same(p.school, me.school) && (scope === 'school' || same(String(p[scope]), String(needed))))
    .map(([id, p]) => ({ id: publicId(id), name: p.name, minutes: p.week === week ? p.minutes : 0, major: p.major, year: p.year }))
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 100);
  return { scope, label: scope === 'school' ? me.school : scope === 'major' ? me.major : `Year ${me.year}`, entries };
}
