import { z } from 'zod';
import { clientIp, handle, json, readJson } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { joinClass } from '@/lib/server/services/classes';
import { classCode, nameSchema } from '@/lib/server/validation';

export const POST = handle(async (request: Request, ctx: RouteContext<'/api/classes/[code]/join'>) => {
  await rateLimit('class-join', clientIp(request), 60, 3600, 'Too many join attempts. Try again later.');
  const code = classCode.parse((await ctx.params).code.toUpperCase());
  const { name } = await readJson(request, z.object({ name: nameSchema }));
  return json(await joinClass(code, name), 201);
});
