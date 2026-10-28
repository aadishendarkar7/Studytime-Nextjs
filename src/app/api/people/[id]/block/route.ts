import { requireAccount } from '@/lib/server/accounts';
import { handle, json } from '@/lib/server/http';
import { block } from '@/lib/server/services/feed';

const run = (on: boolean) =>
  handle(async (request: Request, ctx: RouteContext<'/api/people/[id]/block'>) => {
    const me = await requireAccount(request);
    await block(me, (await ctx.params).id, on);
    return json({ ok: true });
  });

export const POST = run(true);
export const DELETE = run(false);
