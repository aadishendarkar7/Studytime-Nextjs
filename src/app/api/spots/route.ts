import { connection } from 'next/server';
import { clientIp, handle, json, readJson } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { listSpots, shareSpot } from '@/lib/server/services/spots';
import { spotSchema } from '@/lib/server/validation';

export const GET = handle(async () => {
  await connection();
  return json({ spots: await listSpots() });
});

export const POST = handle(async (request: Request) => {
  await rateLimit('spots-share', clientIp(request), 20, 3600, 'Too many spots shared. Try again later.');
  return json(await shareSpot(await readJson(request, spotSchema)), 201);
});
