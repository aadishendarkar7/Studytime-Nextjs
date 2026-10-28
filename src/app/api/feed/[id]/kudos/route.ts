import { requireAccount } from '@/lib/server/accounts';
import { handle, json } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { toggleKudos } from '@/lib/server/services/feed';

export const POST = handle(async (request: Request, ctx: RouteContext<'/api/feed/[id]/kudos'>) => {
  const me = await requireAccount(request);
  await rateLimit('kudos', me.id, 120, 3600, 'Slow down a little.');
  return json({ post: await toggleKudos(me, (await ctx.params).id) });
});
