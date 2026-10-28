import { z } from 'zod';
import { handle, json } from '@/lib/server/http';
import { removeMessage } from '@/lib/server/services/chat';

type Ctx = RouteContext<'/api/chat/channels/[id]/messages/[mid]'>;

export const DELETE = handle(async (request: Request, ctx: Ctx) => {
  const { id, mid } = await ctx.params;
  return json(await removeMessage(request.headers.get('x-chat-token'), id, z.string().regex(/^[a-f0-9]{12}$/).parse(mid)));
});
