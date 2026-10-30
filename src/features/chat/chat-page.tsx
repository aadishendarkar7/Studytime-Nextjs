'use client';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icons';
import { Sheet } from '@/components/ui/sheet';
import { api } from '@/lib/api';
import { dmChannel } from '@/lib/chat-ids';
import { YEARS } from '@/lib/constants';
import { useExtras } from '@/lib/stores/extras';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import type { ChatMessage, ChatPerson } from '@/lib/types';
import { useNow } from '@/lib/use-now';
import { cn } from '@/lib/utils';
import { channelsFor, chatId, markRead, pulse, toneFor, useChat, type Channel } from './live';

type Open = { kind: 'channel'; id: string } | { kind: 'dm'; with: string; name: string };
const keyOf = (o: Open) => (o.kind === 'channel' ? o.id : `dm:${o.with}`);

const time = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
function dayLabel(ms: number, now: number) {
  const d = new Date(ms).toDateString();
  if (d === new Date(now).toDateString()) return 'Today';
  if (d === new Date(now - 86_400_000).toDateString()) return 'Yesterday';
  return new Date(ms).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}
const yearLabel = (y: string) => YEARS.find((x) => x.value === y)?.label ?? '';
const detail = (p: ChatPerson) => p.statusText || [p.major, yearLabel(p.year)].filter(Boolean).join(' · ') || p.school || 'Online';

/** Turns plain URLs into links. Everything else stays text. */
function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g);
  return <>{parts.map((part, i) => (i % 2 ? <a key={i} href={part} target="_blank" rel="noopener noreferrer nofollow" className="text-accent-ink underline underline-offset-2">{part}</a> : <Fragment key={i}>{part}</Fragment>))}</>;
}

/* ---------- sidebar: channels and direct messages ---------- */

function NavRow({ active, unread, onClick, children }: { active: boolean; unread?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-current={active ? 'true' : undefined} className={cn('flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[14px] transition-colors', active ? 'bg-surface-3 font-medium text-ink' : unread ? 'font-semibold text-ink hover:bg-surface-3' : 'text-ink-2 hover:bg-surface-3 hover:text-ink')}>
      {children}
    </button>
  );
}

function Rooms({ channels, open, go, onNew }: { channels: Channel[]; open: Open; go: (o: Open) => void; onNew: () => void }) {
  const { threads, last, online } = useChat();
  const read = useExtras((s) => s.chatRead);
  const blocked = useExtras((s) => s.chatBlocked);
  const onlineIds = new Set(online.map((u) => u.id));
  const current = keyOf(open);
  return (
    <nav aria-label="Conversations" className="grid content-start gap-5 p-3">
      <div>
        <p className="mb-1 px-2 text-[12px] font-medium text-muted">Channels</p>
        {channels.map((c) => {
          const unread = (last[c.id]?.at ?? 0) > (read[c.id] ?? Infinity);
          return (
            <NavRow key={c.id} active={current === c.id} unread={unread} onClick={() => go({ kind: 'channel', id: c.id })}>
              <span className="w-4 text-center text-muted">#</span>
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              {unread && <span className="size-2 rounded-full bg-accent" aria-label="New messages" />}
            </NavRow>
          );
        })}
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between px-2">
          <p className="text-[12px] font-medium text-muted">Direct messages</p>
          <button type="button" onClick={onNew} aria-label="New message" title="New message" className="grid size-6 place-items-center rounded text-muted hover:bg-surface-3 hover:text-ink"><Icon name="plus" className="size-3.5" /></button>
        </div>
        {threads.filter((t) => !blocked.includes(t.with)).map((t) => {
          const unread = !t.fromMe && t.last > (read[`dm:${t.with}`] ?? 0);
          return (
            <NavRow key={t.with} active={current === `dm:${t.with}`} unread={unread} onClick={() => go({ kind: 'dm', with: t.with, name: t.name })}>
              <Avatar name={t.name} color={toneFor(t.with)} size={20} online={onlineIds.has(t.with)} />
              <span className="min-w-0 flex-1 truncate">{t.name}</span>
              {unread && <span className="size-2 rounded-full bg-accent" aria-label="Unread" />}
            </NavRow>
          );
        })}
        {!threads.length && <p className="px-2 text-[13px] leading-5 text-muted">Pick someone from the online list to message them.</p>}
      </div>
    </nav>
  );
}

/* ---------- right column: who is online ---------- */

