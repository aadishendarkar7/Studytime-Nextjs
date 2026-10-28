import { connection } from 'next/server';
import { clientIp, handle, json } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { online } from '@/lib/server/services/chat';

export const GET = handle(async (request: Request) => {
  await connection();
  await rateLimit('chat-online', clientIp(request), 60, 60, 'Slow down.');
  return json(await online(request.headers.get('x-chat-token')));
});
