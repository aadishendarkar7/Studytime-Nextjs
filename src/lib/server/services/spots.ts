import 'server-only';
import { getStorage } from '../storage';
import { HttpError } from '../http';
import { publicId, secret } from '../ids';
import type { PublicSpot, SpotInput } from '@/lib/types';

const KEY = 'spots';
const MAX = 5000;

interface Stored extends PublicSpot { owner: string }

export async function listSpots(): Promise<PublicSpot[]> {
  const all = await getStorage().hgetall<Stored>(KEY);
  return Object.values(all).map(({ owner, ...spot }) => (void owner, spot));
}

export async function shareSpot(input: SpotInput) {
  const s = getStorage();
  if ((await s.hlen(KEY)) >= MAX) throw new HttpError(503, 'The public map is full right now. Your spot is still saved for you.');
  const token = secret(24);
  const spot: Stored = { ...input, id: secret(6), createdAt: Date.now(), owner: publicId(token) };
  await s.hset(KEY, spot.id, spot);
  return { id: spot.id, token };
}

export async function removeSpot(id: string, token: string | null) {
  const spot = await getStorage().hget<Stored>(KEY, id);
  if (!spot) return { ok: true };
  if (!token || spot.owner !== publicId(token)) throw new HttpError(403, 'You can only remove spots you shared');
  await getStorage().hdel(KEY, id);
  return { ok: true };
}
