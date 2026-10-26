import { z } from 'zod';
import { handle, json, readJson } from '@/lib/server/http';
import { joinCircle } from '@/lib/server/services/circles';
import { circleCode, nameSchema } from '@/lib/server/validation';

export const POST = handle(async (request: Request, ctx: RouteContext<'/api/circles/[code]/join'>) => {
  const code = circleCode.parse((await ctx.params).code.toUpperCase());
  const { name } = await readJson(request, z.object({ name: nameSchema }));
  return json(await joinCircle(code, name), 201);
});
