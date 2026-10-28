import { connection } from 'next/server';
import { allowedDomains, getAccount, publicAccount, sessionUserId } from '@/lib/server/accounts';
import { handle, json } from '@/lib/server/http';

/** Who is signed in, and which sign-in options this site offers. */
export const GET = handle(async (request: Request) => {
  await connection();
  const id = sessionUserId(request);
  const account = id ? await getAccount(id) : null;
  return json({ user: account ? publicAccount(account) : null, google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET), domains: allowedDomains() });
});
