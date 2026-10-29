'use client';
import { create } from 'zustand';
import { api, type AccountView } from '@/lib/api';
import { AI_KEY, useAi } from '@/lib/stores/ai';
import { EXTRAS_KEY, useExtras } from '@/lib/stores/extras';
import { exportBackup, hydrateStores, importBackup } from '@/lib/stores/hydrate';
import { LEARNING_KEY, useLearning } from '@/lib/stores/learning';
import { PROFILE_KEY, useProfile } from '@/lib/stores/profile';

/** Which account the study data in this browser belongs to. */
const OWNER_KEY = 'studytime:owner';
const MAX = 850_000;

export const useAccount = create<{ user: AccountView | null; savedAt: number; saving: boolean }>()(() => ({ user: null, savedAt: 0, saving: false }));

const owner = () => { try { return localStorage.getItem(OWNER_KEY); } catch { return null; } };
const setOwner = (id: string) => { try { localStorage.setItem(OWNER_KEY, id); } catch { /* storage blocked */ } };

/** Everything to save online, made smaller if needed: old chats and cached calendar events go first. */
export function cloudSnapshot() {
  const data = JSON.parse(exportBackup());
  // The running timer changes every second and is not worth saving.
  if (data.profile) delete data.profile.timer;
  // Check-ins and parked thoughts stay on this device only.
  if (data.extras) {
    delete data.extras.checkins;
    delete data.extras.parked;
  }
  delete data.exportedAt;
  let text = JSON.stringify(data);
  if (text.length <= MAX) return text;
  if (data.extras?.calendarFeeds) data.extras.calendarFeeds = data.extras.calendarFeeds.map((f: { events: unknown[] }) => ({ ...f, events: [] }));
  text = JSON.stringify(data);
  if (text.length > MAX && data.ai) data.ai.chats = (data.ai.chats || []).slice(0, 5);
  text = JSON.stringify(data);
  if (text.length > MAX && data.ai) data.ai.notes = (data.ai.notes || []).slice(0, 20);
  return JSON.stringify(data);
}

let last = '';
let lastAt = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

export async function saveNow(force = true) {
  if (!useAccount.getState().user) return;
  if (!force && Date.now() - lastAt < 120_000) return;
  lastAt = Date.now();
  const text = cloudSnapshot();
  if (text === last) return;
  useAccount.setState({ saving: true });
  try {
    const r = await api.auth.putData(text);
    last = text;
    useAccount.setState({ savedAt: r.at });
  } catch {
    /* try again on the next change */
  } finally {
    useAccount.setState({ saving: false });
  }
}

function watch() {
  // At most one save every two minutes while you work, plus one when you leave the page.
  const schedule = () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      void saveNow(false);
    }, Math.max(15_000, 120_000 - (Date.now() - lastAt)));
  };
  const subs = [useProfile.subscribe(schedule), useLearning.subscribe(schedule), useAi.subscribe(schedule), useExtras.subscribe(schedule)];
  const onHide = () => document.visibilityState === 'hidden' && void saveNow();
  document.addEventListener('visibilitychange', onHide);
  // Keep the account profile in step with the profile in the app.
  let prev = '';
  const subProfile = useProfile.subscribe((p) => {
    const key = JSON.stringify([p.name, p.school, p.major, p.year, p.courses]);
    if (key === prev) return;
    prev = key;
    void api.auth.profile({ name: p.name.trim().slice(0, 40) || undefined, school: p.school.slice(0, 80), major: p.major.slice(0, 60), year: p.year.slice(0, 10), courses: p.courses.slice(0, 12).map((c) => c.slice(0, 30)) }).catch(() => undefined);
  });
  return () => (subs.forEach((u) => u()), subProfile(), document.removeEventListener('visibilitychange', onHide));
}

let started: Promise<'ok' | 'guest'> | null = null;
let stop: (() => void) | null = null;

/**
 * Before the app shows: check the session, load this account's data on a new
 * device, keep someone else's data from leaking into it, then keep saving.
 */
export function startAccount(): Promise<'ok' | 'guest'> {
  started ??= (async () => {
    let me: Awaited<ReturnType<typeof api.auth.me>>;
    try {
      me = await api.auth.me();
    } catch {
      // Offline: open with what is in this browser.
      await hydrateStores();
      return 'ok';
    }
    if (!me.user) {
      // A visitor without an account: everything runs from this browser.
      await hydrateStores();
      return 'guest';
    }
    const user = me.user;
    const prevOwner = owner();
    if (prevOwner && prevOwner !== user.id) {
      // Another person used this browser: start clean for this account.
      for (const k of [PROFILE_KEY, LEARNING_KEY, AI_KEY, EXTRAS_KEY]) try { localStorage.removeItem(k); } catch { /* blocked */ }
    }
    await hydrateStores();
    if (prevOwner !== user.id) {
      const remote = await api.auth.getData().catch(() => ({ data: null, at: 0 }));
      if (remote.data) await importBackup(remote.data).catch(() => undefined);
      setOwner(user.id);
    }
    const p = useProfile.getState();
    if (user.onboarded && (p.name === 'Student' || !p.name)) p.update({ name: user.name, school: user.profile.school, major: user.profile.major, year: user.profile.year, courses: user.profile.courses });
    useAccount.setState({ user });
    stop?.();
    stop = watch();
    last = '';
    setTimeout(() => void saveNow(), 3000);
    return 'ok';
  })();
  return started;
}

/** Remove this account's data from this browser (after deleting the account). */
export function clearLocalData() {
  for (const k of [PROFILE_KEY, LEARNING_KEY, AI_KEY, EXTRAS_KEY, OWNER_KEY]) try { localStorage.removeItem(k); } catch { /* blocked */ }
  stop?.();
}

export async function signOut() {
  await saveNow().catch(() => undefined);
  await api.auth.signout().catch(() => undefined);
  stop?.();
  location.href = '/';
}
