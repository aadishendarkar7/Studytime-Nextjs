import { connection } from 'next/server';
import { allowedDomains, publicAccount, requireAccount } from '@/lib/server/accounts';
import { emailReady } from '@/lib/server/email';
import { handle, json } from '@/lib/server/http';

/** Who is signed in, and which sign-in options this site offers. */
export const GET = handle(async (request: Request) => {
  await connection();
  const account = await requireAccount(request).catch(() => null);
  return json({ user: account ? publicAccount(account) : null, google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET), email: emailReady(), domains: allowedDomains() });
});
