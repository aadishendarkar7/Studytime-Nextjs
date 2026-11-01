import { z } from 'zod';
import { requireAccount } from '@/lib/server/accounts';
import { handle, json, readJson } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { startRun } from '@/lib/server/services/arena';

const schema = z.object({
  mode: z.enum(['daily', 'quick', 'duel', 'accept']),
  topic: z.enum(['mixed', 'math', 'science', 'general']).optional(),
  to: z.string().max(60).optional(),
  duelId: z.string().max(40).optional(),
});

export const POST = handle(async (request: Request) => {
  const me = await requireAccount(request);
  await rateLimit('arena-start', me.id, 30, 3600, 'That is a lot of matches. Take a break and come back in a bit.');
  return json({ run: await startRun(me, await readJson(request, schema)) }, 201);
});
