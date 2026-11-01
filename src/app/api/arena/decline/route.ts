import { z } from 'zod';
import { requireAccount } from '@/lib/server/accounts';
import { handle, json, readJson } from '@/lib/server/http';
import { declineDuel } from '@/lib/server/services/arena';

export const POST = handle(async (request: Request) => {
  const me = await requireAccount(request);
  const { duelId } = await readJson(request, z.object({ duelId: z.string().max(40) }));
  await declineDuel(me, duelId);
  return json({ ok: true });
});
