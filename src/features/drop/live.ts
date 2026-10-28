'use client';
import { create } from 'zustand';
import { sendBrowserAlert } from '@/components/shell/global-effects';
import { api } from '@/lib/api';
import { useExtras } from '@/lib/stores/extras';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import type { DropView } from '@/lib/types';
import { companions } from './logic';

export const useDrops = create<{ drops: DropView[]; loaded: boolean; error: string }>()(() => ({ drops: [], loaded: false, error: '' }));

export const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/** "Now until 5:00 PM", "3:00 PM to 6:00 PM", or with the day when it is not today. */
export function whenLabel(d: { startsAt: number; endsAt: number }, now = Date.now()) {
  if (d.startsAt <= now) return `Now until ${fmtTime(d.endsAt)}`;
  const sameDay = new Date(d.startsAt).toDateString() === new Date(now).toDateString();
  return `${sameDay ? '' : `${new Date(d.startsAt).toLocaleDateString(undefined, { weekday: 'short' })} `}${fmtTime(d.startsAt)} to ${fmtTime(d.endsAt)}`;
}

let inflight = false;
const knownJoiners = new Map<string, number>();
const knownHere = new Map<string, number>();
const knownMessages = new Map<string, number>();

/**
 * Pulls the drops this student can see. New drops from other people and new
 * people joining your drop show up as notifications, unless drops are muted.
 */
export async function refreshDrops(notify = true) {
  if (inflight) return;
  inflight = true;
  const p = useProfile.getState();
  const x = useExtras.getState();
  try {
    const { drops } = await api.drops.list(p.school, p.circle ? { code: p.circle.code, memberId: p.circle.memberId } : null);
    const mine = new Set(x.myDrops.map((d) => d.id));
    const seen = new Set(x.dropsSeen);
    const fresh = drops.filter((d) => !mine.has(d.id) && !seen.has(d.id));
    if (notify && !x.dropQuiet && useDrops.getState().loaded) {
      for (const d of fresh.slice(0, 3)) {
        toast(`${d.name} dropped a spot: ${d.spotName}, ${whenLabel(d).toLowerCase()}.`);
        sendBrowserAlert(`${d.name} is studying at ${d.spotName}`, `${whenLabel(d)}${d.subject ? `, ${d.subject}` : ''}. Open Studytime to join.`);
      }
    }
    const joinedIds = new Map(x.joinedDrops.map((j) => [j.dropId, j.joinerId]));
    for (const d of drops.filter((d) => mine.has(d.id))) {
      const before = knownJoiners.get(d.id);
      if (notify && before !== undefined && d.joiners.length > before) {
        const who = d.joiners.slice(before).map((j) => j.name).join(', ');
        toast(`${who} ${d.joiners.length - before === 1 ? 'is' : 'are'} joining you at ${d.spotName}.`);
        sendBrowserAlert('Someone is joining you', `${who} at ${d.spotName}`);
      }
      knownJoiners.set(d.id, d.joiners.length);
      const here = d.joiners.filter((j) => j.status === 'here');
      const hereBefore = knownHere.get(d.id);
      if (notify && hereBefore !== undefined && here.length > hereBefore) toast(`${here[here.length - 1].name} is at ${d.spotName}.`);
      knownHere.set(d.id, here.length);
    }
    // New messages on drops you are part of.
    for (const d of drops.filter((d) => mine.has(d.id) || joinedIds.has(d.id))) {
      const before = knownMessages.get(d.id);
      const fresh = before === undefined ? [] : d.messages.slice(before).filter((m) => (mine.has(d.id) ? !m.host : m.name !== p.name));
      if (notify && !x.dropQuiet && fresh.length) {
        const m = fresh[fresh.length - 1];
        toast(`${m.name} at ${d.spotName}: ${m.text}`);
        sendBrowserAlert(`${m.name} at ${d.spotName}`, m.text);
      }
      knownMessages.set(d.id, d.messages.length);
    }
    // Keep your history up to date with who was there.
    const byId = new Map(drops.map((d) => [d.id, d]));
    const log = x.dropLog.map((e) => {
      const d = byId.get(e.id);
      if (!d || e.role === 'solo') return e;
      const people = companions(d, { host: e.role === 'host', joinerId: joinedIds.get(e.id) });
      return people.join('|') === e.with.join('|') ? e : { ...e, with: [...new Set([...e.with, ...people])] };
    });
    const now = Date.now();
    useExtras.getState().update({
      dropsSeen: [...new Set([...x.dropsSeen, ...fresh.map((d) => d.id)])].slice(-300),
      myDrops: x.myDrops.filter((d) => d.endsAt > now),
      joinedDrops: x.joinedDrops.filter((d) => d.endsAt > now),
      dropLog: log,
    });
    useDrops.setState({ drops, loaded: true, error: '' });
  } catch (e) {
    useDrops.setState({ loaded: true, error: (e as Error).message });
  } finally {
    inflight = false;
  }
}

/** Marks messages on a drop as read, so opening the thread does not re-notify. */
export const markMessagesSeen = (id: string, count: number) => knownMessages.set(id, count);

/** Replace one drop in the list after an action returns its new state. */
export function patchDrop(next: DropView) {
  useDrops.setState((s) => ({ drops: s.drops.some((d) => d.id === next.id) ? s.drops.map((d) => (d.id === next.id ? next : d)) : s.drops }));
}
