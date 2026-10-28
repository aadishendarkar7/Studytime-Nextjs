import { z } from 'zod';
import { clientIp, handle, json, readJson } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { cancelRsvp, rsvp } from '@/lib/server/services/events';
import { nameSchema } from '@/lib/server/validation';

type Ctx = RouteContext<'/api/events/[id]/rsvp'>;
const id = z.string().regex(/^[a-f0-9]{12}$/, 'Event not found');

export const POST = handle(async (request: Request, ctx: Ctx) => {
  await rateLimit('events-rsvp', clientIp(request), 60, 3600, 'Too many RSVPs. Try again later.');
  const { name } = await readJson(request, z.object({ name: nameSchema }));
  return json(await rsvp(id.parse((await ctx.params).id), name));
});

export const DELETE = handle(async (request: Request, ctx: Ctx) => {
  const { rsvpId } = await readJson(request, z.object({ rsvpId: z.string().regex(/^[a-f0-9]{8}$/) }));
  return json(await cancelRsvp(id.parse((await ctx.params).id), rsvpId, request.headers.get('x-rsvp-token')));
});
