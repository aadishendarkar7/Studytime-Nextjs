'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, FieldRow, Input, Select } from '@/components/ui/field';
import { Segmented, Tabs } from '@/components/ui/segmented';
import { toneFor } from '@/features/chat/live';
import { AWARD, DAILY_GOAL_BONUS, STREAK_BONUS, weekMinutes } from '@/features/focus/logic';
import { syncCircle, syncLeaderboardProfile, weekDrops } from '@/features/social/sync';
import { usePolling } from '@/features/social/use-polling';
import { api } from '@/lib/api';
import { MAJORS, YEARS } from '@/lib/constants';
import { useAi } from '@/lib/stores/ai';
import { useExtras } from '@/lib/stores/extras';
import { useLearning } from '@/lib/stores/learning';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import type { LeaderboardEntry } from '@/lib/types';
import { useNow } from '@/lib/use-now';
import { cn, fmtMinutes } from '@/lib/utils';
import { level, longestRun, trophies, type Trophy } from './achievements';
import { TrophyCabinet } from './trophy-cabinet';
import { ChallengesPanel, useChallengeStates } from '@/features/challenges/challenges-panel';
import { Collection, GardenPage, PacksPanel } from '@/features/garden/garden-page';

type Scope = 'school' | 'major' | 'year' | 'friends' | 'class';
type Metric = 'minutes' | 'drops';
type Row = LeaderboardEntry & { drops: number; me: boolean };

