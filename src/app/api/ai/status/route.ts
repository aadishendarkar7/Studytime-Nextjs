import { connection } from 'next/server';
import { defaultServerProvider, serverProviders } from '@/lib/server/ai';
import { json } from '@/lib/server/http';
import type { AiStatus } from '@/lib/ai/providers';

export async function GET() {
  await connection(); // read env at request time, not build time
  const status: AiStatus = { serverProviders: serverProviders(), defaultProvider: defaultServerProvider(), requiresAccessCode: Boolean(process.env.AI_ACCESS_CODE) };
  return json(status);
}
