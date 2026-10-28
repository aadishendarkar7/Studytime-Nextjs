import { z } from 'zod';
import { clientIp, handle, json, readJson } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { postMessage } from '@/lib/server/services/drops';
import { nameSchema } from '@/lib/server/validation';

type Ctx = RouteContext<'/api/drops/[id]/messages'>;
const dropId = z.string().regex(/^[a-f0-9]{12}$/, 'Drop not found');
const body = z.object({
  name: nameSchema,
  text: z.string().transform((v) => v.replace(/\s+/g, ' ').trim().slice(0, 280)).refine((v) => v.length > 0, 'Write a message first'),
});

export const POST = handle(async (request: Request, ctx: Ctx) => {
  await rateLimit('drops-message', clientIp(request), 40, 600, 'Too many messages. Slow down a little.');
  const { name, text } = await readJson(request, body);
  return json(await postMessage(dropId.parse((await ctx.params).id), name, text, request.headers.get('x-drop-token')), 201);
});
