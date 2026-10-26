import { z } from 'zod';
import { clientIp, handle, json, readJson } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { createCircle } from '@/lib/server/services/circles';
import { nameSchema } from '@/lib/server/validation';

export const POST = handle(async (request: Request) => {
  await rateLimit('circle-create', clientIp(request), 20, 3600, 'Too many circles created. Try again later.');
  const { name } = await readJson(request, z.object({ name: nameSchema }));
  return json(await createCircle(name), 201);
});
