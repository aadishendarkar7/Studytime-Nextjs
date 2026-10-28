import 'server-only';
import { getStorage } from '../storage';
import { HttpError } from '../http';
import { publicId, secret } from '../ids';
import type { ChatChannelInfo, ChatMessage, ChatPerson, ChatStatus, ChatThread } from '@/lib/types';

/*
 * Chat for every student: an all-school lounge, a room per school and per
 * course, and one-to-one messages. People are known by a random token kept in
 * their browser; others only ever see its public id.
 *
 * Keys
 *   chat:people          public id -> ChatPerson (+ visible flag)
 *   chat:tokens          public id -> 1 (registered)
 *   chat:m:<channel>     message id -> ChatMessage
 *   chat:last            channel -> ChatChannelInfo (newest message, for unread dots)
 *   chat:inbox:<id>      other id -> ChatThread (direct messages)
 *   chat:reports         report id -> report
 */

const ONLINE_MS = 75_000;
const KEEP = 300;
const PEOPLE = 'chat:people';

interface Stored extends ChatPerson { visible: boolean }

/** general, s-<school>, c-<school>--<course>, dm-<id>-<id> (ids sorted). */
export const CHANNEL = /^(general|s-[a-z0-9-]{1,48}|c-[a-z0-9-]{1,48}--[a-z0-9-]{1,32}|dm-[a-f0-9]{16}-[a-f0-9]{16})$/;
export { dmChannel, slug } from '@/lib/chat-ids';

export async function register() {
  const token = secret(24);
  const id = publicId(token);
  await getStorage().hset('chat:tokens', id, 1);
  return { token, id };
}

async function me(token: string | null) {
  if (!token || !/^[a-f0-9]{48}$/.test(token)) throw new HttpError(401, 'Open Chat once to set up your chat profile.');
  const id = publicId(token);
  if (!(await getStorage().hget('chat:tokens', id))) throw new HttpError(401, 'Your chat profile was not found. Reload to create a new one.');
  return id;
}

export interface PresenceInput { name: string; school: string; major: string; year: string; courses: string[]; status: ChatStatus; statusText: string; visible: boolean; prompts: { q: string; a: string }[]; style: string }

/** Called every half minute while the app is open. */
export async function heartbeat(token: string | null, input: PresenceInput) {
  const id = await me(token);
  const person: Stored = { id, ...input, lastSeen: Date.now() };
  await getStorage().hset(PEOPLE, id, person);
  return { id };
}

const pub = ({ visible, ...p }: Stored): ChatPerson => (void visible, p);

/** Everyone seen in the last 75 seconds who chose to show as online. */
export async function online(token: string | null) {
  await me(token);
  const now = Date.now();
  const all = Object.values(await getStorage().hgetall<Stored>(PEOPLE));
  const users = all.filter((p) => p.visible && now - p.lastSeen < ONLINE_MS).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 300).map(pub);
  return { users, total: users.length };
}

export async function person(token: string | null, id: string) {
  await me(token);
  const p = await getStorage().hget<Stored>(PEOPLE, id);
  if (!p) throw new HttpError(404, 'That student was not found.');
  return { person: pub(p), online: p.visible && Date.now() - p.lastSeen < ONLINE_MS };
}

function canRead(channel: string, id: string) {
  if (!CHANNEL.test(channel)) throw new HttpError(404, 'Channel not found.');
  if (channel.startsWith('dm-') && !channel.slice(3).split('-').includes(id)) throw new HttpError(403, 'This conversation is private.');
}

export async function messages(token: string | null, channel: string, after = 0) {
  const id = await me(token);
  canRead(channel, id);
  const list = Object.values(await getStorage().hgetall<ChatMessage>(`chat:m:${channel}`))
    .filter((m) => m.at > after)
    .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  return { messages: list.slice(-150) };
}

export async function post(token: string | null, channel: string, text: string) {
  const id = await me(token);
  canRead(channel, id);
  const s = getStorage();
  const sender = await s.hget<Stored>(PEOPLE, id);
  const name = sender?.name || 'Student';
  const msg: ChatMessage = { id: secret(6), channel, from: id, name, text, at: Date.now() };
  const key = `chat:m:${channel}`;
  await s.hset(key, msg.id, msg);
  if ((await s.hlen(key)) > KEEP + 50) {
    const all = Object.values(await s.hgetall<ChatMessage>(key)).sort((a, b) => a.at - b.at);
    await Promise.all(all.slice(0, all.length - KEEP).map((m) => s.hdel(key, m.id)));
  }
  const info: ChatChannelInfo = { at: msg.at, name, preview: text.slice(0, 90) };
  await s.hset('chat:last', channel, info);
  if (channel.startsWith('dm-')) {
    const other = channel.slice(3).split('-').find((x) => x !== id) ?? id;
    const otherPerson = await s.hget<Stored>(PEOPLE, other);
    await s.hset<ChatThread>(`chat:inbox:${id}`, other, { with: other, name: otherPerson?.name || 'Student', last: msg.at, preview: info.preview, fromMe: true });
    if (other !== id) await s.hset<ChatThread>(`chat:inbox:${other}`, id, { with: id, name, last: msg.at, preview: info.preview, fromMe: false });
  }
  return msg;
}

export async function removeMessage(token: string | null, channel: string, messageId: string) {
  const id = await me(token);
  canRead(channel, id);
  const key = `chat:m:${channel}`;
  const m = await getStorage().hget<ChatMessage>(key, messageId);
  if (!m) return { ok: true };
  if (m.from !== id) throw new HttpError(403, 'You can only delete your own messages.');
  await getStorage().hdel(key, messageId);
  return { ok: true };
}

/** Direct message threads, newest first, plus the newest message time of the channels asked about. */
export async function inbox(token: string | null, channels: string[]) {
  const id = await me(token);
  const s = getStorage();
  const threads = Object.values(await s.hgetall<ChatThread>(`chat:inbox:${id}`)).sort((a, b) => b.last - a.last).slice(0, 50);
  const last: Record<string, ChatChannelInfo> = {};
  const wanted = channels.filter((c) => CHANNEL.test(c) && !c.startsWith('dm-')).slice(0, 30);
  await Promise.all(wanted.map(async (c) => {
    const info = await s.hget<ChatChannelInfo>('chat:last', c);
    if (info) last[c] = info;
  }));
  return { threads, last };
}

export async function report(token: string | null, channel: string, messageId: string, reason: string) {
  const id = await me(token);
  canRead(channel, id);
  const m = await getStorage().hget<ChatMessage>(`chat:m:${channel}`, messageId);
  if (!m) throw new HttpError(404, 'That message is gone.');
  await getStorage().hset('chat:reports', secret(6), { by: id, channel, message: m, reason, at: Date.now() });
  return { ok: true };
}
