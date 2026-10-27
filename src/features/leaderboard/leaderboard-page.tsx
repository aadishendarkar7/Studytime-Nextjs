'use client';
import { useState } from 'react';
import { Badge, Card, CardHeader, Empty, PageHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, FieldRow, Input, Note, Select } from '@/components/ui/field';
import { Segmented } from '@/components/ui/segmented';
import { MAJORS } from '@/lib/constants';
import { CircleBoard } from '@/features/social/friends-page';
import { syncCircle, syncLeaderboardProfile } from '@/features/social/sync';
import { usePolling } from '@/features/social/use-polling';
import { api } from '@/lib/api';
import { useLearning } from '@/lib/stores/learning';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import type { CircleMemberView, LeaderboardResult, LeaderScope } from '@/lib/types';

export function LeaderboardPage() {
  const p = useProfile();
  const classSession = useLearning((s) => s.classSession);
  const [school, setSchool] = useState(p.school);
  const [major, setMajor] = useState(p.major);
  const [year, setYear] = useState(p.year);
  const [scope, setScope] = useState<LeaderScope>('school');
  const [result, setResult] = useState<LeaderboardResult | null>(null);
  const [status, setStatus] = useState('Loading rankings…');
  const [circle, setCircle] = useState<CircleMemberView[] | null>(null);

  const refresh = async () => {
    try {
      const lb = await syncLeaderboardProfile();
      if (scope === 'class') {
        if (!classSession) {
          setResult(null);
          return setStatus('Join a class in Friends & classmates to see class rankings.');
        }
        setResult(await api.leaderboard.classScope(classSession.code, classSession.token));
      } else setResult(await api.leaderboard.scope(lb.token, scope));
      setStatus('');
    } catch (e) {
      setStatus((e as Error).message);
    }
  };
  usePolling(refresh, 10_000, true, scope);
  usePolling(() => syncCircle().then(setCircle).catch(() => setCircle(null)), 10_000, Boolean(p.circle));

  return (
    <>
      <PageHeader title="Leaderboards" description="Compare weekly focus time with students at your school, in your major, and in your year." />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Card>
          <CardHeader title="Choose your groups" />
          <Field label="School or campus" htmlFor="leaderboardSchool"><Input id="leaderboardSchool" maxLength={80} value={school} onChange={(e) => setSchool(e.target.value)} placeholder="Your school name" /></Field>
          <FieldRow>
            <Field label="Major" htmlFor="leaderboardMajor">
              <Select id="leaderboardMajor" value={major} onChange={(e) => setMajor(e.target.value)}><option value="">Choose major</option>{MAJORS.map((m) => <option key={m}>{m}</option>)}</Select>
            </Field>
            <Field label="Year" htmlFor="leaderboardYear">
              <Select id="leaderboardYear" value={year} onChange={(e) => setYear(e.target.value)}>
                <option value="">Choose year</option>
                {['First year', 'Second year', 'Third year', 'Fourth year', 'Graduate / other'].map((y, i) => <option key={y} value={String(i + 1)}>{y}</option>)}
              </Select>
            </Field>
          </FieldRow>
          <Button className="mt-5" onClick={() => (p.update({ school: school.trim(), major, year }), toast('School, major, and year saved.'), refresh())}>Save my groups</Button>
          <Note>Boards rank this week’s focus minutes among students using this Studytime site. Your name and minutes are visible to others in your groups.</Note>
        </Card>
        <Card>
          <CardHeader title={result ? `${result.label || 'Your'} ${scope === 'year' ? 'year' : scope} leaderboard` : 'Leaderboard'} action={<Segmented value={scope} onChange={(s) => (setScope(s), setResult(null), setStatus('Loading rankings…'))} options={[{ value: 'school', label: 'School' }, { value: 'major', label: 'Major' }, { value: 'class', label: 'Class' }, { value: 'year', label: 'Year' }]} />} />
          {(status || result?.message) && <Note className="mt-0 mb-3">{status || result?.message}</Note>}
          {result && !result.message && (result.entries.length ? (
            <ol id="leaderboardScopeList">
              {result.entries.map((s, i) => (
                <li key={s.id} className="flex items-center justify-between gap-3 border-b border-line py-3 text-sm last:border-0">
                  <strong className="flex items-center gap-2"><span className={i < 3 ? 'grid size-7 place-items-center  bg-accent-soft text-accent-ink' : 'w-7 text-center text-muted'}>{i + 1}</span>{s.name}{s.id === p.leaderboard?.id && <Badge tone="accent">you</Badge>}</strong>
                  <span className="text-muted">{s.minutes} min{scope === 'class' ? ` · ${s.quizScore ?? 0} quiz pts` : ''}</span>
                </li>
              ))}
            </ol>
          ) : <Empty>No classmates on this board yet. Share the site with them.</Empty>)}
        </Card>
      </div>
      <Card className="mt-5">
        <CardHeader title="Friends progress" />
        <CircleBoard members={p.circle ? circle : null} meId={p.circle?.publicId} />
      </Card>
    </>
  );
}
