import { z } from 'zod';
import { handle, json } from '@/lib/server/http';
import { removeSpot } from '@/lib/server/services/spots';

export const DELETE = handle(async (request: Request, ctx: RouteContext<'/api/spots/[id]'>) => {
  const id = z.string().regex(/^[a-f0-9]{12}$/, 'Spot not found').parse((await ctx.params).id);
  return json(await removeSpot(id, request.headers.get('x-spot-token')));
});
