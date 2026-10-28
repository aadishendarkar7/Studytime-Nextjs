import { clientIp, handle, json } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { register } from '@/lib/server/services/chat';

export const POST = handle(async (request: Request) => {
  await rateLimit('chat-register', clientIp(request), 10, 3600, 'Too many new chat profiles. Try again later.');
  return json(await register(), 201);
});
