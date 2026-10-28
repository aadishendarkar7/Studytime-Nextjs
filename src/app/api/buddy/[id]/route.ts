import { z } from 'zod';
import { clientIp, handle, json, readJson } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { poll, setStatus } from '@/lib/server/services/buddy';

type Ctx = RouteContext<'/api/buddy/[id]'>;
const id = z.string().regex(/^[a-f0-9]{12}$/, 'Session not found');

export const GET = handle(async (request: Request, ctx: Ctx) => {
  await rateLimit('buddy-poll', clientIp(request), 120, 60, 'Slow down.');
  return json(await poll(id.parse((await ctx.params).id), request.headers.get('x-buddy-token')));
});

export const PATCH = handle(async (request: Request, ctx: Ctx) => {
  const { status } = await readJson(request, z.object({ status: z.enum(['done', 'left']) }));
  return json(await setStatus(id.parse((await ctx.params).id), request.headers.get('x-buddy-token'), status));
});
