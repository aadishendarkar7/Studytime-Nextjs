import { z } from 'zod';
import { handle, json } from '@/lib/server/http';
import { deleteEvent } from '@/lib/server/services/events';

type Ctx = RouteContext<'/api/events/[id]'>;

export const DELETE = handle(async (request: Request, ctx: Ctx) => json(await deleteEvent(z.string().regex(/^[a-f0-9]{12}$/, 'Event not found').parse((await ctx.params).id), request.headers.get('x-event-token'))));
