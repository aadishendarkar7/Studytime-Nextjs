import { z } from 'zod';
import { handle, json, readJson } from '@/lib/server/http';
import { setClassMinutes } from '@/lib/server/services/classes';
import { classCode, minutesSchema } from '@/lib/server/validation';

export const PUT = handle(async (request: Request, ctx: RouteContext<'/api/classes/[code]/progress'>) => {
  const code = classCode.parse((await ctx.params).code.toUpperCase());
  const { minutes } = await readJson(request, z.object({ minutes: minutesSchema }));
  await setClassMinutes(code, request.headers.get('x-class-token') || '', minutes);
  return json({ ok: true });
});
