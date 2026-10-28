import { z } from 'zod';
import { clientIp, handle, json, readJson } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { roomCode } from '@/lib/server/room-params';
import { joinRoom } from '@/lib/server/services/rooms';
import { nameSchema } from '@/lib/server/validation';

export const POST = handle(async (request: Request, ctx: RouteContext<'/api/rooms/[code]/join'>) => {
  await rateLimit('rooms-join', clientIp(request), 30, 3600, 'Too many joins. Try again later.');
  const c = roomCode.parse((await ctx.params).code);
  const { name } = await readJson(request, z.object({ name: nameSchema }));
  return json(await joinRoom(c, name));
});
