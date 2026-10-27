'use client';
import { useEffect, useState } from 'react';
import { Badge, Card, CardHeader, Empty, PageHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Note, Select } from '@/components/ui/field';
import { api } from '@/lib/api';
import { useLearning } from '@/lib/stores/learning';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import type { CircleMemberView, ClassView } from '@/lib/types';
import { cn, copyText } from '@/lib/utils';
import { syncCircle } from './sync';
import { usePolling } from './use-polling';

export function CircleBoard({ members, meId }: { members: CircleMemberView[] | null; meId?: string }) {
  if (!members) return <Empty>Create or join a circle to compare progress.</Empty>;
  if (!members.length) return <Empty>No friends in this circle yet.</Empty>;
  return (
    <ol>
      {members.map((m, i) => (
        <li key={m.id} className="flex items-center justify-between gap-3 border-b border-line py-3 text-sm last:border-0">
          <strong>{i + 1}. {m.name}{m.id === meId && <Badge tone="accent" className="ml-2">you</Badge>}</strong>
          <span className="text-muted">{m.minutes} min · {m.streak} day streak</span>
        </li>
      ))}
    </ol>
  );
}

function StudyCircle() {
  const { circle, name, update } = useProfile();
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get('circle')?.toUpperCase() ?? '');
  const [members, setMembers] = useState<CircleMemberView[] | null>(null);
  const [status, setStatus] = useState('');
  usePolling(() => syncCircle().then((m) => (setMembers(m), setStatus(''))).catch((e: Error) => setStatus(`Could not sync circle: ${e.message}`)), 10_000, Boolean(circle));
  const create = async () => {
    try {
      const c = await api.circles.create(name);
      update({ circle: { code: c.code, memberId: c.memberId, publicId: c.publicId } });
      setMembers(await syncCircle());
      toast(`Circle ${c.code} is live. Copy the invite and send it to a friend.`);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const join = async () => {
    const c = code.trim().toUpperCase();
    if (!/^[A-F0-9]{8}$/.test(c)) return toast('Enter the 8-character invite code.', 'error');
    try {
      const r = await api.circles.join(c, name);
      update({ circle: { code: c, memberId: r.memberId, publicId: r.publicId } });
      setMembers(await syncCircle());
      toast(`Joined circle ${c}.`);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  return (
    <Card>
      <CardHeader title="Study with friends" description={circle ? `You’re in circle ${circle.code}. Progress refreshes every 10 seconds.` : 'Create a circle and share the invite link, or join with a friend’s code.'} />
      <div className="flex flex-wrap gap-2">
        <Button onClick={create}>Create circle</Button>
        <Button variant="secondary" disabled={!circle} onClick={async () => toast((await copyText(`Join my Studytime study circle! ${location.origin}/friends?circle=${circle!.code} (code ${circle!.code})`)) ? 'Invite link copied.' : 'Could not copy.')}>Copy invite link</Button>
        {circle && <Button variant="ghost" onClick={() => (update({ circle: null }), setMembers(null))}>Leave circle</Button>}
      </div>
      <Field label="Join with a code" htmlFor="circleCode">
        <form className="flex gap-2" onSubmit={(e) => (e.preventDefault(), join())}>
          <Input id="circleCode" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} placeholder="8-character invite code" />
          <Button type="submit" variant="secondary">Join</Button>
        </form>
      </Field>
      {status && <Note className="text-danger">{status}</Note>}
      <div className="mt-5"><CircleBoard members={circle ? members : null} meId={circle?.publicId} /></div>
    </Card>
  );
}

function ClassStudy() {
  const l = useLearning();
  const profileName = useProfile((s) => s.name);
  const [studentName, setStudentName] = useState(l.classStudentName || profileName);
  const [className, setClassName] = useState('');
  const [setId, setSetId] = useState(l.selectedId);
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get('class')?.toUpperCase() ?? '');
  const [view, setView] = useState<ClassView | null>(null);
  const [error, setError] = useState('');
  const session = l.classSession;
  usePolling(() => session && api.classes.view(session.code, session.token).then((v) => (setView(v), setError(''))).catch((e: Error) => setError(e.message)), 3000, Boolean(session));
  useEffect(() => {
    if (new URLSearchParams(location.search).get('class')) document.getElementById('class')?.scrollIntoView({ behavior: 'smooth' });
  }, []);
  const name = () => {
    const n = studentName.trim().slice(0, 30) || 'Student';
    l.update({ classStudentName: n });
    return n;
  };
  const host = async () => {
    const set = l.sets.find((s) => s.id === setId);
    if (!set || new Set(set.cards.map((c) => c.back)).size < 2) return toast('Choose a set with at least two different answers.', 'error');
    try {
      const r = await api.classes.create({ name: className.trim() || `${set.name} review`, student: name(), setName: set.name, cards: set.cards.map(({ front, back }) => ({ front, back })) });
      l.update({ classSession: { code: r.code, token: r.token } });
      setView(await api.classes.view(r.code, r.token));
      toast(`Class created. Share code ${r.code}.`);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const join = async () => {
    const c = code.trim().toUpperCase();
    if (!/^[A-F0-9]{6}$/.test(c)) return toast('Enter the six-character class code.', 'error');
    try {
      const r = await api.classes.join(c, name());
      l.update({ classSession: { code: c, token: r.token } });
      setView(await api.classes.view(c, r.token));
      toast(`Joined class ${c}.`);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const act = async (fn: () => Promise<ClassView>) => {
    try {
      setView(await fn());
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const round = view?.round;
  return (
    <section id="class" className="scroll-mt-6">
      <PageHeader level={2} title="Class Study" description="Host a live quiz from one of your study sets, or join with a class code." />
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Join or host" description={view ? `In ${view.name} (${view.code}). ${view.isHost ? 'You are hosting.' : 'Waiting for the host to run questions.'}` : 'Classmates open this site and enter your code.'} />
          <Field label="Your name in class" htmlFor="classStudentName"><Input id="classStudentName" maxLength={30} value={studentName} onChange={(e) => setStudentName(e.target.value)} /></Field>
          <div className="mt-5 border border-line p-4 rounded-xl">
            <strong className="text-sm">Host a class</strong>
            <Field label="Class name" htmlFor="className"><Input id="className" maxLength={60} value={className} onChange={(e) => setClassName(e.target.value)} placeholder="e.g. Biology 101 review" /></Field>
            <Field label="Study set to share" htmlFor="classSetSelect"><Select id="classSetSelect" value={setId} onChange={(e) => setSetId(e.target.value)}>{l.sets.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.cards.length})</option>)}</Select></Field>
            <Button className="mt-4" onClick={host}>Host class</Button>
          </div>
          <Field label="Join with a code" htmlFor="classCodeInput" className="mt-5">
            <form className="flex gap-2" onSubmit={(e) => (e.preventDefault(), join())}>
              <Input id="classCodeInput" maxLength={6} autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-character code" />
              <Button type="submit" variant="secondary">Join class</Button>
            </form>
          </Field>
          {session && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={async () => toast((await copyText(`Join my Studytime class! ${location.origin}/friends?class=${session.code} (code ${session.code})`)) ? 'Class invite copied.' : 'Could not copy.')}>Copy class invite</Button>
              <Button variant="secondary" disabled={!view} onClick={() => view && (l.addSet(`${view.setName} (${view.code})`, view.cards, 'Class sets'), toast('Class set saved to your study games.'))}>Save class set</Button>
              <Button variant="ghost" onClick={() => (l.update({ classSession: null }), setView(null))}>Leave class</Button>
            </div>
          )}
          {error && <Note className="text-danger">{error}</Note>}
        </Card>
        <Card>
          <CardHeader title={view ? `${view.name} · ${view.code}` : 'Waiting for a class'} description={view ? `${view.members.length} classmate${view.members.length === 1 ? '' : 's'} joined · ${view.setName}` : undefined} />
          <div className="min-h-48 border border-line bg-surface-2 p-5 rounded-lg" id="classStage">
            {!view ? <p className="text-sm text-muted">Host a class or enter a code to begin.</p> : view.finished ? (
              <div className="py-6 text-center"><h3 className="text-xl font-semibold">Class quiz complete!</h3><p className="mt-1 text-sm text-muted">Great work together. Keep practicing this set in Study games.</p></div>
            ) : !round ? <p className="text-sm text-muted">The host can start the quiz when everyone has joined.</p> : (
              <>
                <p className="text-[12px] font-semibold text-muted">Question {round.index + 1} of {round.total} · {round.answers} answered</p>
                <h3 className="mt-2 mb-4 text-lg font-semibold">{round.question}</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {round.options.map((o) => (
                    <button key={o} type="button" disabled={round.status !== 'question' || Boolean(round.yourAnswer)} onClick={() => session && act(() => api.classes.answer(session.code, session.token, o))} className={cn('min-h-12 border bg-surface p-3 text-left text-sm font-semibold rounded-xl', round.status === 'reveal' && o === round.correct ? 'border-ok bg-ok-soft' : round.yourAnswer === o ? 'border-accent bg-accent-soft' : 'border-line-strong enabled:hover:bg-accent-soft')}>{o}</button>
                  ))}
                </div>
                <p className="mt-3 text-sm">{round.status === 'reveal' ? <strong className="text-ok">Answer: {round.correct}</strong> : round.yourAnswer ? <span className="text-muted">Answer saved. Waiting for the host to reveal it.</span> : null}</p>
              </>
            )}
          </div>
          {view?.isHost && !view.finished && session && (
            <Button className="mt-4" onClick={() => act(() => api.classes.advance(session.code, session.token))}>
              {!round ? 'Start quiz' : round.status === 'question' ? 'Reveal answer' : round.index + 1 >= round.total ? 'Finish quiz' : 'Next question'}
            </Button>
          )}
          <div className="mt-6 text-[12px] font-semibold text-muted">CLASS SCORES</div>
          {view ? [...view.members].sort((a, b) => b.score - a.score).map((m, i) => (
            <div key={`${m.name}-${i}`} className="flex justify-between border-b border-line py-2.5 text-sm last:border-0"><strong>{i + 1}. {m.name}{m.isHost ? ' · host' : ''}</strong><span className="text-muted">{m.score} pts</span></div>
          )) : <p className="mt-2 text-sm text-muted">Scores appear when a class starts.</p>}
        </Card>
      </div>
    </section>
  );
}

export function FriendsPage() {
  return (
    <>
      <PageHeader title="Friends & classmates" description="Invite friends with a link, then host a live class review with a join code." />
      <StudyCircle />
      <ClassStudy />
    </>
  );
}
