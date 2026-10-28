import { z } from 'zod';
import { clientIp, handle, json, readJson } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { createPact } from '@/lib/server/services/pacts';
import { nameSchema, pactGoalSchema } from '@/lib/server/validation';

export const POST = handle(async (request: Request) => {
  await rateLimit('pact-create', clientIp(request), 10, 3600, 'Too many pacts. Try again later.');
  const { name, goal } = await readJson(request, z.object({ name: nameSchema, goal: pactGoalSchema }));
  return json(await createPact(name, goal), 201);
});
