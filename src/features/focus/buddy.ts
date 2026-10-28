'use client';
import { useEffect } from 'react';
import { create } from 'zustand';
import { sendBrowserAlert } from '@/components/shell/global-effects';
import { api, ApiError } from '@/lib/api';
import { useExtras } from '@/lib/stores/extras';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import type { BuddyView } from '@/lib/types';

export const BUDDY_BONUS = 25;

export const useBuddy = create<{ me: BuddyView | null; buddy: BuddyView | null; sameCourse: boolean; error: string }>()(() => ({ me: null, buddy: null, sameCourse: false, error: '' }));

let polling = false;
let knownBuddy: string | null = null;

async function join() {
  const p = useProfile.getState();
  const endsAt = p.timer.deadline ?? Date.now() + p.timer.remaining * 1000;
  try {
    const r = await api.buddy.join({ name: p.name, course: p.subject || p.courses[0] || '', task: p.subject, school: p.school, endsAt });
    useExtras.getState().update({ buddy: { id: r.id, token: r.token, endsAt, done: false, awarded: false } });
    knownBuddy = null;
    void pollBuddy();
  } catch (e) {
    useBuddy.setState({ error: (e as Error).message });
  }
}

export async function pollBuddy() {
  const b = useExtras.getState().buddy;
  if (!b || polling) return;
  polling = true;
  try {
    const r = await api.buddy.poll(b.id, b.token);
    useBuddy.setState({ ...r, error: '' });
    if (r.buddy && knownBuddy !== r.buddy.id) {
      knownBuddy = r.buddy.id;
      toast(`Matched with ${r.buddy.name}${r.buddy.task ? `, working on ${r.buddy.task}` : ''}.`);
    }
    // Both finished: each side gives itself the bonus once.
    if (b.done && !b.awarded && r.buddy?.status === 'done') {
      const p = useProfile.getState();
      p.update({ points: p.points + BUDDY_BONUS });
      useExtras.getState().update({ buddy: { ...b, awarded: true } });
      toast(`You and ${r.buddy.name} both finished. +${BUDDY_BONUS} bonus points.`);
      sendBrowserAlert('Focus Buddy', `You and ${r.buddy.name} both finished. +${BUDDY_BONUS} points.`);
    }
    // Stop following once the pair is settled or your buddy's time is well past.
    const settled = b.done && (!r.buddy || r.buddy.status !== 'focusing' || Date.now() > r.buddy.endsAt + 20 * 60_000);
    if (settled && (b.awarded || !r.buddy || r.buddy.status === 'left' || Date.now() > (r.buddy?.endsAt ?? 0) + 20 * 60_000)) end(false);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) end(false);
    else useBuddy.setState({ error: (e as Error).message });
  } finally {
    polling = false;
  }
}

function end(leave: boolean) {
  const b = useExtras.getState().buddy;
  if (b && leave && !b.done) void api.buddy.status(b.id, b.token, 'left').catch(() => {});
  useExtras.getState().update({ buddy: null });
  useBuddy.setState({ me: null, buddy: null, sameCourse: false });
  knownBuddy = null;
}

export const leaveBuddy = () => end(true);

/** Runs app-wide: joins when a session starts with "match me" on, reports finishing, and keeps polling. */
export function useBuddyEffects() {
  useEffect(() => {
    const off = useProfile.subscribe((s, prev) => {
      const x = useExtras.getState();
      if (prev.timer.mode !== 'running' && s.timer.mode === 'running' && x.buddyOptIn && !x.buddy) void join();
      if (prev.timer.mode !== 'ready' && s.timer.mode === 'ready' && x.buddy && !x.buddy.done) {
        const finished = s.sessions.length > prev.sessions.length;
        if (finished) {
          useExtras.getState().update({ buddy: { ...x.buddy, done: true } });
          void api.buddy.status(x.buddy.id, x.buddy.token, 'done').then(() => pollBuddy()).catch(() => {});
        } else end(true);
      }
    });
    const id = setInterval(() => void pollBuddy(), 8_000);
    void pollBuddy();
    return () => (off(), clearInterval(id));
  }, []);
}

/** Opt in during a running session too. */
export function optInNow() {
  const x = useExtras.getState();
  x.update({ buddyOptIn: true });
  if (useProfile.getState().timer.mode === 'running' && !x.buddy) void join();
}
