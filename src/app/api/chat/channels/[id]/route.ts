import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { clientIp, handle, json, readJson } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { messages, post } from '@/lib/server/services/chat';
import { chatTextSchema } from '@/lib/server/validation';

type Ctx = RouteContext<'/api/chat/channels/[id]'>;

export const GET = handle(async (request: NextRequest, ctx: Ctx) => {
  await rateLimit('chat-read', clientIp(request), 240, 60, 'Slow down.');
  const after = Number(request.nextUrl.searchParams.get('after') || 0);
  return json(await messages(request.headers.get('x-chat-token'), (await ctx.params).id, Number.isFinite(after) ? after : 0));
});

export const POST = handle(async (request: Request, ctx: Ctx) => {
  await rateLimit('chat-post', clientIp(request), 20, 60, 'You are sending messages too fast. Wait a few seconds.');
  const { text } = await readJson(request, z.object({ text: chatTextSchema }));
  return json(await post(request.headers.get('x-chat-token'), (await ctx.params).id, text), 201);
});