function PeopleGroup({ title, people, me, onPick }: { title: string; people: ChatPerson[]; me?: string; onPick: (p: ChatPerson) => void }) {
  if (!people.length) return null;
  return (
    <div>
      <p className="mb-1 px-2 text-[12px] font-medium text-muted">{title} · {people.length}</p>
      {people.map((u) => (
        <button key={u.id} type="button" onClick={() => onPick(u)} className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-surface-3">
          <Avatar name={u.name} color={toneFor(u.id)} size={28} online />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-ink">{u.name}{u.id === me ? ' (you)' : ''}</span>
            <span className={cn('block truncate text-[12px]', u.status === 'focusing' ? 'text-accent-ink' : u.status === 'drop' ? 'text-ok' : 'text-muted')}>{detail(u)}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function OnlineList({ onPick, compact }: { onPick: (p: ChatPerson) => void; compact?: boolean }) {
  const { online, ready } = useChat();
  const p = useProfile();
  const me = useExtras((s) => s.chat?.id);
  const blocked = useExtras((s) => s.chatBlocked);
  const [q, setQ] = useState('');
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase() && a.trim() !== '';
  const list = online.filter((u) => !blocked.includes(u.id) && (!q || `${u.name} ${u.major} ${u.school} ${u.courses.join(' ')}`.toLowerCase().includes(q.toLowerCase())));
  const mine = new Set(p.courses.map((c) => c.toLowerCase().replace(/\s+/g, '')));
  const classmates = list.filter((u) => u.id !== me && same(u.school, p.school) && u.courses.some((c) => mine.has(c.toLowerCase().replace(/\s+/g, ''))));
  const school = list.filter((u) => u.id !== me && same(u.school, p.school) && !classmates.includes(u));
  const rest = list.filter((u) => u.id !== me && !classmates.includes(u) && !school.includes(u));
  const self = list.find((u) => u.id === me);
  return (
    <div className={cn('grid content-start gap-4', compact ? '' : 'p-3')}>
      <div className="flex items-center justify-between px-2">
        <p className="text-[13px] font-semibold text-ink">Online now</p>
        <span className="tnum flex items-center gap-1.5 text-[12px] text-muted"><span className="size-1.5 rounded-full bg-ok" />{online.length}</span>
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, major, course" aria-label="Search people online" className="h-8 rounded-md border border-line bg-surface px-2.5 text-[13px] outline-none focus:border-accent" />
      <PeopleGroup title="In your courses" people={classmates} me={me} onPick={onPick} />
      <PeopleGroup title={p.school ? `At ${p.school}` : 'Your school'} people={school} me={me} onPick={onPick} />
      <PeopleGroup title={p.school ? 'Other schools' : 'Everyone'} people={rest} me={me} onPick={onPick} />
      {self && <PeopleGroup title="You" people={[self]} me={me} onPick={onPick} />}
      {ready && list.length <= (self ? 1 : 0) && <p className="px-2 text-[13px] leading-5 text-muted">{q ? 'No one online matches that.' : 'No one else is online right now. Messages still arrive when they come back.'}</p>}
    </div>
  );
}

function PersonDialog({ person, onClose, onMessage }: { person: ChatPerson | null; onClose: () => void; onMessage: (p: ChatPerson) => void }) {
  const x = useExtras();
  if (!person) return null;
  const me = x.chat?.id === person.id;
  const blocked = x.chatBlocked.includes(person.id);
  return (
    <Dialog open onClose={onClose} title={person.name}>
      <div className="flex items-center gap-3">
        <Avatar name={person.name} color={toneFor(person.id)} size={48} online />
        <div className="min-w-0">
          <p className="truncate text-[14px] text-ink">{[person.major, yearLabel(person.year)].filter(Boolean).join(' · ') || 'Student'}</p>
          <p className="truncate text-[13px] text-muted">{person.school || 'School not set'}</p>
        </div>
      </div>
      {person.statusText && <p className="mt-4 rounded-lg bg-surface-3 px-3 py-2 text-[13px] text-ink-2">{person.statusText}</p>}
      {person.style && <p className="mt-3 text-[13px] text-muted">Study style: <strong className="font-semibold text-ink">{person.style}</strong></p>}
      {person.prompts && person.prompts.length > 0 && (
        <div className="mt-3 grid gap-2">
          {person.prompts.map((pr) => (
            <div key={pr.q} className="rounded-lg border border-line px-3 py-2.5">
              <p className="text-[12px] font-medium text-muted">{pr.q}</p>
              <p className="mt-0.5 text-[15px] leading-6 font-semibold">{pr.a}</p>
            </div>
          ))}
        </div>
      )}
      {person.courses.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-[12px] font-medium text-muted">Courses</p>
          <div className="flex flex-wrap gap-1.5">{person.courses.map((c) => <span key={c} className="rounded-md border border-line px-2 py-0.5 text-[12px] text-ink-2">{c}</span>)}</div>
        </div>
      )}
      {!me && (
        <div className="mt-5 flex gap-2">
          <Button onClick={() => (onMessage(person), onClose())} disabled={blocked}><Icon name="send" className="size-4" /> Message</Button>
          <Button variant="ghost" onClick={() => (x.update({ chatBlocked: blocked ? x.chatBlocked.filter((b) => b !== person.id) : [...x.chatBlocked, person.id] }), toast(blocked ? `${person.name} is unblocked.` : `${person.name} is blocked. You will not see their messages.`))}>{blocked ? 'Unblock' : 'Block'}</Button>
        </div>
      )}
    </Dialog>
  );
}

/* ---------- the conversation ---------- */

function MessageList({ messages, me, onPerson, onDelete, onReport }: { messages: ChatMessage[]; me: string; onPerson: (id: string, name: string) => void; onDelete: (m: ChatMessage) => void; onReport: (m: ChatMessage) => void }) {
  const now = useNow(60_000);
  return (
    <ol className="grid">
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const newDay = !prev || new Date(prev.at).toDateString() !== new Date(m.at).toDateString();
        const grouped = !newDay && prev && prev.from === m.from && m.at - prev.at < 5 * 60_000;
        return (
          <Fragment key={m.id}>
            {newDay && (
              <li className="my-3 flex items-center gap-3 text-[12px] font-medium text-muted" aria-label={dayLabel(m.at, now)}>
                <span className="h-px flex-1 bg-line" />{dayLabel(m.at, now)}<span className="h-px flex-1 bg-line" />
              </li>
            )}
            <li className={cn('group relative flex gap-3 rounded-md px-2 hover:bg-surface-2', grouped ? 'py-0.5' : 'mt-2 py-1')}>
              {grouped ? (
                <span className="tnum w-8 shrink-0 pt-0.5 text-right text-[11px] text-transparent group-hover:text-muted">{time(m.at).replace(/\s?[AP]M$/i, '')}</span>
              ) : (
                <button type="button" onClick={() => onPerson(m.from, m.name)} className="mt-0.5 shrink-0" aria-label={`About ${m.name}`}><Avatar name={m.name} color={toneFor(m.from)} size={32} /></button>
              )}
              <div className="min-w-0 flex-1">
                {!grouped && (
                  <p className="flex items-baseline gap-2">
                    <button type="button" onClick={() => onPerson(m.from, m.name)} className="text-[14px] font-semibold text-ink hover:underline">{m.from === me ? 'You' : m.name}</button>
                    <span className="tnum text-[12px] text-muted">{time(m.at)}</span>
                  </p>
                )}
                <p className="text-[14px] leading-[22px] break-words whitespace-pre-wrap text-ink"><Linkified text={m.text} /></p>
              </div>
              <span className="absolute top-1 right-2 hidden gap-0.5 rounded-md border border-line bg-surface p-0.5 shadow-sm group-hover:flex group-focus-within:flex">
                {m.from === me ? (
                  <button type="button" onClick={() => onDelete(m)} className="rounded px-1.5 py-0.5 text-[12px] text-muted hover:bg-surface-3 hover:text-danger">Delete</button>
                ) : (
                  <button type="button" onClick={() => onReport(m)} className="rounded px-1.5 py-0.5 text-[12px] text-muted hover:bg-surface-3 hover:text-ink">Report</button>
                )}
              </span>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}

function Composer({ placeholder, onSend }: { placeholder: string; onSend: (text: string) => Promise<boolean> }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const send = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    if (await onSend(t)) {
      setText('');
      if (ref.current) ref.current.style.height = 'auto';
    }
    setBusy(false);
    ref.current?.focus();
  };
  return (
    <form onSubmit={(e) => (e.preventDefault(), void send())} className="flex items-end gap-2 panel p-1.5 pl-3 focus-within:border-line-strong">
      <textarea
        ref={ref}
        rows={1}
        value={text}
        maxLength={1000}
        onChange={(e) => {
          setText(e.target.value);
          e.target.style.height = 'auto';
          e.target.style.height = `${Math.min(160, e.target.scrollHeight)}px`;
        }}
        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && (e.preventDefault(), void send())}
        placeholder={placeholder}
        aria-label="Message"
        className="max-h-40 min-h-8 flex-1 resize-none bg-transparent py-1.5 text-[14px] leading-[22px] outline-none placeholder:text-muted"
      />
      <Button type="submit" size="sm" loading={busy} disabled={!text.trim()} aria-label="Send"><Icon name="send" className="size-4" /></Button>
    </form>
  );
}

function Conversation({ open, channel, onPerson }: { open: Open; channel?: Channel; onPerson: (id: string, name: string) => void }) {
  const me = useExtras((s) => s.chat);
  const blocked = useExtras((s) => s.chatBlocked);
  const online = useChat((s) => s.online);
  const [list, setList] = useState<{ key: string; messages: ChatMessage[] }>({ key: '', messages: [] });
  const [error, setError] = useState('');
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const key = keyOf(open);
  const channelId = open.kind === 'channel' ? open.id : me ? dmChannel(me.id, open.with) : '';
  const messages = list.key === key ? list.messages : [];

  const load = useCallback(async () => {
    if (!me || !channelId) return;
    try {
      const r = await api.chat.messages(me.token, channelId);
      setList({ key, messages: r.messages });
      setError('');
      const newest = r.messages[r.messages.length - 1];
      if (newest) markRead(key, newest.at);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [me, channelId, key]);

  useEffect(() => {
    stick.current = true;
    useChat.setState({ open: key });
    const first = setTimeout(() => void load(), 0);
    const id = setInterval(() => void load(), 3_000);
    return () => (clearTimeout(first), clearInterval(id), useChat.setState({ open: null }));
  }, [load, key]);

  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages.length, key]);

  const send = async (text: string) => {
    if (!me) return false;
    try {
      const m = await api.chat.post(me.token, channelId, text);
      stick.current = true;
      setList((l) => ({ key, messages: [...(l.key === key ? l.messages : []), m] }));
      markRead(key, m.at);
      if (open.kind === 'dm') void pulse(false);
      return true;
    } catch (e) {
      toast((e as Error).message, 'error');
      return false;
    }
  };
  const remove = async (m: ChatMessage) => {
    if (!me || !confirm('Delete this message for everyone?')) return;
    try {
      await api.chat.remove(me.token, channelId, m.id);
      setList((l) => ({ ...l, messages: l.messages.filter((x) => x.id !== m.id) }));
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const report = async (m: ChatMessage) => {
    if (!me) return;
    const reason = prompt(`Report this message from ${m.name}? Add a short reason (optional).`);
    if (reason === null) return;
    try {
      await api.chat.report(me.token, channelId, m.id, reason.slice(0, 200));
      toast('Reported. Thanks for keeping chat friendly.');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const visible = messages.filter((m) => !blocked.includes(m.from));
  const other = open.kind === 'dm' ? online.find((u) => u.id === open.with) : undefined;
  const title = open.kind === 'channel' ? `# ${channel?.name ?? ''}` : open.name;
  const sub = open.kind === 'channel' ? channel?.about : other ? detail(other) : 'Offline';
  return (
    <section className="flex min-h-0 min-w-0 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4">
        {open.kind === 'dm' && <Avatar name={open.name} color={toneFor(open.with)} size={28} online={Boolean(other)} />}
        <div className="min-w-0">
          <h2 className="truncate font-sans text-[15px] leading-5 font-semibold">{title}</h2>
          <p className="truncate text-[12px] text-muted">{sub}</p>
        </div>
        {open.kind === 'dm' && <Button size="sm" variant="ghost" className="ml-auto" onClick={() => onPerson(open.with, open.name)}>Profile</Button>}
      </header>
      <div ref={scroller} onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }} className="min-h-0 flex-1 overflow-y-auto px-2 py-3" aria-live="polite">
        {error ? <p className="m-4 rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">{error}</p> : visible.length ? (
          <MessageList messages={visible} me={me?.id ?? ''} onPerson={onPerson} onDelete={remove} onReport={report} />
        ) : list.key === key ? (
          <div className="grid h-full place-items-center px-6 text-center">
            <div className="max-w-sm">
              <p className="text-[15px] font-semibold text-ink">{open.kind === 'dm' ? `Start a conversation with ${open.name}` : `This is the start of #${channel?.name}`}</p>
              <p className="mt-1 text-[13px] leading-5 text-muted">{open.kind === 'dm' ? 'Only the two of you can see these messages.' : channel?.kind === 'course' ? 'Ask who is studying for the next exam, or share where you are working tonight.' : 'Say hi, ask a question, or find people to study with.'}</p>
            </div>
          </div>
        ) : null}
      </div>
      <div className="shrink-0 px-3 pb-3">
        <Composer key={key} placeholder={open.kind === 'channel' ? `Message #${channel?.name ?? ''}` : `Message ${open.name}`} onSend={send} />
        <p className="mt-1.5 px-1 text-[11px] text-muted">{open.kind === 'channel' ? 'Everyone in this channel can read this. Be kind, and never share an address.' : 'Enter to send, Shift + Enter for a new line.'}</p>
      </div>
    </section>
  );
}

/* ---------- page ---------- */

/** Chat with students: channels, direct messages and who is online. Lives in Drop a Spot, under Friends. */
export function ChatPage({ toolbar }: { toolbar?: React.ReactNode } = {}) {
  const p = useProfile();
  const x = useExtras();
  const { ready, error, online } = useChat();
  const channels = useMemo(() => channelsFor(p), [p]);
  const [open, setOpen] = useState<Open>(() => ({ kind: 'channel', id: (typeof location !== 'undefined' && new URLSearchParams(location.search).get('channel')) || 'general' }));
  const [person, setPerson] = useState<ChatPerson | null>(null);
  const [drawer, setDrawer] = useState<'rooms' | 'people' | null>(null);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    void chatId().then(() => pulse(false));
    const id = setInterval(() => void pulse(), 15_000);
    return () => clearInterval(id);
  }, []);

  const go = (o: Open) => (setOpen(o), setDrawer(null));
  const message = (u: ChatPerson) => (go({ kind: 'dm', with: u.id, name: u.name }), setPicking(false));
  const showPerson = async (id: string, name: string) => {
    const found = useChat.getState().online.find((u) => u.id === id);
    if (found) return setPerson(found);
    try {
      const r = await api.chat.person((await chatId()).token, id);
      setPerson(r.person);
    } catch {
      setPerson({ id, name, school: '', major: '', year: '', courses: [], status: 'online', statusText: '', lastSeen: 0 });
    }
  };
  const channel = open.kind === 'channel' ? channels.find((c) => c.id === open.id) ?? channels[0] : undefined;
  const safeOpen: Open = open.kind === 'channel' && !channels.some((c) => c.id === open.id) ? { kind: 'channel', id: 'general' } : open;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        {toolbar ?? <span />}
        <label className="flex items-center gap-2 text-[13px] text-ink-2">
          <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={x.chatVisible} onChange={(e) => (x.update({ chatVisible: e.target.checked }), setTimeout(() => void pulse(false), 0))} />
          Show me as online
        </label>
      </div>

      {!p.school && <p className="mb-3 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink-2">Add your school and courses on <a className="font-medium text-accent-ink underline" href="/you?tab=profile">your profile</a> to join their channels.</p>}
      {error && <p className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">{error}</p>}

      {/* Phone: switchers above the conversation */}
      <div className="mb-2 flex gap-2 lg:hidden">
        <Button size="sm" variant="secondary" className="min-w-0 flex-1 justify-start" onClick={() => setDrawer('rooms')}>
          <Icon name="menu" className="size-4" /><span className="truncate">{safeOpen.kind === 'channel' ? `# ${channel?.name}` : safeOpen.name}</span>
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setDrawer('people')}><span className="size-1.5 rounded-full bg-ok" /> {online.length} online</Button>
      </div>

      <div className="grid h-[calc(100dvh-300px)] min-h-[520px] overflow-hidden panel max-lg:h-[calc(100dvh-330px)] lg:grid-cols-[232px_minmax(0,1fr)] xl:grid-cols-[232px_minmax(0,1fr)_260px]">
        <aside className="hidden min-h-0 overflow-y-auto border-r border-line bg-surface-2 lg:block">
          <Rooms channels={channels} open={safeOpen} go={go} onNew={() => setPicking(true)} />
        </aside>
        {ready ? <Conversation open={safeOpen} channel={channel} onPerson={showPerson} /> : <div className="grid place-items-center text-[13px] text-muted">Connecting</div>}
        <aside className="hidden min-h-0 overflow-y-auto border-l border-line xl:block">
          <OnlineList onPick={setPerson} />
        </aside>
      </div>

      <Sheet open={drawer === 'rooms'} onClose={() => setDrawer(null)} title="Conversations">
        <Rooms channels={channels} open={safeOpen} go={go} onNew={() => (setDrawer(null), setPicking(true))} />
      </Sheet>
      <Sheet open={drawer === 'people' || picking} onClose={() => (setDrawer(null), setPicking(false))} title={picking ? 'New message' : 'Online now'}>
        <OnlineList compact onPick={(u) => (picking ? message(u) : (setDrawer(null), setPerson(u)))} />
      </Sheet>
      <PersonDialog person={person} onClose={() => setPerson(null)} onMessage={message} />
    </>
  );
}
