import { z } from 'zod';
import { clientIp, handle, json, readJson } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { createRoom } from '@/lib/server/services/rooms';
import { nameSchema } from '@/lib/server/validation';

export const POST = handle(async (request: Request) => {
  await rateLimit('rooms-create', clientIp(request), 10, 3600, 'Too many rooms created. Try again later.');
  const body = await readJson(request, z.object({ room: z.string().optional().transform((v) => (v || '').trim().slice(0, 40) || 'Study room'), name: nameSchema }));
  return json(await createRoom(body.room, body.name), 201);
});
