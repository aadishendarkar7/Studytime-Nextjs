import { z } from 'zod';
import { clientIp, handle, json, readJson } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { joinPact } from '@/lib/server/services/pacts';
import { nameSchema } from '@/lib/server/validation';

type Ctx = RouteContext<'/api/pacts/[code]/join'>;

export const POST = handle(async (request: Request, ctx: Ctx) => {
  await rateLimit('pact-join', clientIp(request), 20, 3600, 'Too many tries. Try again later.');
  const { name } = await readJson(request, z.object({ name: nameSchema }));
  return json(await joinPact(z.string().regex(/^[A-F0-9]{6}$/i, 'Codes are 6 letters and numbers').parse((await ctx.params).code), name));
});
