import { requireAccount } from '@/lib/server/accounts';
import { handle, json } from '@/lib/server/http';
import { deletePost } from '@/lib/server/services/feed';

export const DELETE = handle(async (request: Request, ctx: RouteContext<'/api/feed/[id]'>) => {
  const me = await requireAccount(request);
  await deletePost(me, (await ctx.params).id);
  return json({ ok: true });
});
