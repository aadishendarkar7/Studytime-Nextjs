import { z } from 'zod';
import { handle, json, readJson } from '@/lib/server/http';
import { answerClass, authorize } from '@/lib/server/services/classes';
import { classCode } from '@/lib/server/validation';

export const POST = handle(async (request: Request, ctx: RouteContext<'/api/classes/[code]/answer'>) => {
  const code = classCode.parse((await ctx.params).code.toUpperCase());
  const { room, token } = await authorize(code, request.headers.get('x-class-token'));
  const { choice } = await readJson(request, z.object({ choice: z.string().max(200) }));
  return json(await answerClass(room, token, choice));
});
