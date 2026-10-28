import { z } from 'zod';
import { clientIp, handle, json, readJson } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { report } from '@/lib/server/services/chat';

export const POST = handle(async (request: Request) => {
  await rateLimit('chat-report', clientIp(request), 20, 3600, 'Too many reports. Try again later.');
  const b = await readJson(request, z.object({ channel: z.string().max(90), messageId: z.string().regex(/^[a-f0-9]{12}$/), reason: z.string().max(200).default('') }));
  return json(await report(request.headers.get('x-chat-token'), b.channel, b.messageId, b.reason));
});
