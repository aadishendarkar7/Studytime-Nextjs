import { beforeEach, describe, expect, it } from 'vitest';
import { createAccount, getAccount, type Account } from '@/lib/server/accounts';
import { setStorage } from '@/lib/server/storage';
import { MemoryStorage } from '@/lib/server/storage/memory';
import { questionsFor } from '@/lib/arena/questions';
import { tierOf } from '@/lib/arena/types';
import { answer, arenaBoard, arenaHome, declineDuel, eloChange, FEEDBACK_MS, pointsFor, startRun } from '@/lib/server/services/arena';
import { follow } from '@/lib/server/services/feed';

async function person(name: string): Promise<Account> {
  const { id } = await createAccount({ email: `${name.toLowerCase()}@x.edu`, password: 'password1', name });
  return (await getAccount(id))!;
}

/** Plays a whole match: right answers when `right`, wrong ones otherwise, 2 s per question. */
async function play(a: Account, runId: string, seed: { seed: string; topic: 'mixed' | 'math' | 'science' | 'general' }, right: boolean, start: number) {
  const qs = questionsFor(seed.seed, seed.topic);
  let t = start + 600;
  let last;
  for (const q of qs) {
    t += 2000;
    last = await answer(a, runId, right ? q.answer : (q.answer + 1) % 4, t);
    t += FEEDBACK_MS;
  }
  return last!;
}

beforeEach(() => setStorage(new MemoryStorage()));

describe('arena questions', () => {
  it('gives the same ten valid questions for the same seed', () => {
    for (const topic of ['mixed', 'math', 'science', 'general'] as const) {
      for (let i = 0; i < 40; i++) {
        const a = questionsFor(`seed${i}`, topic);
        expect(a).toHaveLength(10);
        expect(questionsFor(`seed${i}`, topic)).toEqual(a);
        for (const q of a) {
          expect(new Set(q.choices).size).toBe(4);
          expect(q.answer).toBeGreaterThanOrEqual(0);
          expect(q.answer).toBeLessThan(4);
          if (topic !== 'mixed') expect(q.topic).toBe(topic);
        }
        expect(new Set(a.map((q) => q.prompt)).size).toBe(10);
      }
    }
  });

  it('computes math answers correctly', () => {
    for (let i = 0; i < 200; i++) {
      for (const q of questionsFor(`m${i}`, 'math')) {
        const mul = /^(\d+) × (\d+) = \?$/.exec(q.prompt);
        if (mul) expect(q.choices[q.answer]).toBe(String(Number(mul[1]) * Number(mul[2])));
        const lin = /^Solve for x: (\d+)x \+ (\d+) = (-?\d+)$/.exec(q.prompt);
        if (lin) expect(q.choices[q.answer]).toBe(String((Number(lin[3]) - Number(lin[2])) / Number(lin[1])));
        const pct = /^What is (\d+)% of (\d+)\?$/.exec(q.prompt);
        if (pct) expect(q.choices[q.answer]).toBe(String((Number(pct[1]) * Number(pct[2])) / 100));
      }
    }
  });

  it('scores speed and ratings sensibly', () => {
    expect(pointsFor(true, 0)).toBe(150);
    expect(pointsFor(true, 15000)).toBe(100);
    expect(pointsFor(false, 100)).toBe(0);
    expect(eloChange(1000, 1000, 1)).toBe(16);
    expect(eloChange(1000, 1000, 0)).toBe(-16);
    expect(tierOf(1000).name).toBe('Bronze');
    expect(tierOf(1250).name).toBe('Gold');
    expect(tierOf(1600).next).toBeNull();
  });
});

describe('arena matches', () => {
  it('plays the daily once and ranks it', async () => {
    const a = await person('Ana');
    const now = Date.now();
    const run = await startRun(a, { mode: 'daily' }, now);
    expect(run.question?.choices).toHaveLength(4);
    const seed = { seed: `daily:${(await arenaHome(a, now)).daily.date}`, topic: 'mixed' as const };
    const last = await play(a, run.id, seed, true, now);
    expect(last.run.result?.correct).toBe(10);
    expect(last.run.result?.score).toBeGreaterThan(1000);
    expect(last.run.result?.dailyRank).toBe(1);
    const again = await startRun(a, { mode: 'daily' }, now + 60_000);
    expect(again.id).toBe(run.id);
    const home = await arenaHome(a, now + 60_000);
    expect(home.daily.played).toBe(true);
    expect(home.me.weekPoints).toBe(last.run.result?.pointsEarned);
  });

  it('counts a late answer as wrong', async () => {
    const a = await person('Ben');
    const now = Date.now();
    const run = await startRun(a, { mode: 'quick' }, now);
    expect(run.opponent?.kind).toBe('bot');
    const res = await answer(a, run.id, 0, now + 600 + 20_000);
    expect(res.ok).toBe(false);
    expect(res.pts).toBe(0);
  });

  it('settles a duel and moves both ratings', async () => {
    const a = await person('Cam');
    const b = await person('Dee');
    await follow(a, b.id, true);
    const now = Date.now();
    const home0 = await arenaHome(a, now);
    expect(home0.friends.map((f) => f.name)).toContain('Dee');

    const first = await startRun(a, { mode: 'duel', to: b.id, topic: 'science' }, now);
    // Find the seed from a stored run: replay with the question view until done.
    const { getStorage } = await import('@/lib/server/storage');
    const stored = (await getStorage().get<{ seed: string; topic: 'science'; duelId: string }>(`ar:run:${first.id}`))!;
    const r1 = await play(a, first.id, stored, true, now);
    expect(r1.run.result?.outcome).toBe('pending');

    const inbox = (await arenaHome(b, now)).inbox;
    expect(inbox).toHaveLength(1);
    const second = await startRun(b, { mode: 'accept', duelId: inbox[0].id }, now + 1000);
    expect(second.opponent?.timeline).toHaveLength(10);
    const r2 = await play(b, second.id, stored, false, now + 1000);
    expect(r2.run.result?.outcome).toBe('loss');
    expect(r2.run.result!.ratingAfter).toBeLessThan(1000);

    const homeA = await arenaHome(a, now + 99_000);
    expect(homeA.me.rating).toBeGreaterThan(1000);
    expect(homeA.results[0].won).toBe(true);
    expect((await arenaHome(b, now + 99_000)).inbox).toHaveLength(0);
    const board = await arenaBoard(a, 'all', 'rating');
    expect(board[0].name).toBe('Cam');
  });

  it('lets you decline a challenge and uses earlier runs as opponents', async () => {
    const a = await person('Eli');
    const b = await person('Fay');
    const now = Date.now();
    const q = await startRun(a, { mode: 'quick' }, now);
    const { getStorage } = await import('@/lib/server/storage');
    const stored = (await getStorage().get<{ seed: string; topic: 'mixed' }>(`ar:run:${q.id}`))!;
    await play(a, q.id, stored, true, now);
    const vs = await startRun(b, { mode: 'quick' }, now + 5000);
    expect(vs.opponent?.kind).toBe('ghost');
    expect(vs.opponent?.name).toBe('Eli');

    const d = await startRun(a, { mode: 'duel', to: b.id }, now);
    const ds = (await getStorage().get<{ seed: string; topic: 'mixed' }>(`ar:run:${d.id}`))!;
    await play(a, d.id, ds, true, now);
    const inbox = (await arenaHome(b, now)).inbox;
    await declineDuel(b, inbox[0].id);
    expect((await arenaHome(b, now)).inbox).toHaveLength(0);
  });
});
