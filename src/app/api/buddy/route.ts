import { clientIp, handle, json, readJson } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { joinQueue } from '@/lib/server/services/buddy';
import { buddySchema } from '@/lib/server/validation';

export const POST = handle(async (request: Request) => {
  await rateLimit('buddy-join', clientIp(request), 30, 3600, 'Too many buddy requests. Try again later.');
  return json(await joinQueue(await readJson(request, buddySchema)), 201);
});
