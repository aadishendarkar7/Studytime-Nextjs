import { z } from 'zod';
import { clientIp, handle, json, readJson } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { roomCode, roomMember } from '@/lib/server/room-params';
import { sendKudos } from '@/lib/server/services/rooms';

export const POST = handle(async (request: Request, ctx: RouteContext<'/api/rooms/[code]/kudos'>) => {
  await rateLimit('rooms-kudos', clientIp(request), 60, 3600, 'That is a lot of kudos. Try again later.');
  const c = roomCode.parse((await ctx.params).code);
  const body = await readJson(request, z.object({ memberId: roomMember, to: z.string().regex(/^[a-f0-9]{16}$/) }));
  return json(await sendKudos(c, body.memberId, body.to));
});
