'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Hero, HeroButton, HeroStat } from '@/components/ui/hero';
import { Icon, type IconName } from '@/components/ui/icons';
import { SignInGate } from '@/features/auth/sign-in-gate';
import { api } from '@/lib/api';
import { TIER_COLOR, TIERS, TOPICS, type ArenaBoardEntry, type ArenaDuelView, type ArenaHome, type ArenaMode, type ArenaRunView, type Topic } from '@/lib/arena/types';
import { toast } from '@/lib/stores/ui';
import { cn } from '@/lib/utils';
import { Match } from './match';

const topicName = (t: Topic) => TOPICS.find((x) => x.id === t)?.label ?? 'Mixed';

function TierMark({ tier, className }: { tier: string; className?: string }) {
  return <span className={cn('inline-flex items-center gap-1 text-[12px] font-semibold', className)} style={{ color: TIER_COLOR[tier] }}><span className="size-2 rotate-45 rounded-[2px]" style={{ background: TIER_COLOR[tier] }} />{tier}</span>;
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

function ModeCard({ icon, title, sub, children, accent }: { icon: IconName; title: string; sub: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <section className={cn('st-rise flex flex-col rounded-[10px] border bg-surface p-5 max-sm:p-4', accent ? 'border-accent-fill' : 'border-line')}>
      <div className="flex items-start gap-3">
        <span className={cn('grid size-10 shrink-0 place-items-center rounded-[8px]', accent ? 'bg-accent-fill text-white' : 'bg-surface-3 text-ink-2')}><Icon name={icon} className="size-[18px]" /></span>
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
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className={cn('grid size-9 shrink-0 place-items-center rounded-full text-[13px] font-bold', d.won === true ? 'bg-accent-fill text-white' : d.won === false ? 'bg-surface-3 text-ink-2' : 'bg-surface-3 text-ink-2')}>{d.status === 'done' ? (d.won === true ? 'W' : d.won === false ? 'L' : 'T') : d.them.slice(0, 1).toUpperCase()}</span>
      <span className="min-w-0 flex-1">
        <strong className="block truncate text-[14px] font-semibold">{d.status === 'done' ? `${d.won === true ? 'Beat' : d.won === false ? 'Lost to' : 'Tied with'} ${d.them}` : d.them}</strong>
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
  const top = list?.slice(0, 3) ?? [];
  const rest = list?.slice(3) ?? [];
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="mr-auto text-[18px] font-semibold">Arena leaderboard</h2>
        <div role="tablist" aria-label="Rank by" className="flex rounded-[8px] bg-surface-3 p-0.5">
          {([['rating', 'Rating'], ['week', 'This week']] as const).map(([v, l]) => <button key={v} type="button" role="tab" aria-selected={kind === v} onClick={() => setKind(v)} className={cn('h-7 rounded-[6px] px-3 text-[13px] font-medium', kind === v ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.12)]' : 'text-ink-2 hover:text-ink')}>{l}</button>)}
        </div>
        <div role="tablist" aria-label="Who" className="flex rounded-[8px] bg-surface-3 p-0.5">
          {([['all', 'Everyone'], ['school', 'My school'], ['following', 'Following']] as const).map(([v, l]) => <button key={v} type="button" role="tab" aria-selected={scope === v} onClick={() => setScope(v)} className={cn('h-7 rounded-[6px] px-3 text-[13px] font-medium', scope === v ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.12)]' : 'text-ink-2 hover:text-ink')}>{l}</button>)}
        </div>
      </div>
      {!list ? (
        <div className="grid gap-2">{[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-[10px] bg-surface-3" />)}</div>
      ) : list.length === 0 ? (
        <p className="rounded-[10px] border border-dashed border-line px-4 py-8 text-center text-[14px] text-muted">{scope === 'school' ? 'Nobody from your school has played yet. Add your school in your profile, then be first.' : scope === 'following' ? 'Nobody you follow has played yet. Challenge someone.' : 'Nobody has played yet. Be first on the board.'}</p>
      ) : (
        <>
          <ol className="grid gap-2 sm:grid-cols-3">
            {top.map((e) => (
              <li key={e.id} className={cn('st-rise rounded-[10px] border p-4', e.rank === 1 ? 'border-accent-fill bg-accent-fill text-white' : 'border-line bg-surface', e.me && e.rank !== 1 && 'border-ink')} style={{ '--i': e.rank } as React.CSSProperties}>
                <div className="flex items-center justify-between">
                  <span className={cn('tnum text-[28px] leading-none font-bold', e.rank === 1 ? 'text-white' : 'text-ink')}>{e.rank}</span>
                  {e.rank === 1 ? <span className="text-[12px] font-semibold text-white/85">{e.tier}</span> : <TierMark tier={e.tier} />}
                </div>
                <p className="mt-3 truncate text-[15px] font-semibold">{e.name}{e.me && ' (you)'}</p>
                <p className={cn('tnum text-[13px]', e.rank === 1 ? 'text-white/80' : 'text-muted')}>{kind === 'rating' ? `${e.rating} rating` : `${e.weekPoints} pts this week`}, {e.wins} wins</p>
              </li>
            ))}
          </ol>
          {rest.length > 0 && (
            <ol className="mt-2 divide-y divide-line rounded-[10px] border border-line bg-surface">
              {rest.map((e) => (
                <li key={e.id} className={cn('flex items-center gap-3 px-4 py-2.5', e.me && 'bg-surface-2')}>
                  <span className="tnum w-7 text-[14px] font-semibold text-muted">{e.rank}</span>
                  <span className="min-w-0 flex-1"><strong className="block truncate text-[14px] font-semibold">{e.name}{e.me && ' (you)'}</strong>{e.school && <span className="block truncate text-[12px] text-muted">{e.school}</span>}</span>
                  <TierMark tier={e.tier} className="max-sm:hidden" />
                  <span className="tnum w-16 text-right text-[14px] font-semibold">{kind === 'rating' ? e.rating : e.weekPoints}</span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  );
}

/** The Arena: compete in ten-question matches, earn points and climb the board. */
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
  const tierIndex = me ? TIERS.findIndex((t) => t.name === me.tier) : 0;
  const from = TIERS[tierIndex]?.min ?? 0;
  const progress = me?.next ? Math.min(1, Math.max(0, (me.rating - from) / (me.next.at - from))) : 1;

  return (
    <SignInGate title="Sign in to compete" icon="trophy">
      <div className="mt-6 grid gap-6 max-sm:mt-3">
        <Hero
          title="Arena"
          sub="Ten questions, fifteen seconds each. Beat other students, earn points and climb the board."
          action={<HeroButton disabled={!home || Boolean(busy)} onClick={() => void start('quick', { topic: quickTopic })} className="flex items-center gap-1.5"><Icon name="play" className="size-3.5" />Quick match</HeroButton>}
        >
          {me && (
            <div className="mt-5 grid gap-5 border-t border-white/20 pt-5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)]">
              <div>
                <p className="text-[13px] font-medium text-white/75">Your rank</p>
                <p className="mt-0.5 flex items-baseline gap-2"><span className="text-[28px] leading-9 font-bold tracking-tight">{me.tier}</span><span className="tnum text-[15px] text-white/80">{me.rating}</span></p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-white transition-[width] duration-700" style={{ width: `${progress * 100}%` }} /></div>
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
          <section className="st-rise rounded-[10px] border-2 border-accent-fill bg-surface p-4">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold"><Icon name="flag" className="size-4 text-accent-ink" />{home.inbox.length === 1 ? 'You have a challenge' : `You have ${home.inbox.length} challenges`}</h2>
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
          <ModeCard icon="calendar" title="Daily challenge" sub="The same ten questions for everyone today. One try." accent={Boolean(home && !home.daily.played)}>
            {home?.daily.played ? (
              <>
                <p className="tnum text-[28px] leading-9 font-bold tracking-tight">{home.daily.score?.toLocaleString()}</p>
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

          <ModeCard icon="target" title="Quick match" sub="Race a real run by someone near your rating. Win to climb.">
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

        <section className="grid gap-3 rounded-[10px] border border-line bg-surface-2 p-4 text-[13px] leading-5 text-ink-2 sm:grid-cols-3">
          <p><strong className="block text-ink">How scoring works</strong>A right answer is 100, plus up to 50 for speed. Ten questions, 1,500 at most.</p>
          <p><strong className="block text-ink">How rating works</strong>Everyone starts at 1000. Beat someone rated higher and you climb faster.</p>
          <p><strong className="block text-ink">Ranks</strong>{TIERS.map((t, i) => <span key={t.name} style={{ color: TIER_COLOR[t.name] }} className="font-semibold">{t.name}{i < TIERS.length - 1 ? ', ' : ''}</span>)}. Every match also adds points to your total.</p>
        </section>
      </div>
    </SignInGate>
  );
}
