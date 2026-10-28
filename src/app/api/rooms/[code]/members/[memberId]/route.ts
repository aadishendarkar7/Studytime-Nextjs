import { z } from 'zod';
import { clientIp, handle, json, readJson } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { roomCode, roomMember } from '@/lib/server/room-params';
import { heartbeat, leaveRoom } from '@/lib/server/services/rooms';
import { minutesSchema, nameSchema } from '@/lib/server/validation';

type Ctx = RouteContext<'/api/rooms/[code]/members/[memberId]'>;

export const PUT = handle(async (request: Request, ctx: Ctx) => {
  await rateLimit('rooms-beat', clientIp(request), 40, 60, 'Too many updates. Slow down.');
  const p = await ctx.params;
  const body = await readJson(
    request,
    z.object({
      name: nameSchema,
      status: z.enum(['focusing', 'break', 'idle']),
      subject: z.string().optional().transform((v) => (v || '').trim().slice(0, 60)),
      endsAt: z.number().nullable(),
      weekMinutes: minutesSchema,
      weeklyGoal: minutesSchema,
      since: z.number().catch(0),
    }),
  );
  const { since, ...update } = body;
  return json(await heartbeat(roomCode.parse(p.code), roomMember.parse(p.memberId), update, since));
});

export const DELETE = handle(async (_request: Request, ctx: Ctx) => {
  const p = await ctx.params;
  return json(await leaveRoom(roomCode.parse(p.code), roomMember.parse(p.memberId)));
});
