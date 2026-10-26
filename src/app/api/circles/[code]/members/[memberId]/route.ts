import { z } from 'zod';
import { handle, json, readJson } from '@/lib/server/http';
import { updateCircleMember } from '@/lib/server/services/circles';
import { circleCode, minutesSchema, nameSchema } from '@/lib/server/validation';

export const PUT = handle(async (request: Request, ctx: RouteContext<'/api/circles/[code]/members/[memberId]'>) => {
  const { code, memberId } = await ctx.params;
  const c = circleCode.parse(code.toUpperCase());
  const id = z.string().regex(/^[a-f0-9]{32}$/, 'Circle member not found').parse(memberId);
  const body = await readJson(request, z.object({ name: nameSchema, minutes: minutesSchema, streak: minutesSchema }));
  return json(await updateCircleMember(c, id, body));
});
