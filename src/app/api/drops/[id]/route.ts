import { z } from 'zod';
import { clientIp, handle, json, readJson } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { endDrop, extendDrop, getDrop } from '@/lib/server/services/drops';

type Ctx = RouteContext<'/api/drops/[id]'>;
const dropId = z.string().regex(/^[a-f0-9]{12}$/, 'Drop not found');

export const PATCH = handle(async (request: Request, ctx: Ctx) => {
  const { endsAt } = await readJson(request, z.object({ endsAt: z.number() }));
  return json(await extendDrop(dropId.parse((await ctx.params).id), request.headers.get('x-drop-token'), endsAt));
});

export const DELETE = handle(async (request: Request, ctx: Ctx) => json(await endDrop(dropId.parse((await ctx.params).id), request.headers.get('x-drop-token'))));

export const GET = handle(async (request: Request, ctx: Ctx) => {
  await rateLimit('drops-get', clientIp(request), 120, 60, 'Too many requests. Wait a minute.');
  return json({ drop: await getDrop(dropId.parse((await ctx.params).id)) });
});
