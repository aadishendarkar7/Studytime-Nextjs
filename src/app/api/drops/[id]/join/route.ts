import { z } from 'zod';
import { clientIp, handle, json, readJson } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { joinDrop, leaveDrop, setJoinStatus } from '@/lib/server/services/drops';
import { nameSchema } from '@/lib/server/validation';

type Ctx = RouteContext<'/api/drops/[id]/join'>;
const dropId = z.string().regex(/^[a-f0-9]{12}$/, 'Drop not found');

export const POST = handle(async (request: Request, ctx: Ctx) => {
  await rateLimit('drops-join', clientIp(request), 60, 3600, 'Too many joins. Try again later.');
  const { name } = await readJson(request, z.object({ name: nameSchema }));
  return json(await joinDrop(dropId.parse((await ctx.params).id), name));
});

export const DELETE = handle(async (request: Request, ctx: Ctx) => {
  const { joinerId } = await readJson(request, z.object({ joinerId: z.string().regex(/^[a-f0-9]{8}$/) }));
  return json(await leaveDrop(dropId.parse((await ctx.params).id), joinerId, request.headers.get('x-join-token')));
});

export const PATCH = handle(async (request: Request, ctx: Ctx) => {
  const { joinerId, status } = await readJson(request, z.object({ joinerId: z.string().regex(/^[a-f0-9]{8}$/), status: z.enum(['coming', 'here']) }));
  return json(await setJoinStatus(dropId.parse((await ctx.params).id), joinerId, request.headers.get('x-join-token'), status));
});
