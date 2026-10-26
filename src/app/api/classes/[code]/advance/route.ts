import { handle, json } from '@/lib/server/http';
import { advanceClass, authorize } from '@/lib/server/services/classes';
import { classCode } from '@/lib/server/validation';

export const POST = handle(async (request: Request, ctx: RouteContext<'/api/classes/[code]/advance'>) => {
  const code = classCode.parse((await ctx.params).code.toUpperCase());
  const { room, token } = await authorize(code, request.headers.get('x-class-token'));
  return json(await advanceClass(room, token));
});
