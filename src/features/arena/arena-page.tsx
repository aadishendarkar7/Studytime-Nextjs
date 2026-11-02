'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import CountUp from '@/components/bits/CountUp';
import { Icon, type IconName } from '@/components/ui/icons';
import { SignInGate } from '@/features/auth/sign-in-gate';
import { api } from '@/lib/api';
import { TIER_COLOR, TIERS, TOPICS, type ArenaBoardEntry, type ArenaDuelView, type ArenaHome, type ArenaMode, type ArenaRunView, type Topic } from '@/lib/arena/types';
import { toast } from '@/lib/stores/ui';
import { cn } from '@/lib/utils';
import { C, display, Emblem, Index, Initial, SkewButton, Stage } from './arena-ui';
import { Match } from './match';

const topicName = (t: Topic) => TOPICS.find((x) => x.id === t)?.label ?? 'Mixed';
const label = 'text-[11px] font-bold tracking-[0.16em] uppercase';

function TopicPicker({ value, onChange, tone }: { value: Topic; onChange: (t: Topic) => void; tone: string }) {
  return (
    <div role="radiogroup" aria-label="Topic" className="flex flex-wrap gap-1.5">
      {TOPICS.map((t) => {
        const on = value === t.id;
        return (
          <button key={t.id} type="button" role="radio" aria-checked={on} onClick={() => onChange(t.id)} className="h-8 -skew-x-12 rounded-[4px] border px-3 text-[12px] font-bold transition-colors" style={{ borderColor: on ? tone : C.line, background: on ? tone : 'transparent', color: on ? C.stage : '#fff' }}>
            <span className="inline-block skew-x-12">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** A mode: its own color, a big index number, stripes that run when you hover. */
function ModeCard({ n, icon, title, sub, tone, children, hot }: { n: number; icon: IconName; title: string; sub: string; tone: string; children: React.ReactNode; hot?: boolean }) {
  return (
    <Stage className={cn('group st-rise flex flex-col border transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-1')}>
      <div className="st-stripes relative flex items-start justify-between gap-3 px-5 pt-5 pb-4" style={{ background: `linear-gradient(135deg, ${tone}2e, transparent 70%)` }}>
        <span className="grid size-11 -skew-x-12 place-items-center rounded-[6px]" style={{ background: tone, color: C.stage }}><Icon name={icon} className="size-5 skew-x-12" /></span>
        <Index n={n} color={tone} />
        {hot && <span className={cn('absolute top-3 left-[70px] flex items-center gap-1.5 text-[10px]', display)} style={{ color: tone }}><span className="st-live size-1.5 rounded-full" style={{ background: tone }} />Open</span>}
      </div>
      <div className="flex flex-1 flex-col px-5 pb-5">
        <h3 className={cn('text-[22px] leading-7', display)}>{title}</h3>
        <p className="mt-1 text-[13px] leading-5" style={{ color: C.muted }}>{sub}</p>
        <div className="mt-4 flex flex-1 flex-col">{children}</div>
      </div>
      <span className="pointer-events-none absolute inset-0 rounded-[16px] border-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ borderColor: tone, boxShadow: `0 0 32px -8px ${tone}` }} />
    </Stage>
  );
}

function DuelRow({ d, children }: { d: ArenaDuelView; children?: React.ReactNode }) {
  const color = d.status === 'done' ? (d.won === true ? C.lime : d.won === false ? C.coral : C.amber) : C.sky;
  return (
    <li className="flex items-center gap-3 py-3">
      <span className={cn('grid size-10 shrink-0 -skew-x-12 place-items-center rounded-[6px] text-[15px] text-[#0d1015]', display)} style={{ background: color }}>{d.status === 'done' ? (d.won === true ? 'W' : d.won === false ? 'L' : 'T') : d.them.slice(0, 1).toUpperCase()}</span>
      <span className="min-w-0 flex-1">
        <strong className="block truncate text-[14px] font-bold">{d.status === 'done' ? `${d.won === true ? 'Beat' : d.won === false ? 'Lost to' : 'Tied with'} ${d.them}` : d.them}</strong>
        <span className="tnum block truncate text-[12px]" style={{ color: C.muted }}>{topicName(d.topic)}{d.myScore !== null ? `, you ${d.myScore}` : ''}{d.theirScore !== null ? `, them ${d.theirScore}` : ''}</span>
      </span>
      {children}
    </li>
  );
}

function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: [T, string][] }) {
  return (
    <div role="tablist" className="flex gap-0.5 rounded-[8px] p-0.5" style={{ background: C.panel2 }}>
      {items.map(([v, l]) => (
        <button key={v} type="button" role="tab" aria-selected={value === v} onClick={() => onChange(v)} className="h-7 rounded-[6px] px-3 text-[12px] font-bold transition-colors" style={{ background: value === v ? '#fff' : 'transparent', color: value === v ? C.stage : C.muted }}>{l}</button>
      ))}
    </div>
  );
}

/** The leaderboard: a podium for the top three, then everyone else. */
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
  const podium = list ? [list[1], list[0], list[2]] : [];
  const value = (e: ArenaBoardEntry) => (kind === 'rating' ? e.rating : e.weekPoints);
  return (
    <Stage className="p-5 max-sm:p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className={cn('mr-auto text-[26px] leading-8', display)}>Leaderboard</h2>
        <Tabs value={kind} onChange={setKind} items={[['rating', 'Rating'], ['week', 'This week']]} />
        <Tabs value={scope} onChange={setScope} items={[['all', 'Everyone'], ['school', 'My school'], ['following', 'Following']]} />
      </div>
      {!list ? (
        <div className="mt-5 grid gap-2">{[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-[10px]" style={{ background: C.panel }} />)}</div>
      ) : list.length === 0 ? (
        <p className="mt-5 rounded-[10px] border border-dashed px-4 py-10 text-center text-[14px]" style={{ borderColor: C.line, color: C.muted }}>{scope === 'school' ? 'Nobody from your school has played yet. Add your school in your profile, then take first place.' : scope === 'following' ? 'Nobody you follow has played yet. Send someone a challenge.' : 'The board is empty. Play one match and you are on it.'}</p>
      ) : (
        <>
          <ol className="mt-6 grid grid-cols-3 items-end gap-3 max-sm:gap-2">
            {podium.map((e, col) => {
              if (!e) return <li key={col} />;
              const h = e.rank === 1 ? 128 : e.rank === 2 ? 96 : 72;
              const tone = e.rank === 1 ? C.lime : e.rank === 2 ? C.sky : C.amber;
              return (
                <li key={e.id} className="flex flex-col items-center text-center">
                  {e.rank === 1 && <Icon name="trophy" className="st-float mb-1 size-6" style={{ color: C.lime } as CSSProperties} />}
                  <Initial name={e.name} color={tone} size={e.rank === 1 ? 52 : 42} className={cn(e.me && 'ring-4 ring-white')} />
                  <p className="mt-2 w-full truncate text-[14px] font-bold">{e.name}{e.me && ' (you)'}</p>
                  <p className="tnum text-[12px]" style={{ color: TIER_COLOR[e.tier] }}>{e.tier}</p>
                  <div className="st-podium mt-2 flex w-full flex-col items-center justify-start rounded-t-[8px] pt-3" style={{ height: h, background: `linear-gradient(180deg, ${tone}, ${tone}22)`, '--d': `${col === 1 ? 0 : col === 0 ? 150 : 300}ms` } as CSSProperties}>
                    <span className={cn('text-[34px] leading-none text-[#0d1015]', display)}>{e.rank}</span>
                    <span className="tnum mt-1 text-[13px] font-black text-[#0d1015]">{value(e)}</span>
                  </div>
                </li>
              );
            })}
          </ol>
          {list.length > 3 && (
            <ol className="mt-3 grid gap-1.5">
              {list.slice(3).map((e, i) => (
                <li key={e.id} className="st-rise flex items-center gap-3 rounded-[8px] px-3 py-2.5" style={{ background: e.me ? `${C.lime}1f` : C.panel, outline: e.me ? `1px solid ${C.lime}` : 'none', '--i': i } as CSSProperties}>
                  <span className={cn('tnum w-8 text-[18px]', display)} style={{ color: C.muted }}>{e.rank}</span>
                  <Initial name={e.name} color={TIER_COLOR[e.tier]} size={30} />
                  <span className="min-w-0 flex-1"><strong className="block truncate text-[14px] font-bold">{e.name}{e.me && ' (you)'}</strong>{e.school && <span className="block truncate text-[12px]" style={{ color: C.muted }}>{e.school}</span>}</span>
                  <span className={cn('text-[12px] max-sm:hidden', display)} style={{ color: TIER_COLOR[e.tier] }}>{e.tier}</span>
                  <span className="tnum w-16 text-right text-[16px] font-black">{value(e)}</span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </Stage>
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
        <div className="mx-auto mt-4 max-w-[780px] max-sm:mt-2"><Match key={match.run.id} initial={match.run} onExit={exit} onAgain={match.again} /></div>
      </SignInGate>
    );
  }

  const me = home?.me;
  const tierIndex = me ? TIERS.findIndex((t) => t.name === me.tier) : 0;
  const from = TIERS[tierIndex]?.min ?? 0;
  const progress = me?.next ? Math.min(1, Math.max(0, (me.rating - from) / (me.next.at - from))) : 1;
  const segs = 12;

  return (
    <SignInGate title="Sign in to compete" icon="trophy">
      <div className="mt-6 grid gap-5 max-sm:mt-3">
        <Stage className="p-7 max-sm:p-5">
          <div className="flex flex-wrap items-start gap-6">
            <div className="min-w-0 flex-1">
              <p className={cn('flex items-center gap-2', label)} style={{ color: C.lime }}>
                <span className="st-live size-2 rounded-full" style={{ background: C.lime }} />
                {home ? `${home.daily.players} ${home.daily.players === 1 ? 'player' : 'players'} today` : 'Live'}
              </p>
              <h1 className={cn('mt-2 text-[76px] leading-[0.85] max-sm:text-[54px]', display)}>
                Arena<span style={{ color: C.lime }}>.</span>
              </h1>
              <p className="mt-3 max-w-[46ch] text-[15px] leading-6 text-white/75">Ten questions. Fifteen seconds each. Beat other students, take their rating, climb the board.</p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <SkewButton disabled={!home || Boolean(busy)} onClick={() => void start('quick', { topic: quickTopic })}><Icon name="play" className="size-4" />Play now</SkewButton>
                {home && !home.daily.played && <SkewButton tone={C.amber} disabled={Boolean(busy)} onClick={() => void start('daily')}><Icon name="calendar" className="size-4" />{home.daily.inProgress ? 'Finish daily' : 'Daily challenge'}</SkewButton>}
              </div>
            </div>
            {me && <><span className="max-sm:hidden"><Emblem tier={me.tier} rating={me.rating} size={132} /></span><span className="absolute top-5 right-4 sm:hidden"><Emblem tier={me.tier} rating={me.rating} size={72} /></span></>}
          </div>

          {me && (
            <div className="mt-7 grid gap-5 border-t pt-5 md:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)]" style={{ borderColor: C.line }}>
              <div>
                <div className="flex items-baseline justify-between">
                  <p className={label} style={{ color: C.muted }}>Next rank</p>
                  <p className="tnum text-[12px] font-bold" style={{ color: me.next ? TIER_COLOR[me.next.name] : C.lime }}>{me.next ? `${me.next.at - me.rating} to ${me.next.name}` : 'Top rank'}</p>
                </div>
                <div className="mt-2 flex gap-1">
                  {Array.from({ length: segs }, (_, i) => <span key={i} className="h-3 flex-1 -skew-x-12 rounded-[2px]" style={{ background: C.line }}><span className="st-seg block h-full rounded-[2px]" style={{ background: (i + 1) / segs <= progress + 0.0001 ? C.lime : 'transparent', '--i': i } as CSSProperties} /></span>)}
                </div>
                <p className="tnum mt-2 text-[12px]" style={{ color: C.muted }}>{me.rank ? `#${me.rank} of ${me.players} players` : 'Play a match to get ranked'}</p>
              </div>
              <div className="grid grid-cols-4 gap-2 max-sm:grid-cols-2">
                {([['Wins', me.wins, C.lime], ['Best', me.best, C.sky], ['This week', me.weekPoints, C.amber], ['Streak', me.streak, C.coral]] as const).map(([l, v, c]) => (
                  <div key={l} className="rounded-[8px] px-3 py-2.5" style={{ background: C.panel }}>
                    <p className="tnum text-[26px] leading-8 font-black" style={{ color: c }}><CountUp to={v} duration={1} /></p>
                    <p className={label} style={{ color: C.muted }}>{l}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Stage>

        {error && <p className="rounded-[10px] border border-line bg-surface px-4 py-3 text-[14px] text-danger">{error} <button type="button" className="font-semibold underline" onClick={() => void load()}>Try again</button></p>}

        {home && home.inbox.length > 0 && (
          <Stage className="st-incoming border-2 p-5" >
            <p className={cn('flex items-center gap-2', label)} style={{ color: C.coral }}><span className="st-live size-2 rounded-full" style={{ background: C.coral }} />Incoming</p>
            <h2 className={cn('mt-1 text-[24px]', display)}>{home.inbox.length === 1 ? 'You have been challenged' : `${home.inbox.length} challenges waiting`}</h2>
            <ul className="mt-1 divide-y" style={{ borderColor: C.line }}>
              {home.inbox.map((d) => (
                <DuelRow key={d.id} d={d}>
                  <button type="button" className="h-9 px-3 text-[13px] font-bold" style={{ color: C.muted }} onClick={async () => { try { await api.arena.decline(d.id); void load(); } catch (e) { toast((e as Error).message, 'error'); } }}>Decline</button>
                  <SkewButton tone={C.coral} className="h-10 px-4 text-[13px]" disabled={busy === `accept${d.id}`} onClick={() => void start('accept', { duelId: d.id })}>Accept</SkewButton>
                </DuelRow>
              ))}
            </ul>
          </Stage>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          <ModeCard n={1} icon="calendar" title="Daily" sub="Same ten questions for everyone today. One shot." tone={C.amber} hot={Boolean(home && !home.daily.played)}>
            {home?.daily.played ? (
              <>
                <p className="tnum text-[40px] leading-none font-black" style={{ color: C.amber }}>{home.daily.score?.toLocaleString()}</p>
                <p className="tnum mt-1 text-[13px]" style={{ color: C.muted }}>#{home.daily.rank} of {home.daily.players} today. New set at midnight ET.</p>
              </>
            ) : (
              <SkewButton tone={C.amber} className="self-start" disabled={!home || Boolean(busy)} onClick={() => void start('daily')}>{home?.daily.inProgress ? 'Finish it' : 'Play today'}</SkewButton>
            )}
            {home && home.daily.top.length > 0 && (
              <ol className="mt-4 grid gap-1.5 border-t pt-3" style={{ borderColor: C.line }}>
                {home.daily.top.map((t) => (
                  <li key={t.id} className="tnum flex items-center gap-2 text-[13px]" style={{ color: t.me ? C.amber : '#fff' }}>
                    <span className={cn('w-5', display)} style={{ color: C.muted }}>{t.rank}</span><span className="min-w-0 flex-1 truncate font-semibold">{t.name}{t.me && ' (you)'}</span><span className="font-black">{t.score}</span>
                  </li>
                ))}
              </ol>
            )}
          </ModeCard>

          <ModeCard n={2} icon="target" title="Quick match" sub="Race a real run by someone near your rating. Win and climb." tone={C.lime}>
            <TopicPicker value={quickTopic} onChange={setQuickTopic} tone={C.lime} />
            <SkewButton className="mt-auto self-start" disabled={!home || Boolean(busy)} onClick={() => void start('quick', { topic: quickTopic })}>Find a match</SkewButton>
          </ModeCard>

          <ModeCard n={3} icon="friends" title="Duel" sub="Pick someone you follow. You play first, they get the same ten." tone={C.coral}>
            {home && home.friends.length > 0 ? (
              <>
                <label className="sr-only" htmlFor="arenaFriend">Opponent</label>
                <select id="arenaFriend" value={friend} onChange={(e) => setFriend(e.target.value)} className="h-10 rounded-[8px] border px-3 text-[14px] font-semibold text-white outline-none" style={{ background: C.panel, borderColor: C.line }}>
                  <option value="">Pick an opponent</option>
                  {home.friends.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.tier} {f.rating})</option>)}
                </select>
                <div className="mt-3"><TopicPicker value={duelTopic} onChange={setDuelTopic} tone={C.coral} /></div>
                <SkewButton tone={C.coral} className="mt-4 self-start" disabled={!friend || Boolean(busy)} onClick={() => void start('duel', { to: friend, topic: duelTopic })}>Send challenge</SkewButton>
              </>
            ) : (
              <>
                <p className="text-[13px]" style={{ color: C.muted }}>Follow classmates to challenge them.</p>
                <Link href="/friends" className="mt-auto self-start"><SkewButton tone={C.coral} tabIndex={-1}>Find people</SkewButton></Link>
              </>
            )}
          </ModeCard>
        </div>

        {home && (home.sent.length > 0 || home.results.length > 0) && (
          <div className="grid gap-4 md:grid-cols-2">
            {home.sent.length > 0 && (
              <Stage className="p-5">
                <h2 className={cn('text-[18px]', display)}>Waiting on them</h2>
                <ul className="divide-y" style={{ borderColor: C.line }}>{home.sent.map((d) => <DuelRow key={d.id} d={d}><span className={cn('text-[11px]', display)} style={{ color: C.sky }}>Pending</span></DuelRow>)}</ul>
              </Stage>
            )}
            {home.results.length > 0 && (
              <Stage className="p-5">
                <h2 className={cn('text-[18px]', display)}>Recent duels</h2>
                <ul className="divide-y" style={{ borderColor: C.line }}>{home.results.map((d) => <DuelRow key={d.id} d={d} />)}</ul>
              </Stage>
            )}
          </div>
        )}

        <Board key={boardKey} />

        <Stage className="grid gap-4 p-5 text-[13px] leading-5 sm:grid-cols-3">
          <p style={{ color: C.muted }}><strong className={cn('mb-1 block text-[15px] text-white', display)}>Scoring</strong>Right answer 100, plus up to 50 for speed. A perfect match is 1,500.</p>
          <p style={{ color: C.muted }}><strong className={cn('mb-1 block text-[15px] text-white', display)}>Rating</strong>Everyone starts at 1000. Beat someone rated higher and you climb faster.</p>
          <p style={{ color: C.muted }}><strong className={cn('mb-1 block text-[15px] text-white', display)}>Ranks</strong>{TIERS.map((t, i) => <span key={t.name} style={{ color: TIER_COLOR[t.name] }} className="font-bold">{t.name}{i < TIERS.length - 1 ? ', ' : ''}</span>)}. Every match adds points to your total.</p>
        </Stage>
      </div>
    </SignInGate>
  );
}
