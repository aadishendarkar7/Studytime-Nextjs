'use client';
import { api } from '@/lib/api';
import { useExtras } from '@/lib/stores/extras';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import type { DropView } from '@/lib/types';
import { copyText, uid } from '@/lib/utils';
import { patchDrop, refreshDrops } from './live';

const fail = (e: unknown) => toast((e as Error).message, 'error');

/** Everything you can do to a drop. Each action updates the list and saved state. */
export const dropActions = {
  async join(d: DropView) {
    const p = useProfile.getState();
    try {
      const r = await api.drops.join(d.id, p.name);
      p.update({ points: p.points + 10 });
      const x = useExtras.getState();
      x.update({
        joinedDrops: [...x.joinedDrops, { dropId: d.id, joinerId: r.joinerId, token: r.token, endsAt: d.endsAt }],
        dropLog: [...x.dropLog.filter((e) => e.id !== d.id), { id: d.id, spotName: d.spotName, subject: d.subject, vibe: d.vibe, lat: d.lat, lng: d.lng, at: Math.max(Date.now(), d.startsAt), minutes: Math.round((d.endsAt - Math.max(Date.now(), d.startsAt)) / 60_000), role: 'joined' as const, with: [d.name, ...d.joiners.map((j) => j.name)] }].slice(-200),
      });
      await refreshDrops(false);
      toast(`${d.name} will see you are coming.`);
    } catch (e) {
      fail(e);
    }
  },
  async leave(d: DropView) {
    const x = useExtras.getState();
    const j = x.joinedDrops.find((j) => j.dropId === d.id);
    if (!j) return;
    try {
      await api.drops.leave(d.id, j.joinerId, j.token);
      x.update({ joinedDrops: x.joinedDrops.filter((y) => y.dropId !== d.id), dropLog: x.dropLog.filter((e) => e.id !== d.id) });
      await refreshDrops(false);
      toast('You are off the list.');
    } catch (e) {
      fail(e);
    }
  },
  async arrive(d: DropView, here = true) {
    const j = useExtras.getState().joinedDrops.find((j) => j.dropId === d.id);
    if (!j) return;
    try {
      patchDrop(await api.drops.status(d.id, j.joinerId, j.token, here ? 'here' : 'coming'));
      toast(here ? `${d.name} knows you are there.` : 'Marked as on your way.');
    } catch (e) {
      fail(e);
    }
  },
  async message(d: DropView, text: string) {
    const p = useProfile.getState();
    const mine = useExtras.getState().myDrops.find((m) => m.id === d.id);
    try {
      patchDrop(await api.drops.message(d.id, p.name, text, mine?.token ?? null));
      return true;
    } catch (e) {
      fail(e);
      return false;
    }
  },
  async extend(d: DropView, minutes = 60) {
    const x = useExtras.getState();
    const mine = x.myDrops.find((m) => m.id === d.id);
    if (!mine) return;
    try {
      const r = await api.drops.extend(d.id, mine.token, d.endsAt + minutes * 60_000);
      x.update({ myDrops: x.myDrops.map((m) => (m.id === d.id ? { ...m, endsAt: r.endsAt } : m)), dropLog: x.dropLog.map((e) => (e.id === d.id ? { ...e, minutes: e.minutes + minutes } : e)) });
      patchDrop(r);
      toast('Extended by an hour.');
    } catch (e) {
      fail(e);
    }
  },
  async end(d: DropView) {
    const x = useExtras.getState();
    const mine = x.myDrops.find((m) => m.id === d.id);
    if (!mine || !confirm('End this drop? People who joined will see it is over.')) return;
    try {
      await api.drops.end(d.id, mine.token);
      const done = Math.max(1, Math.round((Date.now() - Math.max(d.startsAt, Date.now() - 12 * 3_600_000)) / 60_000));
      x.update({ myDrops: x.myDrops.filter((m) => m.id !== d.id), dropLog: x.dropLog.map((e) => (e.id === d.id ? { ...e, minutes: Math.min(e.minutes, done) } : e)) });
      await refreshDrops(false);
      toast('Drop ended. Nice work.');
    } catch (e) {
      fail(e);
    }
  },
  /** Native share sheet on phones, otherwise copy the invite link. */
  async share(d: DropView) {
    const url = `${location.origin}/drop?d=${d.id}`;
    const text = `I'm studying at ${d.spotName}${d.subject ? ` (${d.subject})` : ''}. Come join:`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Drop a Spot', text, url });
        return;
      } catch {
        /* closed the share sheet */
      }
    }
    toast((await copyText(`${text} ${url}`)) ? 'Invite link copied.' : 'Could not copy the link.');
  },
  /** Put the drop on your Studytime calendar as a study block. */
  addToCalendar(d: DropView) {
    const x = useExtras.getState();
    if (x.studyBlocks.some((b) => b.href === `/drop?d=${d.id}`)) return toast('Already on your calendar.');
    x.update({ studyBlocks: [...x.studyBlocks, { id: uid(), title: `Study at ${d.spotName}`, subject: d.subject, start: d.startsAt, end: d.endsAt, source: 'manual', href: `/drop?d=${d.id}`, done: false }] });
    toast('Added to your calendar.');
  },
};
