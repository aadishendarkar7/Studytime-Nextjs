import { requireAccount } from '@/lib/server/accounts';
import { handle, json } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { follow } from '@/lib/server/services/feed';

const run = (on: boolean) =>
  handle(async (request: Request, ctx: RouteContext<'/api/people/[id]/follow'>) => {
    const me = await requireAccount(request);
    await rateLimit('follow', me.id, 100, 3600, 'Too many follows. Try again later.');
    await follow(me, (await ctx.params).id, on);
    return json({ ok: true });
  });

export const POST = run(true);
export const DELETE = run(false);
