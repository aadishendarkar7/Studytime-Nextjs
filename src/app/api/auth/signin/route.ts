import { z } from 'zod';
import { normEmail, publicAccount, sessionCookie, signIn, withCookies } from '@/lib/server/accounts';
import { clientIp, handle, readJson } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';

const schema = z.object({ email: z.string().trim().max(200), password: z.string().max(200) });

export const POST = handle(async (request: Request) => {
  const body = await readJson(request, schema);
  await rateLimit('signin', `${clientIp(request)}:${normEmail(body.email)}`, 10, 900, 'Too many tries. Wait 15 minutes and try again.');
  const account = await signIn(body.email, body.password);
  return withCookies({ user: publicAccount(account) }, [sessionCookie(request, account.id)]);
});
