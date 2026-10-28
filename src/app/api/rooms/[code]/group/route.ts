import { z } from 'zod';
import { handle, json, readJson } from '@/lib/server/http';
import { roomCode, roomMember } from '@/lib/server/room-params';
import { startGroup } from '@/lib/server/services/rooms';

export const POST = handle(async (request: Request, ctx: RouteContext<'/api/rooms/[code]/group'>) => {
  const c = roomCode.parse((await ctx.params).code);
  const body = await readJson(request, z.object({ memberId: roomMember, minutes: z.union([z.literal(15), z.literal(30), z.literal(60), z.literal(90)]) }));
  return json(await startGroup(c, body.memberId, body.minutes));
});
