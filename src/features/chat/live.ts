'use client';
import { create } from 'zustand';
import { sendBrowserAlert } from '@/components/shell/global-effects';
import { useDrops } from '@/features/drop/live';
import { STYLES } from '@/features/profile/style';
import { api, ApiError } from '@/lib/api';
import { courseChannel, schoolChannel } from '@/lib/chat-ids';
import { useExtras } from '@/lib/stores/extras';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import type { ChatChannelInfo, ChatPerson, ChatStatus, ChatThread } from '@/lib/types';

export interface Channel { id: string; name: string; about: string; kind: 'all' | 'school' | 'course' }

/** The rooms you belong to: everyone, your school, and one per course. */
export function channelsFor(p: { school: string; courses: string[] }): Channel[] {
  const out: Channel[] = [{ id: 'general', name: 'everyone', about: 'Every student on Studytime', kind: 'all' }];
  if (p.school.trim()) out.push({ id: schoolChannel(p.school), name: p.school.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 30), about: `Students at ${p.school.trim()}`, kind: 'school' });
  const seen = new Set<string>();
  for (const c of p.courses) {
    const id = courseChannel(p.school, c);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name: c.trim().toLowerCase().replace(/\s+/g, ''), about: `${c.trim()}${p.school ? ` at ${p.school.trim()}` : ''}`, kind: 'course' });
  }
  return out;
}

export const useChat = create<{
  online: ChatPerson[];
  threads: ChatThread[];
  last: Record<string, ChatChannelInfo>;
  ready: boolean;
  error: string;
  /** The conversation open on screen, so its messages do not also pop up as notifications. */
  open: string | null;
}>()(() => ({ online: [], threads: [], last: {}, ready: false, error: '', open: null }));

let registering: Promise<{ token: string; id: string }> | null = null;

/** Your chat identity, created on first use. */
export async function chatId() {
  const x = useExtras.getState();
  if (x.chat) return x.chat;
  registering ??= api.chat.register().then((r) => (useExtras.getState().update({ chat: r }), r));
  try {
    return await registering;
  } finally {
    registering = null;
  }
}

/** What others see next to your name: focusing, at a drop, or just online. */
export function myStatus(): { status: ChatStatus; statusText: string } {
  const p = useProfile.getState();
  const x = useExtras.getState();
  const now = Date.now();
  const mine = new Set([...x.myDrops.map((d) => d.id), ...x.joinedDrops.map((d) => d.dropId)]);
  const drop = useDrops.getState().drops.find((d) => mine.has(d.id) && d.startsAt <= now && d.endsAt > now);
  if (p.timer.mode === 'running') return { status: 'focusing', statusText: `Focusing${p.subject ? ` on ${p.subject}` : ''}${drop ? ` at ${drop.spotName}` : ''}` };
  if (drop) return { status: 'drop', statusText: `Studying at ${drop.spotName}` };
  return { status: 'online', statusText: '' };
}

let pulsing = false;

/** Says you are here, and pulls who is online and your message threads. */
export async function pulse(notify = true) {
  if (pulsing) return;
  pulsing = true;
  try {
    let me = await chatId();
    const p = useProfile.getState();
    const body = { name: p.name, school: p.school, major: p.major, year: p.year, courses: p.courses.slice(0, 12), ...myStatus(), visible: useExtras.getState().chatVisible, prompts: p.prompts.filter((x) => x.a.trim()).slice(0, 3), style: p.studyStyle ? STYLES[p.studyStyle]?.name ?? '' : '' };
    try {
      await api.chat.presence(me.token, body);
    } catch (e) {
      // The server forgot this identity (for example a fresh database): make a new one.
      if (!(e instanceof ApiError) || e.status !== 401) throw e;
      useExtras.getState().update({ chat: null });
      me = await chatId();
      await api.chat.presence(me.token, body);
    }
    const channels = channelsFor(p).map((c) => c.id);
    const [{ users }, { threads, last }] = await Promise.all([api.chat.online(me.token), api.chat.inbox(me.token, channels)]);
    const x = useExtras.getState();
    // First time a channel is seen, start reading from now so old history is not "unread".
    const read = { ...x.chatRead };
    let changed = false;
    for (const [ch, info] of Object.entries(last)) {
      if (read[ch] !== undefined) continue;
      read[ch] = info.at;
      changed = true;
    }
    for (const t of threads) {
      const key = `dm:${t.with}`;
      if (read[key] !== undefined) continue;
      read[key] = x.chatNotified ? 0 : t.last;
      changed = true;
    }
    const open = useChat.getState().open;
    const fresh = threads.filter((t) => !t.fromMe && t.last > x.chatNotified && t.last > (read[`dm:${t.with}`] ?? 0) && !x.chatBlocked.includes(t.with) && open !== `dm:${t.with}`);
    if (notify && fresh.length && x.chatNotified) {
      const t = fresh[0];
      toast(`${t.name}: ${t.preview}`);
      sendBrowserAlert(`Message from ${t.name}`, t.preview);
    }
    const newest = Math.max(x.chatNotified, ...threads.map((t) => t.last));
    if (changed || newest !== x.chatNotified) useExtras.getState().update({ chatRead: read, chatNotified: newest || Date.now() });
    useChat.setState({ online: users, threads, last, ready: true, error: '' });
  } catch (e) {
    useChat.setState({ ready: true, error: (e as Error).message });
  } finally {
    pulsing = false;
  }
}

export const markRead = (key: string, at: number) => {
  const x = useExtras.getState();
  if ((x.chatRead[key] ?? 0) < at) x.update({ chatRead: { ...x.chatRead, [key]: at } });
};

/** Direct-message threads with messages you have not opened. */
export function useUnreadDms() {
  const threads = useChat((s) => s.threads);
  const read = useExtras((s) => s.chatRead);
  const blocked = useExtras((s) => s.chatBlocked);
  return threads.filter((t) => !t.fromMe && !blocked.includes(t.with) && t.last > (read[`dm:${t.with}`] ?? 0)).length;
}

/** Muted, readable avatar colors, picked from the person id so they stay the same. */
const TONES = ['#4b5563', '#2f5bd3', '#0f766e', '#a16207', '#9d174d', '#4d7c0f', '#c2410c', '#be123c'];
export const toneFor = (id: string) => TONES[[...id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7) % TONES.length];
