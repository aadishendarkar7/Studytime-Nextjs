'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Hero, HeroButton, HeroGhost, HeroStat } from '@/components/ui/hero';
import { Icon, type IconName } from '@/components/ui/icons';
import { SignInGate } from '@/features/auth/sign-in-gate';
import { api } from '@/lib/api';
import { TIER_COLOR, TIERS, TOPICS, type ArenaBoardEntry, type ArenaDuelView, type ArenaHome, type ArenaMode, type ArenaRunView, type Topic } from '@/lib/arena/types';
import { toast } from '@/lib/stores/ui';
import { cn } from '@/lib/utils';
import { Match } from './match';

const topicName = (t: Topic) => TOPICS.find((x) => x.id === t)?.label ?? 'Mixed';

function Tier({ tier, className }: { tier: string; className?: string }) {
  return <span className={cn('text-[12px] font-semibold', className)} style={{ color: TIER_COLOR[tier] }}>{tier}</span>;
}

function Toggle<T extends string>({ value, onChange, items, label }: { value: T; onChange: (v: T) => void; items: [T, string][]; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex rounded-[8px] bg-surface-3 p-0.5">
      {items.map(([v, l]) => (
        <button key={v} type="button" role="tab" aria-selected={value === v} onClick={() => onChange(v)} className={cn('h-7 rounded-[6px] px-3 text-[13px] font-medium transition-colors', value === v ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.12)]' : 'text-ink-2 hover:text-ink')}>{l}</button>
      ))}
    </div>
  );
}

function TopicPicker({ value, onChange }: { value: Topic; onChange: (t: Topic) => void }) {
  return (
    <div role="radiogroup" aria-label="Topic" className="flex flex-wrap gap-1.5">
      {TOPICS.map((t) => (
        <button key={t.id} type="button" role="radio" aria-checked={value === t.id} onClick={() => onChange(t.id)} className={cn('h-8 rounded-full border px-3 text-[13px] font-medium transition-colors', value === t.id ? 'border-ink bg-ink text-bg' : 'border-line text-ink-2 hover:border-line-strong hover:text-ink')}>{t.label}</button>
      ))}
    </div>
  );
}

function ModeCard({ icon, title, sub, children }: { icon: IconName; title: string; sub: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col rounded-[10px] border border-line bg-surface p-5 max-sm:p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-[8px] bg-surface-3 text-ink-2"><Icon name={icon} className="size-[18px]" /></span>
        <div className="min-w-0">
          <h3 className="text-[16px] font-semibold">{title}</h3>
          <p className="mt-0.5 text-[13px] leading-5 text-muted">{sub}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-1 flex-col">{children}</div>
    </section>
  );
}

function DuelRow({ d, children }: { d: ArenaDuelView; children?: React.ReactNode }) {
  const done = d.status === 'done';
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className={cn('grid size-8 shrink-0 place-items-center rounded-full text-[12px] font-semibold', done && d.won === true ? 'bg-accent-fill text-white' : 'bg-surface-3 text-ink-2')}>
        {done ? (d.won === true ? 'W' : d.won === false ? 'L' : 'T') : d.them.slice(0, 1).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block truncate text-[14px] font-medium">{done ? `${d.won === true ? 'Beat' : d.won === false ? 'Lost to' : 'Tied with'} ${d.them}` : d.them}</strong>
        <span className="tnum block truncate text-[12px] text-muted">{topicName(d.topic)}{d.myScore !== null ? `, you ${d.myScore}` : ''}{d.theirScore !== null ? `, them ${d.theirScore}` : ''}</span>
      </span>
      {children}
    </li>
  );
}

