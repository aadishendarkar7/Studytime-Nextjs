import { z } from 'zod';
import { createAccount, publicAccount, sessionCookie, withCookies } from '@/lib/server/accounts';
import { clientIp, handle, readJson } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';

const schema = z.object({
  name: z.string().trim().min(1, 'Add your name').max(40),
  email: z.string().trim().email('Enter a valid email').max(200),
  password: z.string().min(8, 'Use at least 8 characters for your password').max(200),
});

export const POST = handle(async (request: Request) => {
  await rateLimit('signup', clientIp(request), 8, 3600, 'Too many new accounts from this network. Try again in an hour.');
  const body = await readJson(request, schema);
  const account = await createAccount(body);
  return withCookies({ user: publicAccount(account) }, [sessionCookie(request, account.id)], 201);
});