/** Days and hours until Monday 00:00 UTC, when the weekly boards reset. */
function resetsIn(now: number) {
  const d = new Date(now);
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7));
  const h = Math.max(0, Math.round((next - now) / 3_600_000));
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h`;
}

function GroupsDialog({ onClose }: { onClose: () => void }) {
  const p = useProfile();
  const [f, setF] = useState({ school: p.school, major: p.major, year: p.year });
  return (
    <Dialog open onClose={onClose} title="Your groups">
      <p className="-mt-2 mb-4 text-[13px] text-muted">Boards compare you with students who share your school, major or year. Your name and weekly totals are visible to them.</p>
      <Field label="School" htmlFor="rkSchool"><Input id="rkSchool" maxLength={80} value={f.school} onChange={(e) => setF({ ...f, school: e.target.value })} placeholder="University of Maryland" /></Field>
      <FieldRow>
        <Field label="Major" htmlFor="rkMajor"><Select id="rkMajor" value={f.major} onChange={(e) => setF({ ...f, major: e.target.value })}><option value="">Choose</option>{MAJORS.map((m) => <option key={m}>{m}</option>)}</Select></Field>
        <Field label="Year" htmlFor="rkYear"><Select id="rkYear" value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })}><option value="">Choose</option>{YEARS.map((y) => <option key={y.value} value={y.value}>{y.label}</option>)}</Select></Field>
      </FieldRow>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => (p.update({ school: f.school.trim(), major: f.major, year: f.year }), toast('Groups saved.'), onClose())}>Save</Button>
      </div>
    </Dialog>
  );
}

function Leaderboard() {
  const p = useProfile();
  const classSession = useLearning((s) => s.classSession);
  const now = useNow(60_000);
  const [scope, setScope] = useState<Scope>(p.school ? 'school' : 'friends');
  const [metric, setMetric] = useState<Metric>('minutes');
  const [rows, setRows] = useState<{ scope: Scope; list: Row[]; label: string; message: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const myMinutes = weekMinutes(p.sessions);
  const myDrops = weekDrops(now);

  const refresh = async () => {
    try {
      if (scope === 'friends') {
        if (!p.circle) return setRows({ scope, list: [], label: 'Friends', message: 'friends' });
        const members = (await syncCircle()) ?? [];
        return setRows({ scope, label: 'Friends', message: '', list: members.map((m) => ({ id: m.id, name: m.name, minutes: m.minutes, drops: m.id === p.circle?.publicId ? myDrops : 0, me: m.id === p.circle?.publicId })) });
      }
      const lb = await syncLeaderboardProfile();
      if (scope === 'class') {
        if (!classSession) return setRows({ scope, list: [], label: 'Class', message: 'class' });
        const r = await api.leaderboard.classScope(classSession.code, classSession.token);
        return setRows({ scope, label: r.label, message: r.message ?? '', list: r.entries.map((e) => ({ ...e, drops: e.drops ?? 0, me: e.id === lb.id })) });
      }
      const r = await api.leaderboard.scope(lb.token, scope);
      setRows({ scope, label: r.label, message: r.message ?? '', list: r.entries.map((e) => ({ ...e, drops: e.drops ?? 0, me: e.id === lb.id })) });
    } catch (e) {
      setRows({ scope, list: [], label: '', message: (e as Error).message });
    }
  };
  usePolling(refresh, 15_000, true, `${scope}|${p.school}|${p.major}|${p.year}`);

  const current = rows?.scope === scope ? rows : null;
  const sorted = useMemo(() => [...(current?.list ?? [])].sort((a, b) => b[metric] - a[metric] || a.name.localeCompare(b.name)), [current, metric]);
  const top = Math.max(1, sorted[0]?.[metric] ?? 1);
  const myIndex = sorted.findIndex((r) => r.me);
  const ahead = myIndex > 0 ? sorted[myIndex - 1] : null;
  const fmt = (r: { minutes: number; drops: number }) => (metric === 'minutes' ? fmtMinutes(r.minutes) : String(r.drops));
  const diff = ahead ? ahead[metric] - sorted[myIndex][metric] : 0;
  const gap = ahead ? (diff <= 0 ? `Tied with ${ahead.name}` : metric === 'minutes' ? `${fmtMinutes(diff + 1)} more focus to pass ${ahead.name}` : `${diff + 1} more ${diff + 1 === 1 ? 'drop' : 'drops'} to pass ${ahead.name}`) : myIndex === 0 && sorted.length > 1 ? 'You are in first place this week' : '';

  const scopes = [
    { value: 'school' as const, label: 'School' },
    { value: 'major' as const, label: 'Major' },
    { value: 'year' as const, label: 'Year' },
    { value: 'friends' as const, label: 'Friends' },
    { value: 'class' as const, label: 'Class' },
  ];

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4">
        {[
          ['Your rank', myIndex >= 0 ? `#${myIndex + 1}` : 'Unranked', myIndex >= 0 ? `of ${sorted.length} ${current?.label ? `in ${current.label}` : ''}` : 'Pick a group below'],
          ['Focus this week', fmtMinutes(myMinutes), `${p.weeklyGoal ? Math.min(100, Math.round((myMinutes / p.weeklyGoal) * 100)) : 0}% of your weekly goal`],
          ['Drops this week', String(myDrops), 'Hosted or joined'],
          ['Board resets in', resetsIn(now), 'Monday, midnight UTC'],
        ].map(([label, value, note]) => (
          <div key={label} className="min-w-0 bg-surface px-4 py-3.5">
            <p className="text-[12px] font-medium text-muted">{label}</p>
            <p className="tnum mt-0.5 truncate text-[22px] leading-8 font-semibold tracking-tight max-sm:text-[18px] max-sm:leading-7">{value}</p>
            <p className="truncate text-[12px] text-muted">{note}</p>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border border-line bg-surface">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <Segmented wrap={false} label="Group" value={scope} onChange={setScope} options={scopes} />
          <Segmented wrap={false} label="Ranked by" value={metric} onChange={setMetric} options={[{ value: 'minutes', label: 'Focus time' }, { value: 'drops', label: 'Drops' }]} />
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setEditing(true)}>Edit groups</Button>
        </div>
        {gap && <p className="border-b border-line bg-surface-2 px-4 py-2 text-[13px] text-ink-2">{gap}.</p>}

        {!current ? (
          <p className="px-4 py-10 text-center text-[13px] text-muted">Loading rankings</p>
        ) : current.message === 'friends' ? (
          <div className="px-4 py-10 text-center">
            <p className="text-[14px] font-semibold">No friend circle yet</p>
            <p className="mt-1 text-[13px] text-muted">Create a circle and share its code to compare with friends.</p>
            <Link href="/drop?tab=friends&view=circle"><Button size="sm" className="mt-3">Set up a circle</Button></Link>
          </div>
        ) : current.message === 'class' ? (
          <div className="px-4 py-10 text-center">
            <p className="text-[14px] font-semibold">Not in a class</p>
            <p className="mt-1 text-[13px] text-muted">Join your class with the code from your instructor.</p>
            <Link href="/drop?tab=friends&view=circle"><Button size="sm" className="mt-3">Join a class</Button></Link>
          </div>
        ) : current.message ? (
          <div className="px-4 py-10 text-center">
            <p className="text-[13px] text-muted">{current.message}</p>
            <Button size="sm" className="mt-3" onClick={() => setEditing(true)}>Set your groups</Button>
          </div>
        ) : sorted.length ? (
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-muted">
                <th className="w-14 py-2 pl-4 font-medium">Rank</th>
                <th className="py-2 font-medium">Student</th>
                <th className="hidden w-[38%] py-2 font-medium sm:table-cell" aria-label="Share of leader" />
                <th className="w-24 py-2 pr-4 text-right font-medium">{metric === 'minutes' ? 'Focus' : 'Drops'}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, 50).map((r, i) => (
                <tr key={r.id} className={cn('border-b border-line last:border-0', r.me ? 'bg-accent-soft' : 'hover:bg-surface-2')}>
                  <td className="tnum py-2.5 pl-4 text-[13px] font-semibold text-muted">{i < 3 ? <span className={cn('grid size-6 place-items-center rounded-md text-[12px]', i === 0 ? 'bg-accent-fill text-white' : 'bg-surface-3 text-ink')}>{i + 1}</span> : i + 1}</td>
                  <td className="py-2.5">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Avatar name={r.name} color={toneFor(r.id)} size={26} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{r.name}{r.me && <span className="ml-1.5 text-[12px] font-normal text-muted">you</span>}</span>
                        {(r.major || r.year) && <span className="block truncate text-[12px] text-muted">{[r.major, YEARS.find((y) => y.value === r.year)?.label].filter(Boolean).join(' · ')}</span>}
                      </span>
                    </span>
                  </td>
                  <td className="hidden py-2.5 pr-6 sm:table-cell">
                    <span className="block h-1.5 overflow-hidden rounded-full bg-surface-3"><span className={cn('block h-full rounded-full', r.me ? 'bg-accent' : 'bg-line-strong')} style={{ width: `${(r[metric] / top) * 100}%` }} /></span>
                  </td>
                  <td className="tnum py-2.5 pr-4 text-right font-medium">{fmt(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-4 py-10 text-center text-[13px] text-muted">No one else on this board yet. Share Studytime with classmates.</p>
        )}
      </section>
      {editing && <GroupsDialog onClose={() => setEditing(false)} />}
    </div>
  );
}

function Trophies() {
  const p = useProfile();
  const x = useExtras();
  const sets = useLearning((s) => s.sets.length);
  const notes = useAi((s) => s.notes.length);
  const now = useNow(60_000);
  const challenges = useChallengeStates();
  const list = trophies({ sessions: p.sessions, dropLog: x.dropLog, checkins: x.checkins, water: x.water, waterGoal: x.waterGoal, resets: x.resets.length, flashcardSets: sets, notes, now, bestRewardStreak: longestRun(x.rewardDays), lessonsDone: x.courses.reduce((n, c) => n + c.units.reduce((m, u) => m + u.lessons.filter((l) => l.done).length, 0), 0) });
  const won: Trophy[] = challenges.map((c) => {
    const tiers: [number, number, number] = [1, 3, 5];
    const tier = tiers.filter((n) => c.wins >= n).length as Trophy['tier'];
    return { id: `ch-${c.challenge.id}`, group: 'Focus', title: c.challenge.title, unit: 'times finished', have: c.wins, tiers, tier, next: (tiers as number[])[tier] ?? null };
  });
  const lv = level(p.points);
  const ways: [string, string][] = [
    ...Object.entries(AWARD).map(([m, pts]) => [`${m} min session`, `+${pts}`] as [string, string]),
    ['Daily check-in', '+5 to +50'],
    ['Host or join a drop', '+10'],
    ['Finish a course lesson', '+5'],
    ['Daily goal', `+${DAILY_GOAL_BONUS}`],
    ['3 and 7 day streaks', `+${STREAK_BONUS.three} / +${STREAK_BONUS.weekly}`],
  ];
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] [&>*]:min-w-0">
      <TrophyCabinet list={list} extra={{ title: 'Challenges', items: won }} />
      <aside className="grid content-start gap-4 lg:sticky lg:top-6">
        <section className="rounded-xl border border-line bg-surface p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-[12px] font-medium text-muted">Level</p>
            <p className="tnum text-[12px] text-muted">{p.points} points</p>
          </div>
          <p className="tnum mt-0.5 text-[32px] leading-10 font-semibold tracking-tight">{lv.level}</p>
          <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-surface-3"><span className="block h-full rounded-full bg-accent" style={{ width: `${(lv.into / lv.span) * 100}%` }} /></span>
          <p className="tnum mt-1.5 text-[12px] text-muted">{lv.span - lv.into} to level {lv.level + 1}</p>
        </section>
        <section className="rounded-xl border border-line bg-surface p-4">
          <p className="mb-2 text-[13px] font-semibold">Points</p>
          <dl className="grid gap-1.5 text-[13px]">
            {ways.map(([k, v]) => <div key={k} className="flex justify-between gap-3"><dt className="text-muted">{k}</dt><dd className="tnum font-medium">{v}</dd></div>)}
          </dl>
        </section>
      </aside>
    </div>
  );
}

