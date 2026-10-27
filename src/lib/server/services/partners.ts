import 'server-only';
import { getStorage } from '../storage';
import { HttpError } from '../http';
import { publicId, secret } from '../ids';
import type { PartnerFormat, PartnerInput, PartnerListing } from '@/lib/types';

const KEY = 'partners';
const MAX = 3000;
/** Listings disappear after 30 days without an update so the list stays current. */
export const PARTNER_TTL_MS = 30 * 24 * 3600 * 1000;

interface Stored extends PartnerListing { owner: string }

/** Course codes compare without spaces or case: "math 240" matches "MATH240". */
export const courseKey = (c: string) => c.replace(/[\s-]+/g, '').toUpperCase();
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const strip = ({ owner, ...listing }: Stored): PartnerListing => (void owner, listing);

async function all(): Promise<Stored[]> {
  const s = getStorage();
  const entries = Object.values(await s.hgetall<Stored>(KEY));
  const cutoff = Date.now() - PARTNER_TTL_MS;
  const expired = entries.filter((l) => l.updatedAt < cutoff);
  await Promise.all(expired.map((l) => s.hdel(KEY, l.id)));
  return entries.filter((l) => l.updatedAt >= cutoff);
}

export async function searchPartners(q: { school: string; course: string; format: PartnerFormat | '' }) {
  const course = courseKey(q.course);
  return (await all())
    .filter((l) => !q.school || same(l.school, q.school))
    .filter((l) => !course || l.courses.some((c) => courseKey(c).includes(course)))
    .filter((l) => !q.format || q.format === 'either' || l.format === q.format || l.format === 'either')
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 100)
    .map(strip);
}

export async function createListing(input: PartnerInput) {
  const s = getStorage();
  const existing = await all();
  if (existing.length >= MAX) {
    const oldest = existing.sort((a, b) => a.updatedAt - b.updatedAt)[0];
    await s.hdel(KEY, oldest.id);
  }
  const token = secret(24);
  const listing: Stored = { ...input, id: secret(6), updatedAt: Date.now(), owner: publicId(token) };
  await s.hset(KEY, listing.id, listing);
  return { id: listing.id, token };
}

async function owned(id: string, token: string | null) {
  const listing = await getStorage().hget<Stored>(KEY, id);
  if (!listing) throw new HttpError(404, 'Listing not found. It may have expired.');
  if (!token || listing.owner !== publicId(token)) throw new HttpError(403, 'You can only change your own listing');
  return listing;
}

export async function updateListing(id: string, token: string | null, input: PartnerInput) {
  const listing = await owned(id, token);
  await getStorage().hset<Stored>(KEY, id, { ...listing, ...input, updatedAt: Date.now() });
  return { id };
}

export async function getOwnListing(id: string, token: string | null) {
  return strip(await owned(id, token));
}

export async function deleteListing(id: string, token: string | null) {
  await owned(id, token);
  await getStorage().hdel(KEY, id);
  return { ok: true };
}
