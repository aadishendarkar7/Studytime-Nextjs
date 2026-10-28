import { connection } from 'next/server';
import { clientIp, handle, json } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { inviteCard } from '@/lib/server/services/feed';

export const GET = handle(async (request: Request, ctx: RouteContext<'/api/invite/[id]'>) => {
  await connection();
  await rateLimit('invite-card', clientIp(request), 60, 3600, 'Too many requests.');
  return json(await inviteCard((await ctx.params).id));
});
