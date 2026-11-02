import 'server-only';
import { getStorage } from '../storage';
import { HttpError } from '../http';
import { currentWeek, secret } from '../ids';
import { getAccount, type Account } from '../accounts';
import { following } from './feed';
import { questionsFor, QUESTIONS_PER_MATCH, SECONDS_PER_QUESTION, type Topic } from '@/lib/arena/questions';
import { tierOf, type ArenaBoardEntry, type ArenaHome, type ArenaMode, type ArenaQuestion, type ArenaResult, type ArenaRunView } from '@/lib/arena/types';

/**
 * The Arena: ten timed questions per match. The server keeps the answers and the clock,
 * so scores cannot be edited in the browser. Matches are against a friend (duel), against
 * a real earlier run by someone near your rating (quick match), or the daily set everyone plays.
 */

interface Player { name: string; school: string; rating: number; games: number; wins: number; best: number; week: string; weekPoints: number; streak: number; lastDaily: string }
interface Answer { c: number; ms: number; ok: boolean; pts: number }
interface Opponent { kind: 'ghost' | 'duel' | 'bot'; userId: string; name: string; rating: number; runId?: string }
interface Run { id: string; userId: string; name: string; mode: ArenaMode; topic: Topic; seed: string; i: number; qAt: number; answers: Answer[]; score: number; startedAt: number; done: boolean; opponent?: Opponent; duelId?: string; result?: ArenaResult }
interface Duel { id: string; seed: string; topic: Topic; from: string; fromName: string; to: string; toName: string; fromRun: string; toRun: string | null; status: 'waiting' | 'done' | 'declined'; createdAt: number; winner?: string | null }
interface Recent { runId: string; userId: string; name: string; rating: number; seed: string; topic: Topic; score: number; at: number }

const PLAYERS = 'ar:players';
const RUN = (id: string) => `ar:run:${id}`;
const DUEL = (id: string) => `ar:duel:${id}`;
const INBOX = (uid: string) => `ar:inbox:${uid}`;
const MY_DUELS = (uid: string) => `ar:duels:${uid}`;
const DAILY = (date: string) => `ar:daily:${date}`;
const DAILY_RUN = (date: string, uid: string) => `ar:dailyrun:${date}:${uid}`;
const RECENT = 'ar:recent';
const DAY = 86_400;
/** Time between your answer and the next question, while the right answer is shown. */
export const FEEDBACK_MS = 1100;
const GRACE_MS = 1500;
/** The 3, 2, 1 before the first question. */
export const COUNTDOWN_MS = 3200;
const START_RATING = 1000;

