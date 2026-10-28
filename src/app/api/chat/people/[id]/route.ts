import { z } from 'zod';
import { handle, json } from '@/lib/server/http';
import { person } from '@/lib/server/services/chat';

type Ctx = RouteContext<'/api/chat/people/[id]'>;

export const GET = handle(async (request: Request, ctx: Ctx) => json(await person(request.headers.get('x-chat-token'), z.string().regex(/^[a-f0-9]{16}$/, 'Student not found').parse((await ctx.params).id))));
