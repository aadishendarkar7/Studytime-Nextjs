'use client';
import { create } from 'zustand';
import { weekMinutes } from '@/features/focus/logic';
import { api, ApiError, type RoomView } from '@/lib/api';
import { useExtras } from '@/lib/stores/extras';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';

/** The latest view of the room this student is in. Not saved; rebuilt from the server. */
export const useRoom = create<{ view: RoomView | null; error: string }>()(() => ({ view: null, error: '' }));

let inflight = false;

/** Tells the room what this student is doing and pulls everyone else's status. */
export async function beat() {
  const room = useExtras.getState().room;
  if (!room || inflight) return;
  inflight = true;
  const p = useProfile.getState();
  const status = p.timer.mode === 'running' ? 'focusing' : p.timer.mode === 'paused' ? 'break' : 'idle';
  try {
    const view = await api.rooms.beat(room.code, room.memberId, {
      name: p.name,
      status,
      subject: p.subject,
      endsAt: p.timer.mode === 'running' ? p.timer.deadline : null,
      weekMinutes: weekMinutes(p.sessions),
      weeklyGoal: p.weeklyGoal,
      since: room.kudosSeen ?? 0,
    });
    if (view.kudos.length) {
      for (const k of view.kudos) toast(`${k.from} sent you kudos. Keep going.`);
      const current = useExtras.getState().room;
      if (current) useExtras.getState().update({ room: { ...current, kudosSeen: Math.max(...view.kudos.map((k) => k.at)) } });
    }
    useRoom.setState({ view, error: '' });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) {
      useExtras.getState().update({ room: null });
      useRoom.setState({ view: null, error: e.message });
    } else useRoom.setState({ error: (e as Error).message });
  } finally {
    inflight = false;
  }
}
