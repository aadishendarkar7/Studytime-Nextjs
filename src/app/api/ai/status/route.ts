import { connection } from 'next/server';
import { defaultServerProvider, serverProviders } from '@/lib/server/ai';
import { sessionUserId } from '@/lib/server/accounts';
import { json } from '@/lib/server/http';
import type { AiStatus } from '@/lib/ai/providers';

export async function GET(request: Request) {
  await connection(); // read env at request time, not build time
  // Signed-in students never need the access code.
  const status: AiStatus = { serverProviders: serverProviders(), defaultProvider: defaultServerProvider(), requiresAccessCode: Boolean(process.env.AI_ACCESS_CODE) && !sessionUserId(request) };
  return json(status);
}
