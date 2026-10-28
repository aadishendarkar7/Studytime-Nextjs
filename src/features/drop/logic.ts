import type { DropLogEntry } from '@/lib/stores/extras';
import type { DropView, DropVibe } from '@/lib/types';

export const VIBES: { value: DropVibe; label: string; note: string }[] = [
  { value: 'silent', label: 'Heads down', note: 'No talking. Just company.' },
  { value: 'quiet', label: 'Quiet chat', note: 'Work quietly, questions are fine.' },
  { value: 'group', label: 'Group work', note: 'Talk through problems together.' },
];
export const vibeLabel = (v: DropVibe | undefined) => VIBES.find((x) => x.value === v)?.label ?? 'Quiet chat';

/** Great-circle distance in kilometers. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "450 ft", "0.6 mi" in the US; "140 m", "1.2 km" elsewhere. */
export function fmtDistance(km: number, miles: boolean) {
  if (miles) {
    const mi = km / 1.609344;
    return mi < 0.1 ? `${Math.max(50, Math.round((mi * 5280) / 50) * 50)} ft` : `${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi`;
  }
  return km < 1 ? `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m` : `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

const placeKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export interface HotSpot { key: string; name: string; people: number; drops: string[]; lat: number | null; lng: number | null }

/**
 * Places with the most people right now. Drops with the same place name, or
 * within 60 meters of each other, count as one spot.
 */
export function hotSpots(drops: DropView[], now: number): HotSpot[] {
  const out: HotSpot[] = [];
  for (const d of drops) {
    if (d.startsAt > now || d.endsAt <= now) continue;
    const key = placeKey(d.spotName);
    const near = out.find((h) => h.key === key || (h.lat !== null && h.lng !== null && d.lat !== null && d.lng !== null && distanceKm(h as { lat: number; lng: number }, d as { lat: number; lng: number }) < 0.06));
    const people = 1 + d.joiners.length;
    if (near) {
      near.people += people;
      near.drops.push(d.id);
    } else out.push({ key, name: d.spotName, people, drops: [d.id], lat: d.lat, lng: d.lng });
  }
  return out.sort((a, b) => b.people - a.people || a.name.localeCompare(b.name));
}

/** The places you have dropped at most recently, newest first, one per place. */
export function recentPlaces(log: DropLogEntry[], limit = 5) {
  const seen = new Set<string>();
  const out: DropLogEntry[] = [];
  for (const e of [...log].sort((a, b) => b.at - a.at)) {
    const k = placeKey(e.spotName);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(e);
    if (out.length >= limit) break;
  }
  return out;
}

export interface DropStats { thisMonth: number; total: number; minutes: number; people: number; topSpot: { name: string; count: number } | null; withMost: { name: string; count: number } | null }

/** Totals for the history tab. Only counts sessions that have already started. */
export function dropStats(log: DropLogEntry[], now: number): DropStats {
  const past = log.filter((e) => e.at <= now);
  const month = new Date(now);
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1).getTime();
  const spots = new Map<string, { name: string; count: number }>();
  const people = new Map<string, number>();
  for (const e of past) {
    const k = placeKey(e.spotName);
    const s = spots.get(k) ?? { name: e.spotName, count: 0 };
    s.count++;
    spots.set(k, s);
    for (const n of new Set(e.with)) people.set(n, (people.get(n) ?? 0) + 1);
  }
  const top = [...spots.values()].sort((a, b) => b.count - a.count)[0] ?? null;
  const buddy = [...people.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    thisMonth: past.filter((e) => e.at >= monthStart).length,
    total: past.length,
    minutes: past.reduce((n, e) => n + Math.max(0, Math.min(e.minutes, (now - e.at) / 60_000)), 0),
    people: people.size,
    topSpot: top,
    withMost: buddy ? { name: buddy[0], count: buddy[1] } : null,
  };
}

/** Who is at the table besides you, for the history log. */
export function companions(d: DropView, me: { host: boolean; joinerId?: string }) {
  const others = d.joiners.filter((j) => j.id !== me.joinerId).map((j) => j.name);
  return me.host ? others : [d.name, ...others];
}
