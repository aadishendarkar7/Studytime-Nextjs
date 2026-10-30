import { connection } from 'next/server';
import { emailReady } from '@/lib/server/email';
import { defaultServerProvider, serverKeyName, serverProviders } from '@/lib/server/ai';
import { json } from '@/lib/server/http';
import { storageKind } from '@/lib/server/storage';
import { authSecret } from '@/lib/session-token';

/**
 * Setup check for the site owner. Open /api/health after deploying: every line should say ok.
 * It shows only yes/no answers and setting names, never keys or secrets.
 */
export async function GET() {
  await connection();
  const storage = storageKind();
  const ai = serverProviders();
  const checks = {
    ai: ai.length ? `ok: ${ai.map((p) => `${p} (from ${serverKeyName(p)})`).join(', ')}, default ${defaultServerProvider()}` : 'MISSING: add GEMINI_API_KEY in Vercel → Settings → Environment Variables (tick Production), then redeploy.',
    database: storage === 'redis' ? 'ok: Redis connected' : storage === 'file' ? 'ok for your own computer (data saved in .data)' : 'MISSING: connect your Redis database to this project in Vercel (Storage), then redeploy. Without it accounts cannot be saved; everything else still works.',
    signIn: authSecret() ? 'ok' : 'waiting for the database (or add AUTH_SECRET)',
    email: emailReady() ? 'ok' : 'off (optional): add RESEND_API_KEY and EMAIL_FROM for password reset emails',
    googleSignIn: process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? 'ok' : 'off (optional)',
  };
  // Names only, so a key saved under the wrong name is easy to spot.
  const settingsSeen = Object.keys(process.env).filter((k) => /GEMINI|GOOGLE|GROQ|OPENROUTER|ANTHROPIC|REDIS|KV_|UPSTASH|AUTH_SECRET|RESEND|STORAGE/i.test(k)).sort();
  const ready = !Object.values(checks).some((v) => v.startsWith('MISSING'));
  // Which commit is live, so it is easy to tell whether the latest push has deployed.
  const version = process.env.VERCEL_GIT_COMMIT_MESSAGE ? `${process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7)} ${process.env.VERCEL_GIT_COMMIT_MESSAGE.split('\n')[0]}` : 'local';
  return json({ ready, version, ...checks, settingsSeen });
}
