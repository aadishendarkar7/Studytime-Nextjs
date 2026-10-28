import { z } from 'zod';
import { MODEL_PATTERN, PROVIDER_IDS, PROVIDERS, type AiRequest } from '@/lib/ai/providers';
import { clientIp, handle, HttpError, readJson } from '@/lib/server/http';
import { sessionUserId } from '@/lib/server/accounts';
import { rateLimit } from '@/lib/server/rate-limit';
import { serverKey, serverProviders, startStream } from '@/lib/server/ai';

export const maxDuration = 60;

const part = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string().max(200_000) }),
  z.object({ type: z.literal('image'), mediaType: z.string().regex(/^image\/(jpeg|png|webp|gif)$/), data: z.string() }),
  z.object({ type: z.literal('pdf'), data: z.string(), name: z.string().max(200).optional() }),
]);
const schema = z.object({
  provider: z.enum(PROVIDER_IDS as [string, ...string[]]),
  model: z.string().regex(MODEL_PATTERN, 'Invalid model name'),
  system: z.string().max(20_000).optional(),
  maxTokens: z.number().int().min(16).max(8000).optional(),
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.union([z.string().max(200_000), z.array(part).max(25)]) }))
    .min(1, 'No message to send')
    .max(40),
});

/** Busy, rate-limited or briefly down: worth trying another model. */
const busy = (e: unknown) => e instanceof HttpError && (e.status === 429 || e.status >= 500 || /high demand|overloaded|unavailable|try again later|quota|exhausted/i.test(e.message));
const retired = (e: unknown) => e instanceof HttpError && e.message.startsWith('Model not found');

/**
 * Starts a reply, and when the model is busy or retired tries the provider's
 * other models, then (with the site's own keys) the other providers this site has keys for.
 */
async function startWithFallbacks(req: AiRequest, key: string, siteKeys: boolean) {
  const hasFiles = req.messages.some((m) => Array.isArray(m.content) && m.content.some((p) => p.type !== 'text'));
  const info = PROVIDERS[req.provider];
  const attempts: { provider: AiRequest['provider']; model: string; key: string }[] = [{ provider: req.provider, model: req.model, key }];
  for (const model of [info.defaults.main, info.defaults.fast, ...info.models.map((m) => m.id)]) if (!attempts.some((a) => a.provider === req.provider && a.model === model)) attempts.push({ provider: req.provider, model, key });
  if (siteKeys)
    for (const p of serverProviders()) {
      if (p === req.provider || (hasFiles && !PROVIDERS[p].images)) continue;
      attempts.push({ provider: p, model: PROVIDERS[p].defaults.main, key: serverKey(p) });
    }
  let last: unknown;
  for (const [i, a] of attempts.slice(0, 6).entries()) {
    try {
      return await startStream({ ...req, provider: a.provider, model: a.model }, a.key);
    } catch (error) {
      last = error;
      if (!busy(error) && !retired(error)) throw error;
      if (i === 0 && busy(error)) await new Promise((r) => setTimeout(r, 700));
    }
  }
  if (busy(last)) throw new HttpError(503, 'The AI is very busy right now and every model we tried was overloaded. Wait a minute and try again.');
  throw last;
}

const env = (name: string, fallback: number) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && process.env[name] !== '' && process.env[name] !== undefined ? n : fallback;
};

/**
 * Streams a model reply as newline-delimited JSON: {"t": "text"} chunks,
 * then {"done": true}, or {"e": "message"} if the stream fails midway.
 */
export const POST = handle(async (request: Request) => {
  const body = (await readJson(request, schema, 25 * 1024 * 1024)) as AiRequest;
  const ip = clientIp(request);
  const userKey = request.headers.get('x-ai-key')?.trim() || '';
  let key = userKey;
  if (userKey) {
    await rateLimit('ai-own', ip, 60, 60, 'Too many AI requests. Wait a minute and try again.');
  } else {
    key = serverKey(body.provider);
    if (!key) throw new HttpError(503, 'No API key is set for this provider. Add your own free key in Settings → AI tutor.');
    // Signed-in students use the site's key. Without an account, only someone with the access code can.
    const userId = sessionUserId(request);
    const code = process.env.AI_ACCESS_CODE;
    if (!userId && !(code && request.headers.get('x-access-code') === code)) throw new HttpError(401, 'Sign in to use the AI tutor.');
    const who = userId ? `u:${userId}` : `ip:${ip}`;
    await rateLimit('ai-min', who, env('AI_RATE_LIMIT_PER_MIN', 15), 60, 'Too many AI requests. Wait a minute and try again.');
    await rateLimit('ai-day', who, env('AI_DAILY_LIMIT', 200), 86_400, 'You reached today’s AI limit. It resets tomorrow.');
    // A cap per network too, so one person cannot get around limits with many accounts.
    await rateLimit('ai-ip-day', ip, env('AI_DAILY_LIMIT', 200) * 4, 86_400, 'This network reached today’s AI limit. It resets tomorrow.');
  }
  const aiRequest = { ...body, maxTokens: body.maxTokens ?? 2000 };
  const stream = await startWithFallbacks(aiRequest, key, !userKey);
  const encoder = new TextEncoder();
  const out = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const text of stream) controller.enqueue(encoder.encode(JSON.stringify({ t: text }) + '\n'));
        controller.enqueue(encoder.encode('{"done":true}\n'));
      } catch (error) {
        controller.enqueue(encoder.encode(JSON.stringify({ e: error instanceof Error ? error.message : 'The AI stream stopped unexpectedly' }) + '\n'));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(out, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' } });
});
