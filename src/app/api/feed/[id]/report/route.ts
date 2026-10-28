import { z } from 'zod';
import { requireAccount } from '@/lib/server/accounts';
import { handle, json, readJson } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { reportPost } from '@/lib/server/services/feed';

export const POST = handle(async (request: Request, ctx: RouteContext<'/api/feed/[id]/report'>) => {
  const me = await requireAccount(request);
  await rateLimit('report', me.id, 30, 86_400, 'Too many reports today.');
  const { reason } = await readJson(request, z.object({ reason: z.enum(['spam', 'mean', 'inappropriate', 'fake', 'other']) }));
  await reportPost(me, (await ctx.params).id, reason);
  return json({ ok: true });
});
