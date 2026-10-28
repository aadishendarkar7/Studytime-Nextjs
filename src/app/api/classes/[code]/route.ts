import { connection } from 'next/server';
import { requireAccount } from '@/lib/server/accounts';
import { handle, json } from '@/lib/server/http';
import { classPage } from '@/lib/server/services/feed';

export const GET = handle(async (request: Request, ctx: RouteContext<'/api/classes/[code]'>) => {
  await connection();
  const me = await requireAccount(request);
  return json(await classPage(me, decodeURIComponent((await ctx.params).code).slice(0, 30)));
});
