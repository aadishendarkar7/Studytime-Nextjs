'use client';
import { useEffect, useState } from 'react';
import { Badge, Card, CardHeader, Empty, PageHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Note } from '@/components/ui/field';
import { Icon } from '@/components/ui/icons';
import { Bar } from '@/components/ui/progress';
import { Segmented } from '@/components/ui/segmented';
import { api } from '@/lib/api';
import { useExtras } from '@/lib/stores/extras';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import { cn, copyText, fmtClock, fmtMinutes } from '@/lib/utils';
import { beat, useRoom } from './presence';

const STATUS = { focusing: 'Focusing', break: 'On a break', idle: 'Here' } as const;

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

function JoinOrCreate() {
  const p = useProfile();
  const update = useExtras((s) => s.update);
  const [roomName, setRoomName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async (fn: () => Promise<{ code: string; memberId: string }>) => {
    setBusy(true);
    try {
      const r = await fn();
      update({ room: { ...r, kudosSeen: Date.now() } });
      await beat();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader title="Start a room" description="Make a room for your study group, your roommate or one accountability partner, and share the code." />
        <Field label="Room name" htmlFor="roomName" className="mt-0"><Input id="roomName" maxLength={40} placeholder="STAT400 study group" value={roomName} onChange={(e) => setRoomName(e.target.value)} /></Field>
        <Button className="mt-4" loading={busy} onClick={() => go(() => api.rooms.create(roomName, p.name))}>Create room</Button>
      </Card>
      <Card>
        <CardHeader title="Join a room" description="Ask a friend for their six-character room code." />
        <form onSubmit={(e) => { e.preventDefault(); const c = code.trim().toUpperCase(); go(async () => ({ code: c, ...(await api.rooms.join(c, p.name)) })); }}>
          <Field label="Room code" htmlFor="roomCode" className="mt-0"><Input id="roomCode" maxLength={6} className="tnum font-mono uppercase" placeholder="A1B2C3" value={code} onChange={(e) => setCode(e.target.value)} /></Field>
          <Button type="submit" className="mt-4" loading={busy}>Join</Button>
        </form>
      </Card>
    </div>
  );
}

function Room() {
  const p = useProfile();
  const { room, update } = useExtras();
  const { view, error } = useRoom();
  const now = useNow();
  const [length, setLength] = useState<'15' | '30' | '60' | '90'>('30');

  // Faster updates while this page is open; the app checks in every 20 seconds elsewhere.
  useEffect(() => {
    const id = setInterval(() => void beat(), 8000);
    return () => clearInterval(id);
  }, []);

  if (!room) return null;
  const online = view?.members.filter((m) => m.online) ?? [];
  const away = view?.members.filter((m) => !m.online) ?? [];
  const group = view?.group;
  const groupLive = group && now >= group.startsAt && now < group.endsAt;

  const joinGroup = () => {
    if (!group) return;
    const mins = Math.round((group.endsAt - Date.now()) / 60_000);
    const d = ([90, 60, 30, 15, 5] as const).find((x) => x <= Math.max(5, mins)) ?? 5;
    if (p.timer.mode !== 'ready') return toast('Your timer is already going.');
    p.setDuration(d);
    p.startOrPause();
    toast(`Joined the group session: ${d} minutes.`);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-12 [&>*]:min-w-0">
      <Card className="lg:col-span-8">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[24px] leading-8">{view?.name ?? 'Study room'}</h2>
            <p className="text-[14px] text-muted">{online.length} here now{away.length ? `, ${away.length} away` : ''}</p>
          </div>
          <button type="button" onClick={() => copyText(room.code).then(() => toast('Room code copied.'))} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 hover:bg-surface-3">
            <span className="text-[13px] text-muted">Code</span>
            <span className="tnum font-mono text-[18px] font-semibold tracking-widest">{room.code}</span>
            <Icon name="copy" className="size-4 text-muted" />
          </button>
        </div>
        {error && <p className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-[14px] text-danger">{error}</p>}
        {view ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {[...online, ...away].map((m) => {
              const me = m.id === view.me;
              const left = m.status === 'focusing' && m.endsAt ? Math.max(0, Math.round((m.endsAt - now) / 1000)) : null;
              return (
                <li key={m.id} className={cn('rounded-xl border p-3', m.online ? 'border-line bg-surface' : 'border-dashed border-line bg-surface-2 opacity-70')}>
                  <div className="flex items-center gap-3">
                    <span className={cn('relative grid size-10 shrink-0 place-items-center rounded-full font-semibold', m.status === 'focusing' && m.online ? 'bg-accent-fill text-white' : 'bg-surface-3 text-ink-2')}>
                      {m.name[0]?.toUpperCase()}
                      {m.online && <span className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-surface bg-ok" aria-hidden="true" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold">{m.name}{me && <span className="font-normal text-muted"> (you)</span>}</p>
                      <p className="truncate text-[13px] text-muted">
                        {!m.online ? `Away, seen ${new Date(m.lastSeen).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : `${STATUS[m.status]}${m.subject && m.status === 'focusing' ? `: ${m.subject}` : ''}${left !== null ? `, ${fmtClock(left)} left` : ''}`}
                      </p>
                    </div>
                    {!me && m.online && (
                      <Button size="sm" variant="ghost" aria-label={`Send ${m.name} kudos`} onClick={() => api.rooms.kudos(room.code, room.memberId, m.id).then(() => toast(`Kudos sent to ${m.name}.`), (e) => toast((e as Error).message, 'error'))}>
                        <Icon name="heart" className="size-4" /> Kudos
                      </Button>
                    )}
                  </div>
                  {m.weeklyGoal > 0 && (
                    <div className="mt-3">
                      <div className="mb-1 flex justify-between text-[12px] text-muted"><span>This week</span><span className="tnum">{fmtMinutes(m.weekMinutes)} of {fmtMinutes(m.weeklyGoal)}</span></div>
                      <Bar value={(m.weekMinutes / m.weeklyGoal) * 100} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : <Empty>Connecting to the room...</Empty>}
      </Card>

      <div className="grid content-start gap-5 lg:col-span-4">
        <Card>
          <CardHeader title="Study together" description="Start a group session and everyone in the room gets a 30 second countdown to join with their own timer." />
          {group && now < group.endsAt ? (
            <div className="rounded-xl bg-accent-soft p-4">
              <p className="text-[14px] text-accent-ink">{group.by} started {group.minutes} minutes</p>
              <p className="tnum font-display text-[36px] leading-10 text-accent-ink">{groupLive ? fmtClock(Math.round((group.endsAt - now) / 1000)) : `Starts in ${Math.max(0, Math.round((group.startsAt - now) / 1000))}s`}</p>
              <Button className="mt-3" onClick={joinGroup} disabled={p.timer.mode !== 'ready'}>{p.timer.mode === 'ready' ? 'Join with my timer' : 'Your timer is running'}</Button>
            </div>
          ) : (
            <>
              <Segmented label="Group session length" value={length} onChange={setLength} options={[{ value: '15', label: '15 min' }, { value: '30', label: '30 min' }, { value: '60', label: '60 min' }, { value: '90', label: '90 min' }]} />
              <Button className="mt-4" onClick={() => api.rooms.group(room.code, room.memberId, Number(length) as 15 | 30 | 60 | 90).then((v) => (useRoom.setState({ view: v }), toast('Group session starting in 30 seconds.')), (e) => toast((e as Error).message, 'error'))}>Start a group session</Button>
            </>
          )}
        </Card>
        <Card>
          <CardHeader title="How it works" />
          <ul className="grid list-disc gap-1.5 pl-5 text-[14px] leading-[22px] text-ink-2">
            <li>Studying next to others, even online, makes it easier to stay on task.</li>
            <li>The room shows your name, what you are studying while the timer runs, and your weekly minutes. No camera, no chat.</li>
            <li>Make a room with just one friend to use it as an accountability pair.</li>
          </ul>
          <Button variant="ghost" className="mt-4 text-danger" onClick={async () => {
            if (!confirm('Leave this room?')) return;
            await api.rooms.leave(room.code, room.memberId).catch(() => undefined);
            update({ room: null });
            useRoom.setState({ view: null });
          }}>Leave room</Button>
          <Note>Rooms close after a week with no visitors.</Note>
        </Card>
      </div>
    </div>
  );
}

export function RoomsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const room = useExtras((s) => s.room);
  return (
    <>
      {!embedded && <PageHeader title="Study rooms" description="Study alongside friends. See who is focusing right now, start a session together, and cheer each other on." action={room ? <Badge tone="ok">In a room</Badge> : undefined} />}
      {room ? <Room /> : <JoinOrCreate />}
    </>
  );
}
