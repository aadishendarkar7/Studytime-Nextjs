import { connection, type NextRequest } from 'next/server';
import { clientIp, handle, json } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { inbox } from '@/lib/server/services/chat';

export const GET = handle(async (request: NextRequest) => {
  await connection();
  await rateLimit('chat-inbox', clientIp(request), 60, 60, 'Slow down.');
  const channels = (request.nextUrl.searchParams.get('ch') || '').split(',').filter(Boolean);
  return json(await inbox(request.headers.get('x-chat-token'), channels));
});