type Tab = 'board' | 'challenges' | 'achievements' | 'garden';
const TABS: { value: Tab; label: string }[] = [
  { value: 'board', label: 'Leaderboard' },
  { value: 'challenges', label: 'Challenges' },
  { value: 'achievements', label: 'Trophies' },
  { value: 'garden', label: 'Tree & pet' },
];

export function LeaderboardPage() {
  const [tab, setTab] = useState<Tab>(() => {
    const t = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('tab') : null;
    return TABS.some((o) => o.value === t) ? (t as Tab) : 'board';
  });
  const go = (t: Tab) => (setTab(t), history.replaceState(null, '', t === 'board' ? '/leaderboard' : `/leaderboard?tab=${t}`));
  return (
    <>
      <header className="mt-4 mb-4 max-sm:mt-2">
        <h1 className="text-[26px] leading-8 max-sm:text-[22px]">Leaderboard</h1>
      </header>
      <Tabs className="mb-5" label="Leaderboard" value={tab} onChange={go} options={TABS} />
      {tab === 'board' && <Leaderboard />}
      {tab === 'garden' && (
        <div className="grid gap-4">
          <GardenPage />
          <PacksPanel />
          <Collection />
        </div>
      )}
      {tab === 'challenges' && <ChallengesPanel />}
      {tab === 'achievements' && <Trophies />}
    </>
  );
}
