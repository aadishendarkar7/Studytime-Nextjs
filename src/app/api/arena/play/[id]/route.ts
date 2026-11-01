import { z } from 'zod';
import { requireAccount } from '@/lib/server/accounts';
import { handle, json, readJson } from '@/lib/server/http';
import { answer } from '@/lib/server/services/arena';

const schema = z.object({ choice: z.number().int().min(-1).max(3) });

export const POST = handle(async (request: Request, ctx: RouteContext<'/api/arena/play/[id]'>) => {
  const me = await requireAccount(request);
  const { choice } = await readJson(request, schema);
  return json(await answer(me, (await ctx.params).id, choice));
});