function Board() {
  const [kind, setKind] = useState<'rating' | 'week'>('rating');
  const [scope, setScope] = useState<'all' | 'school' | 'following'>('all');
  const [entries, setEntries] = useState<ArenaBoardEntry[] | null>(null);
  const [loaded, setLoaded] = useState('');
  const key = `${kind}:${scope}`;
  useEffect(() => {
    let stop = false;
    api.arena.board(scope, kind).then((r) => !stop && (setEntries(r.entries), setLoaded(key)), () => !stop && (setEntries([]), setLoaded(key)));
    return () => void (stop = true);
  }, [kind, scope, key]);
  const list = loaded === key ? entries ?? [] : null;
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-[17px] font-semibold">Leaderboard</h2>
        <Toggle label="Rank by" value={kind} onChange={setKind} items={[['rating', 'Rating'], ['week', 'This week']]} />
        <Toggle label="Who" value={scope} onChange={setScope} items={[['all', 'Everyone'], ['school', 'My school'], ['following', 'Following']]} />
      </div>
      {!list ? (
        <div className="h-40 animate-pulse rounded-[10px] bg-surface-3" />
      ) : list.length === 0 ? (
        <p className="rounded-[10px] border border-dashed border-line px-4 py-8 text-center text-[14px] text-muted">{scope === 'school' ? 'Nobody from your school has played yet. Add your school in your profile, then be first.' : scope === 'following' ? 'Nobody you follow has played yet. Send someone a challenge.' : 'Nobody has played yet. Play one match to get on the board.'}</p>
      ) : (
        <ol className="divide-y divide-line rounded-[10px] border border-line bg-surface">
          {list.map((e) => (
            <li key={e.id} className={cn('flex items-center gap-3 px-4 py-3', e.me && 'bg-accent-soft')}>
              <span className={cn('tnum w-7 text-[15px] font-semibold', e.rank <= 3 ? 'text-ink' : 'text-muted')}>{e.rank}</span>
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-[14px] font-medium">{e.name}{e.me && <span className="font-normal text-muted"> (you)</span>}</strong>
                {e.school && <span className="block truncate text-[12px] text-muted">{e.school}</span>}
              </span>
              <Tier tier={e.tier} className="max-sm:hidden" />
              <span className="tnum w-20 text-right text-[14px] font-semibold">{kind === 'rating' ? e.rating : `${e.weekPoints} pts`}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** The Arena: ten-question matches against other students, a rating, and a leaderboard. */
export function ArenaPage() {
  const [home, setHome] = useState<ArenaHome | null>(null);
  const [error, setError] = useState('');
  const [match, setMatch] = useState<{ run: ArenaRunView; again?: () => void } | null>(null);
  const [quickTopic, setQuickTopic] = useState<Topic>('mixed');
  const [duelTopic, setDuelTopic] = useState<Topic>('mixed');
  const [friend, setFriend] = useState('');
  const [busy, setBusy] = useState('');
  const [boardKey, setBoardKey] = useState(0);

  const load = useCallback(() => api.arena.home().then((h) => (setHome(h), setError('')), (e) => setError((e as Error).message)), []);
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const start = async (mode: ArenaMode, extra: { topic?: Topic; to?: string; duelId?: string } = {}) => {
    setBusy(mode + (extra.duelId ?? ''));
    try {
      const { run } = await api.arena.start({ mode, ...extra });
      setMatch({ run, again: mode === 'quick' ? () => void start('quick', extra) : mode === 'daily' ? () => void start('quick') : undefined });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy('');
    }
  };
  const exit = () => (setMatch(null), void load(), setBoardKey((k) => k + 1));

  if (match) {
    return (
      <SignInGate title="Sign in to compete" icon="trophy">
        <div className="mx-auto mt-4 max-w-[760px] max-sm:mt-2"><Match key={match.run.id} initial={match.run} onExit={exit} onAgain={match.again} /></div>
      </SignInGate>
    );
  }

  const me = home?.me;
  const from = me ? TIERS.find((t) => t.name === me.tier)?.min ?? 0 : 0;
  const progress = me?.next ? Math.min(1, Math.max(0, (me.rating - from) / (me.next.at - from))) : 1;

  return (
    <SignInGate title="Sign in to compete" icon="trophy">
      <div className="mt-6 grid gap-6 max-sm:mt-3">
        <Hero
          title="Arena"
          sub="Ten questions, fifteen seconds each. Play other students and climb the board."
          action={
            <>
              {home && !home.daily.played && <HeroGhost className="border border-white/35" disabled={Boolean(busy)} onClick={() => void start('daily')}>{home.daily.inProgress ? 'Finish the daily' : 'Daily challenge'}</HeroGhost>}
              <HeroButton disabled={!home || Boolean(busy)} onClick={() => void start('quick', { topic: quickTopic })}>Quick match</HeroButton>
            </>
          }
        >
          {me && (
            <div className="mt-5 grid gap-5 border-t border-white/20 pt-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)]">
              <div>
                <p className="text-[13px] text-white/75">Your rank</p>
                <p className="mt-0.5 flex items-baseline gap-2"><span className="text-[24px] leading-8 font-semibold tracking-tight">{me.tier}</span><span className="tnum text-[15px] text-white/80">{me.rating}</span></p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-white" style={{ width: `${progress * 100}%` }} /></div>
                <p className="tnum mt-1.5 text-[12px] text-white/75">{me.next ? `${me.next.at - me.rating} to ${me.next.name}` : 'Top rank'}{me.rank ? `, #${me.rank} of ${me.players}` : ''}</p>
              </div>
              <div className="grid grid-cols-4 gap-3 max-sm:grid-cols-2">
                <HeroStat value={me.wins} label={me.wins === 1 ? 'win' : 'wins'} />
                <HeroStat value={me.best || '-'} label="best score" />
                <HeroStat value={me.weekPoints} label="points this week" />
                <HeroStat value={me.streak} label="daily streak" />
              </div>
            </div>
          )}
        </Hero>

        {error && <p className="rounded-[10px] border border-line bg-surface px-4 py-3 text-[14px] text-danger">{error} <button type="button" className="font-semibold underline" onClick={() => void load()}>Try again</button></p>}

        {home && home.inbox.length > 0 && (
          <section className="rounded-[10px] border border-ink bg-surface p-4">
            <h2 className="text-[15px] font-semibold">{home.inbox.length === 1 ? 'You have a challenge' : `You have ${home.inbox.length} challenges`}</h2>
            <ul className="divide-y divide-line">
              {home.inbox.map((d) => (
                <DuelRow key={d.id} d={d}>
                  <Button size="sm" variant="ghost" onClick={async () => { try { await api.arena.decline(d.id); void load(); } catch (e) { toast((e as Error).message, 'error'); } }}>Decline</Button>
                  <Button size="sm" loading={busy === `accept${d.id}`} onClick={() => void start('accept', { duelId: d.id })}>Play</Button>
                </DuelRow>
              ))}
            </ul>
          </section>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          <ModeCard icon="calendar" title="Daily challenge" sub="The same ten questions for everyone today. One try.">
            {home?.daily.played ? (
              <>
                <p className="tnum text-[28px] leading-9 font-semibold tracking-tight">{home.daily.score?.toLocaleString()}</p>
                <p className="tnum text-[13px] text-muted">#{home.daily.rank} of {home.daily.players} today. New set at midnight ET.</p>
              </>
            ) : (
              <Button className="self-start" loading={busy === 'daily'} disabled={!home} onClick={() => void start('daily')}>{home?.daily.inProgress ? 'Finish today’s set' : 'Play today’s set'}</Button>
            )}
            {home && home.daily.top.length > 0 && (
              <ol className="mt-4 grid gap-1 border-t border-line pt-3">
                {home.daily.top.map((t) => (
                  <li key={t.id} className={cn('tnum flex items-center gap-2 text-[13px]', t.me && 'font-semibold')}>
                    <span className="w-5 text-muted">{t.rank}</span><span className="min-w-0 flex-1 truncate">{t.name}{t.me && ' (you)'}</span><span>{t.score}</span>
                  </li>
                ))}
              </ol>
            )}
          </ModeCard>

          <ModeCard icon="target" title="Quick match" sub="Race a real run by someone near your rating.">
            <TopicPicker value={quickTopic} onChange={setQuickTopic} />
            <Button className="mt-4 self-start" loading={busy === 'quick'} disabled={!home} onClick={() => void start('quick', { topic: quickTopic })}>Find a match</Button>
          </ModeCard>

          <ModeCard icon="friends" title="Challenge a friend" sub="You play first. They get the same ten questions.">
            {home && home.friends.length > 0 ? (
              <>
                <label className="sr-only" htmlFor="arenaFriend">Friend</label>
                <select id="arenaFriend" value={friend} onChange={(e) => setFriend(e.target.value)} className="h-10 rounded-[8px] border border-line bg-surface px-3 text-[14px] outline-none focus:border-ink">
                  <option value="">Pick someone you follow</option>
                  {home.friends.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.tier} {f.rating})</option>)}
                </select>
                <div className="mt-3"><TopicPicker value={duelTopic} onChange={setDuelTopic} /></div>
                <Button className="mt-4 self-start" disabled={!friend} loading={busy === 'duel'} onClick={() => void start('duel', { to: friend, topic: duelTopic })}>Send challenge</Button>
              </>
            ) : (
              <>
                <p className="text-[13px] text-muted">Follow classmates to challenge them.</p>
                <Link href="/friends" className="mt-3 self-start"><Button variant="secondary">Find people</Button></Link>
              </>
            )}
          </ModeCard>
        </div>

        {home && (home.sent.length > 0 || home.results.length > 0) && (
          <div className="grid gap-4 md:grid-cols-2">
            {home.sent.length > 0 && (
              <section className="rounded-[10px] border border-line bg-surface p-4">
                <h2 className="text-[15px] font-semibold">Waiting on them</h2>
                <ul className="divide-y divide-line">{home.sent.map((d) => <DuelRow key={d.id} d={d}><span className="text-[12px] text-muted">Waiting</span></DuelRow>)}</ul>
              </section>
            )}
            {home.results.length > 0 && (
              <section className="rounded-[10px] border border-line bg-surface p-4">
                <h2 className="text-[15px] font-semibold">Recent duels</h2>
                <ul className="divide-y divide-line">{home.results.map((d) => <DuelRow key={d.id} d={d} />)}</ul>
              </section>
            )}
          </div>
        )}

        <Board key={boardKey} />

        <p className="text-[13px] leading-5 text-muted">
          A right answer is worth 100, plus up to 50 for speed. Everyone starts at a rating of 1000, and beating someone rated higher moves you up faster. Ranks go{' '}
          {TIERS.map((t, i) => <span key={t.name}><Tier tier={t.name} className="text-[13px]" />{i < TIERS.length - 2 ? ', ' : i === TIERS.length - 2 ? ' and ' : ''}</span>)}. Every match also adds to your points.
        </p>
      </div>
    </SignInGate>
  );
}