/** The day in US Eastern time, so the daily set changes at midnight on campus. */
export const arenaDate = (now = Date.now()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
const yesterday = (date: string) => arenaDate(new Date(`${date}T12:00:00-05:00`).getTime() - DAY * 1000);

export const pointsFor = (ok: boolean, ms: number) => (ok ? 100 + Math.round(50 * Math.max(0, 1 - ms / (SECONDS_PER_QUESTION * 1000))) : 0);
/** Elo: how much a rating moves after a result (1 win, 0.5 tie, 0 loss). */
export const eloChange = (me: number, them: number, result: number, k = 32) => Math.round(k * (result - 1 / (1 + 10 ** ((them - me) / 400))));

const s = () => getStorage();
async function player(a: Account): Promise<Player> {
  const p = await s().hget<Player>(PLAYERS, a.id);
  const week = currentWeek();
  const base: Player = p ?? { name: a.name, school: a.profile?.school ?? '', rating: START_RATING, games: 0, wins: 0, best: 0, week, weekPoints: 0, streak: 0, lastDaily: '' };
  return { ...base, name: a.name, school: a.profile?.school ?? base.school, ...(base.week !== week ? { week, weekPoints: 0 } : {}) };
}
const savePlayer = (id: string, p: Player) => s().hset(PLAYERS, id, p);

function questionView(run: Run, now: number): ArenaQuestion {
  const q = questionsFor(run.seed, run.topic)[run.i];
  return { index: run.i, prompt: q.prompt, choices: q.choices, seconds: SECONDS_PER_QUESTION, startsIn: Math.max(0, run.qAt - now), topic: q.topic };
}

async function timelineOf(runId?: string) {
  if (!runId) return undefined;
  const r = await s().get<Run>(RUN(runId));
  return r?.done ? r.answers.map((a) => ({ ok: a.ok, ms: a.ms, pts: a.pts })) : undefined;
}

async function runView(run: Run, now = Date.now()): Promise<ArenaRunView> {
  const o = run.opponent;
  return {
    id: run.id,
    mode: run.mode,
    topic: run.topic,
    total: QUESTIONS_PER_MATCH,
    index: run.i,
    score: run.score,
    answers: run.answers.map((a) => ({ ok: a.ok, pts: a.pts })),
    question: run.done ? null : questionView(run, now),
    opponent: o ? { name: o.name, rating: o.rating, tier: tierOf(o.rating).name, kind: o.kind, timeline: o.kind === 'bot' ? botTimeline(run.seed) : await timelineOf(o.runId) } : null,
    result: run.result ?? null,
  };
}

/** A practice opponent for when nobody else has played yet: steady, beatable, clearly labelled. */
function botTimeline(seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return Array.from({ length: QUESTIONS_PER_MATCH }, (_, i) => {
    h = (h * 1103515245 + 12345) >>> 0;
    const ok = h % 100 < 62;
    const ms = 5000 + ((h >>> 8) % 6000);
    void i;
    return { ok, ms, pts: pointsFor(ok, ms) };
  });
}

/** Starts a match, or picks up today's daily where you left it. */
export async function startRun(a: Account, input: { mode: ArenaMode; topic?: Topic; to?: string; duelId?: string }, now = Date.now()): Promise<ArenaRunView> {
  const me = await player(a);
  const id = secret(10);
  let run: Run = { id, userId: a.id, name: a.name, mode: input.mode, topic: input.topic ?? 'mixed', seed: secret(8), i: 0, qAt: now + COUNTDOWN_MS, answers: [], score: 0, startedAt: now, done: false };

  if (input.mode === 'daily') {
    const date = arenaDate(now);
    const existing = await s().get<string>(DAILY_RUN(date, a.id));
    if (existing) {
      const old = await s().get<Run>(RUN(existing));
      if (old) return runView(old, now);
    }
    run = { ...run, topic: 'mixed', seed: `daily:${date}` };
    await s().set(DAILY_RUN(date, a.id), id, 2 * DAY);
  } else if (input.mode === 'quick') {
    const recent = ((await s().get<Recent[]>(RECENT)) ?? []).filter((r) => r.userId !== a.id && (run.topic === 'mixed' || r.topic === run.topic));
    // Someone near your rating, from the people who played most recently.
    const close = recent.sort((x, y) => Math.abs(x.rating - me.rating) - Math.abs(y.rating - me.rating)).slice(0, 8);
    const ghost = close[Math.floor(Math.random() * close.length)];
    if (ghost) run = { ...run, seed: ghost.seed, topic: ghost.topic, opponent: { kind: 'ghost', userId: ghost.userId, name: ghost.name, rating: ghost.rating, runId: ghost.runId } };
    else run.opponent = { kind: 'bot', userId: 'bot', name: 'Practice bot', rating: START_RATING };
  } else if (input.mode === 'duel') {
    if (!input.to || input.to === a.id) throw new HttpError(400, 'Pick someone to challenge.');
    const them = await getAccount(input.to);
    if (!them) throw new HttpError(404, 'That person could not be found.');
    const theirs = await s().hget<Player>(PLAYERS, them.id);
    const duel: Duel = { id: secret(8), seed: run.seed, topic: run.topic, from: a.id, fromName: a.name, to: them.id, toName: them.name, fromRun: id, toRun: null, status: 'waiting', createdAt: now };
    await s().set(DUEL(duel.id), duel, 14 * DAY);
    run = { ...run, duelId: duel.id, opponent: { kind: 'duel', userId: them.id, name: them.name, rating: theirs?.rating ?? START_RATING } };
  } else if (input.mode === 'accept') {
    const duel = input.duelId ? await s().get<Duel>(DUEL(input.duelId)) : null;
    if (!duel || duel.to !== a.id || duel.status !== 'waiting') throw new HttpError(404, 'This challenge is no longer open.');
    if (duel.toRun) {
      const old = await s().get<Run>(RUN(duel.toRun));
      if (old) return runView(old, now);
    }
    const theirs = await s().hget<Player>(PLAYERS, duel.from);
    run = { ...run, seed: duel.seed, topic: duel.topic, duelId: duel.id, opponent: { kind: 'duel', userId: duel.from, name: duel.fromName, rating: theirs?.rating ?? START_RATING, runId: duel.fromRun } };
    await s().set(DUEL(duel.id), { ...duel, toRun: id }, 14 * DAY);
  }
  await s().set(RUN(id), run, 30 * DAY);
  return runView(run, now);
}

/** One answer. The server times it: a late answer counts as wrong. */
export async function answer(a: Account, runId: string, choice: number, now = Date.now()) {
  const run = await s().get<Run>(RUN(runId));
  if (!run || run.userId !== a.id) throw new HttpError(404, 'Match not found.');
  if (run.done) return { ok: false, answer: -1, pts: 0, score: run.score, run: await runView(run, now) };
  const q = questionsFor(run.seed, run.topic)[run.i];
  const ms = Math.max(0, now - run.qAt);
  const late = ms > SECONDS_PER_QUESTION * 1000 + GRACE_MS;
  const ok = !late && choice === q.answer;
  const pts = pointsFor(ok, Math.min(ms, SECONDS_PER_QUESTION * 1000));
  run.answers.push({ c: choice, ms, ok, pts });
  run.score += pts;
  run.i += 1;
  run.qAt = now + FEEDBACK_MS;
  if (run.i >= QUESTIONS_PER_MATCH) {
    run.done = true;
    run.result = await finish(a, run, now);
  }
  await s().set(RUN(run.id), run, 30 * DAY);
  return { ok, answer: q.answer, pts, score: run.score, run: await runView(run, now) };
}

async function finish(a: Account, run: Run, now: number): Promise<ArenaResult> {
  const me = await player(a);
  const correct = run.answers.filter((x) => x.ok).length;
  const pointsEarned = Math.round(run.score / 10);
  const ratingBefore = me.rating;
  let outcome: ArenaResult['outcome'] = null;
  let opponentScore: number | null = null;
  let ratingAfter = me.rating;

  if (run.mode === 'daily') {
    const date = arenaDate(now);
    await s().hset(DAILY(date), a.id, { name: a.name, school: me.school, score: run.score, correct, at: now });
    await s().expire(DAILY(date), 8 * DAY);
    me.streak = me.lastDaily === yesterday(date) ? me.streak + 1 : 1;
    me.lastDaily = date;
  } else if (run.opponent?.kind === 'ghost' || run.opponent?.kind === 'bot') {
    const tl = run.opponent.kind === 'bot' ? botTimeline(run.seed) : await timelineOf(run.opponent.runId);
    opponentScore = tl ? tl.reduce((n, x) => n + x.pts, 0) : null;
    if (opponentScore !== null) {
      outcome = run.score > opponentScore ? 'win' : run.score < opponentScore ? 'loss' : 'tie';
      ratingAfter = me.rating + eloChange(me.rating, run.opponent.rating, outcome === 'win' ? 1 : outcome === 'tie' ? 0.5 : 0, run.opponent.kind === 'bot' ? 16 : 32);
    }
  } else if (run.duelId) {
    const duel = await s().get<Duel>(DUEL(run.duelId));
    if (duel && duel.from === a.id) {
      // You played first. They get the challenge now; the result comes when they finish.
      outcome = 'pending';
      await s().hset(INBOX(duel.to), duel.id, now);
      await s().hset(MY_DUELS(a.id), duel.id, now);
      await s().hset(MY_DUELS(duel.to), duel.id, now);
    } else if (duel && duel.to === a.id) {
      const first = await s().get<Run>(RUN(duel.fromRun));
      const them = await getAccount(duel.from);
      opponentScore = first?.score ?? 0;
      outcome = run.score > opponentScore ? 'win' : run.score < opponentScore ? 'loss' : 'tie';
      const r = outcome === 'win' ? 1 : outcome === 'tie' ? 0.5 : 0;
      if (them) {
        const theirs = await player(them);
        ratingAfter = me.rating + eloChange(me.rating, theirs.rating, r);
        theirs.rating += eloChange(theirs.rating, me.rating, 1 - r);
        if (outcome === 'loss') theirs.wins += 1;
        await savePlayer(them.id, theirs);
      }
      await s().set(DUEL(duel.id), { ...duel, status: 'done', winner: outcome === 'tie' ? null : outcome === 'win' ? a.id : duel.from }, 30 * DAY);
      await s().hdel(INBOX(a.id), duel.id);
    }
  }

  me.rating = Math.max(100, ratingAfter);
  me.games += 1;
  if (outcome === 'win') me.wins += 1;
  me.best = Math.max(me.best, run.score);
  me.weekPoints += pointsEarned;
  await savePlayer(a.id, me);

  if (run.mode === 'quick' || (run.mode === 'duel' && outcome === 'pending')) {
    // Finished runs become opponents for quick matches.
    const recent = (await s().get<Recent[]>(RECENT)) ?? [];
    recent.unshift({ runId: run.id, userId: a.id, name: a.name, rating: ratingBefore, seed: run.seed, topic: run.topic, score: run.score, at: now });
    await s().set(RECENT, recent.slice(0, 300));
  }
  const daily = run.mode === 'daily' ? await dailyRank(a.id, arenaDate(now)) : null;
  return { score: run.score, correct, total: QUESTIONS_PER_MATCH, outcome, opponentScore, ratingBefore, ratingAfter: me.rating, pointsEarned, dailyRank: daily?.rank ?? null, dailyPlayers: daily?.players ?? null, streak: run.mode === 'daily' ? me.streak : null };
}

async function dailyRank(uid: string, date: string) {
  const all = Object.entries(await s().hgetall<{ score: number }>(DAILY(date))).sort((x, y) => y[1].score - x[1].score);
  const i = all.findIndex(([id]) => id === uid);
  return { rank: i < 0 ? null : i + 1, players: all.length };
}

export async function declineDuel(a: Account, duelId: string) {
  const duel = await s().get<Duel>(DUEL(duelId));
  if (!duel || duel.to !== a.id || duel.status !== 'waiting') throw new HttpError(404, 'This challenge is no longer open.');
  await s().set(DUEL(duel.id), { ...duel, status: 'declined' }, 7 * DAY);
  await s().hdel(INBOX(a.id), duel.id);
}

/** Everything the Arena page needs in one request. */
export async function arenaHome(a: Account, now = Date.now()): Promise<ArenaHome> {
  const me = await player(a);
  const date = arenaDate(now);
  const all = await s().hgetall<Player>(PLAYERS);
  const ranked = Object.entries(all).filter(([, p]) => p.games > 0).sort((x, y) => y[1].rating - x[1].rating);
  const rank = ranked.findIndex(([id]) => id === a.id);
  const dailyAll = Object.entries(await s().hgetall<{ name: string; score: number; correct: number }>(DAILY(date))).sort((x, y) => y[1].score - x[1].score);
  const mine = dailyAll.findIndex(([id]) => id === a.id);
  const dailyRunId = await s().get<string>(DAILY_RUN(date, a.id));
  const dailyRun = dailyRunId ? await s().get<Run>(RUN(dailyRunId)) : null;

  const duelIds = Object.entries(await s().hgetall<number>(MY_DUELS(a.id))).sort((x, y) => y[1] - x[1]).slice(0, 20).map(([id]) => id);
  const duels = (await Promise.all(duelIds.map((id) => s().get<Duel>(DUEL(id))))).filter((d): d is Duel => Boolean(d));
  const scoreOf = async (runId: string | null) => (runId ? (await s().get<Run>(RUN(runId)))?.score ?? null : null);
  const view = async (d: Duel) => {
    const mineFirst = d.from === a.id;
    return { id: d.id, topic: d.topic, createdAt: d.createdAt, status: d.status, them: mineFirst ? d.toName : d.fromName, myScore: await scoreOf(mineFirst ? d.fromRun : d.toRun), theirScore: d.status === 'done' ? await scoreOf(mineFirst ? d.toRun : d.fromRun) : null, won: d.status === 'done' ? (d.winner === null ? null : d.winner === a.id) : null };
  };
  const inbox = await Promise.all(duels.filter((d) => d.to === a.id && d.status === 'waiting' && !d.toRun).map(view));
  const sent = await Promise.all(duels.filter((d) => d.from === a.id && d.status === 'waiting').map(view));
  const results = await Promise.all(duels.filter((d) => d.status === 'done').slice(0, 6).map(view));

  const ids = (await following(a.id)).slice(0, 60);
  const friends = (await Promise.all(ids.map(async (id) => {
    const acc = await getAccount(id);
    return acc ? { id, name: acc.name, rating: all[id]?.rating ?? START_RATING, tier: tierOf(all[id]?.rating ?? START_RATING).name } : null;
  }))).filter((f): f is NonNullable<typeof f> => Boolean(f));

  return {
    me: { rating: me.rating, tier: tierOf(me.rating).name, next: tierOf(me.rating).next, games: me.games, wins: me.wins, best: me.best, weekPoints: me.weekPoints, streak: me.lastDaily === date || me.lastDaily === yesterday(date) ? me.streak : 0, rank: rank < 0 ? null : rank + 1, players: ranked.length },
    daily: { date, played: Boolean(dailyRun?.done), inProgress: Boolean(dailyRun && !dailyRun.done), score: dailyRun?.done ? dailyRun.score : null, rank: mine < 0 ? null : mine + 1, players: dailyAll.length, top: dailyAll.slice(0, 5).map(([id, d], i) => ({ id, name: d.name, score: d.score, rank: i + 1, me: id === a.id })) },
    inbox,
    sent,
    results,
    friends,
  };
}

export async function arenaBoard(a: Account, scope: 'all' | 'school' | 'following', kind: 'rating' | 'week'): Promise<ArenaBoardEntry[]> {
  const me = await player(a);
  const week = currentWeek();
  const all = Object.entries(await s().hgetall<Player>(PLAYERS)).filter(([, p]) => p.games > 0);
  const follows = scope === 'following' ? new Set([...(await following(a.id)), a.id]) : null;
  return all
    .filter(([id, p]) => (scope === 'all' ? true : scope === 'school' ? Boolean(me.school) && p.school.trim().toLowerCase() === me.school.trim().toLowerCase() : follows!.has(id)))
    .map(([id, p]) => ({ id, name: p.name, school: p.school, rating: p.rating, tier: tierOf(p.rating).name, games: p.games, wins: p.wins, weekPoints: p.week === week ? p.weekPoints : 0, me: id === a.id }))
    .sort((x, y) => (kind === 'rating' ? y.rating - x.rating : y.weekPoints - x.weekPoints))
    .slice(0, 100)
    .map((e, i) => ({ ...e, rank: i + 1 }));
}
