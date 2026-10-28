import { connection } from 'next/server';
import { renderFeed } from '@/lib/server/services/calendar';

/** The .ics file Google, Apple and Outlook calendars subscribe to. */
export async function GET(_request: Request, ctx: RouteContext<'/api/calendar/feed/[token]'>) {
  await connection();
  const token = (await ctx.params).token.replace(/\.ics$/, '');
  const body = await renderFeed(token);
  if (!body) return new Response('Calendar not found', { status: 404 });
  return new Response(body, { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Disposition': 'inline; filename="studytime.ics"' } });
}
