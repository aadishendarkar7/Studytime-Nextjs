import { z } from 'zod';
import { publicAccount, sessionCookie, setPassword, consumeResetToken, withCookies } from '@/lib/server/accounts';
import { clientIp, handle, readJson } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';

export const POST = handle(async (request: Request) => {
  await rateLimit('reset', clientIp(request), 10, 3600, 'Too many tries. Try again later.');
  const { token, password } = await readJson(request, z.object({ token: z.string().min(10).max(100), password: z.string().min(8, 'Use at least 8 characters').max(200) }));
  const account = await setPassword(await consumeResetToken(token), password);
  return withCookies({ user: publicAccount(account) }, [sessionCookie(request, account.id, account.sv ?? 0)]);
});
