import { connection } from 'next/server';
import { requireAccount } from '@/lib/server/accounts';
import { handle, json } from '@/lib/server/http';
import { getPerson } from '@/lib/server/services/feed';

export const GET = handle(async (request: Request, ctx: RouteContext<'/api/people/[id]'>) => {
  await connection();
  const me = await requireAccount(request);
  return json(await getPerson(me, (await ctx.params).id));
});
