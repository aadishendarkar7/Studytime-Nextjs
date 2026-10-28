import { z } from 'zod';
import { clientIp, handle, json, readJson } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { leavePact, reportPact } from '@/lib/server/services/pacts';
import { minutesSchema, nameSchema, pactGoalSchema } from '@/lib/server/validation';

type Ctx = RouteContext<'/api/pacts/[code]'>;
const code = z.string().regex(/^[A-F0-9]{6}$/i, 'Pact not found');

export const PUT = handle(async (request: Request, ctx: Ctx) => {
  await rateLimit('pact-update', clientIp(request), 60, 60, 'Slow down.');
  const b = await readJson(request, z.object({ memberId: z.string().regex(/^[a-f0-9]{8}$/), name: nameSchema, minutes: minutesSchema, goal: pactGoalSchema.optional() }));
  return json(await reportPact(code.parse((await ctx.params).code), b.memberId, request.headers.get('x-pact-token'), b));
});

export const DELETE = handle(async (request: Request, ctx: Ctx) => {
  const { memberId } = await readJson(request, z.object({ memberId: z.string().regex(/^[a-f0-9]{8}$/) }));
  return json(await leavePact(code.parse((await ctx.params).code), memberId, request.headers.get('x-pact-token')));
});
