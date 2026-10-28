import { clientIp, handle, json, readJson } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { heartbeat } from '@/lib/server/services/chat';
import { presenceSchema } from '@/lib/server/validation';

export const PUT = handle(async (request: Request) => {
  await rateLimit('chat-presence', clientIp(request), 60, 60, 'Slow down.');
  return json(await heartbeat(request.headers.get('x-chat-token'), await readJson(request, presenceSchema)));
});
