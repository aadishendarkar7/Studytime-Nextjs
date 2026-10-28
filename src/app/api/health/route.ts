import { connection } from 'next/server';
import { emailReady } from '@/lib/server/email';
import { defaultServerProvider, serverProviders } from '@/lib/server/ai';
import { json } from '@/lib/server/http';
import { storageKind } from '@/lib/server/storage';

/**
 * Setup check for the site owner. Open /api/health after deploying: every line should say ok.
 * It shows only yes/no answers, never keys or secrets.
 */
export async function GET() {
  await connection();
  const storage = storageKind();
  const ai = serverProviders();
  const checks = {
    database: storage === 'redis' ? 'ok: Upstash Redis connected' : storage === 'file' ? 'ok for your own computer (data saved in .data)' : 'MISSING: connect Upstash Redis in Vercel, then redeploy. Without it accounts disappear.',
    signIn: process.env.AUTH_SECRET?.trim() ? 'ok' : process.env.NODE_ENV === 'production' ? 'MISSING: add AUTH_SECRET, then redeploy' : 'ok (local test secret)',
    ai: ai.length ? `ok: ${ai.join(', ')} (default ${defaultServerProvider()})` : 'MISSING: add GEMINI_API_KEY, then redeploy. Without it the AI tutor only works for people who add their own key.',
    email: emailReady() ? 'ok' : 'off (optional): add RESEND_API_KEY and EMAIL_FROM for password reset and weekly recaps',
    googleSignIn: process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? 'ok' : 'off (optional)',
  };
  const ready = !Object.values(checks).some((v) => v.startsWith('MISSING'));
  return json({ ready, ...checks });
}
