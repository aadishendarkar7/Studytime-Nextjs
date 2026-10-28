import 'server-only';
import type { AiMessage, AiPart, AiRequest, ProviderId } from '@/lib/ai/providers';
import { PROVIDER_IDS } from '@/lib/ai/providers';
import { HttpError } from './http';

const ENV_KEYS: Record<ProviderId, string> = {
  gemini: 'GEMINI_API_KEY',
  groq: 'GROQ_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
};
const BASE: Record<ProviderId, [string, string]> = {
  gemini: ['GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com'],
  groq: ['GROQ_BASE_URL', 'https://api.groq.com/openai/v1'],
  openrouter: ['OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1'],
  anthropic: ['ANTHROPIC_BASE_URL', 'https://api.anthropic.com'],
};
const base = (p: ProviderId) => (process.env[BASE[p][0]] || BASE[p][1]).replace(/\/$/, '');

export const serverKey = (p: ProviderId) => process.env[ENV_KEYS[p]]?.trim() || '';
export const serverProviders = () => PROVIDER_IDS.filter((p) => serverKey(p));
export function defaultServerProvider(): ProviderId | null {
  const preferred = process.env.AI_PROVIDER as ProviderId | undefined;
  if (preferred && serverKey(preferred)) return preferred;
  return serverProviders()[0] ?? null;
}

const parts = (content: AiMessage['content']): AiPart[] => (typeof content === 'string' ? [{ type: 'text', text: content }] : content);

/** Read a Server-Sent Events body and yield each `data:` payload. */
async function* sseData(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let cut: number;
    while ((cut = buffer.search(/\r?\n\r?\n/)) >= 0) {
      const chunk = buffer.slice(0, cut);
      buffer = buffer.slice(cut).replace(/^\r?\n\r?\n/, '');
      for (const line of chunk.split(/\r?\n/)) if (line.startsWith('data:')) yield line.slice(5).trim();
    }
  }
  if (buffer.trim().startsWith('data:')) yield buffer.trim().slice(5).trim();
}

async function upstreamError(response: Response, provider: ProviderId) {
  const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } | string; message?: string };
  const detail = typeof body.error === 'string' ? body.error : body.error?.message || body.message || '';
  if (response.status === 401 || response.status === 403) return new HttpError(401, `The ${provider} API key was rejected. Check it in Settings → AI tutor.${detail ? ` (${detail})` : ''}`);
  if (response.status === 429) return new HttpError(429, `The free-tier limit was reached for this provider. Wait a minute (or until tomorrow for daily limits) and try again.${detail ? ` (${detail})` : ''}`);
  if (response.status === 404) return new HttpError(400, `Model not found for ${provider}. Pick another model in Settings.${detail ? ` (${detail})` : ''}`);
  return new HttpError(response.status >= 500 ? 502 : 400, detail || `The AI service returned an error (${response.status}).`);
}

type Stream = AsyncGenerator<string>;

const noAudio = (): never => {
  throw new HttpError(400, 'Only Google Gemini can listen to recordings. Switch the AI to Gemini in Settings.');
};

async function* anthropic(req: AiRequest, key: string): Stream {
  const response = await fetch(`${base('anthropic')}/v1/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: req.model,
      max_tokens: req.maxTokens,
      stream: true,
      ...(req.system ? { system: req.system } : {}),
      messages: req.messages.map((m) => ({
        role: m.role,
        content: parts(m.content).map((p) =>
          p.type === 'audio'
            ? noAudio()
            : p.type === 'text'
            ? { type: 'text', text: p.text }
            : p.type === 'image'
              ? { type: 'image', source: { type: 'base64', media_type: p.mediaType, data: p.data } }
              : { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: p.data } },
        ),
      })),
    }),
  });
  if (!response.ok || !response.body) throw await upstreamError(response, 'anthropic');
  for await (const data of sseData(response.body)) {
    let event: { type?: string; delta?: { type?: string; text?: string }; error?: { message?: string } };
    try { event = JSON.parse(data); } catch { continue; }
    if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta' && event.delta.text) yield event.delta.text;
    else if (event.type === 'error') throw new Error(event.error?.message || 'The AI stream stopped unexpectedly');
  }
}

async function* gemini(req: AiRequest, key: string): Stream {
  const response = await fetch(`${base('gemini')}/v1beta/models/${encodeURIComponent(req.model)}:streamGenerateContent?alt=sse`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      ...(req.system ? { systemInstruction: { parts: [{ text: req.system }] } } : {}),
      contents: req.messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: parts(m.content).map((p) =>
          p.type === 'text' ? { text: p.text } : { inline_data: { mime_type: p.type === 'pdf' ? 'application/pdf' : p.mediaType, data: p.data } },
        ),
      })),
      // Thinking models count reasoning toward output tokens, so leave headroom.
      generationConfig: { maxOutputTokens: Math.min(65536, (req.maxTokens ?? 2000) * 2 + 4096) },
    }),
  });
  if (!response.ok || !response.body) throw await upstreamError(response, 'gemini');
  for await (const data of sseData(response.body)) {
    let event: { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[]; promptFeedback?: { blockReason?: string }; error?: { message?: string } };
    try { event = JSON.parse(data); } catch { continue; }
    if (event.error) throw new Error(event.error.message || 'Gemini returned an error');
    if (event.promptFeedback?.blockReason) throw new Error(`Gemini blocked this request (${event.promptFeedback.blockReason}).`);
    for (const part of event.candidates?.[0]?.content?.parts ?? []) if (part.text && !part.thought) yield part.text;
  }
}

async function* openaiCompatible(provider: 'groq' | 'openrouter', req: AiRequest, key: string): Stream {
  const toContent = (content: AiMessage['content']) => {
    if (typeof content === 'string') return content;
    return content.map((p) => {
      if (p.type === 'text') return { type: 'text', text: p.text };
      if (p.type === 'audio') return noAudio();
      if (p.type === 'image') return { type: 'image_url', image_url: { url: `data:${p.mediaType};base64,${p.data}` } };
      if (provider === 'openrouter') return { type: 'file', file: { filename: p.name || 'document.pdf', file_data: `data:application/pdf;base64,${p.data}` } };
      return { type: 'text', text: `[A PDF named ${p.name || 'document.pdf'} was attached, but this provider cannot read PDFs. Ask the student to paste the text.]` };
    });
  };
  const response = await fetch(`${base(provider)}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
      ...(provider === 'openrouter' ? { 'X-Title': 'Studytime' } : {}),
    },
    body: JSON.stringify({
      model: req.model,
      stream: true,
      max_tokens: req.maxTokens,
      messages: [...(req.system ? [{ role: 'system', content: req.system }] : []), ...req.messages.map((m) => ({ role: m.role, content: toContent(m.content) }))],
    }),
  });
  if (!response.ok || !response.body) throw await upstreamError(response, provider);
  for await (const data of sseData(response.body)) {
    if (data === '[DONE]') break;
    let event: { choices?: { delta?: { content?: string | null } }[]; error?: { message?: string } };
    try { event = JSON.parse(data); } catch { continue; }
    if (event.error) throw new Error(event.error.message || 'The AI service returned an error');
    const text = event.choices?.[0]?.delta?.content;
    if (text) yield text;
  }
}

/** Start a provider stream. Fetch/HTTP errors are thrown before the first chunk. */
export async function startStream(req: AiRequest, key: string): Promise<Stream> {
  const gen = req.provider === 'anthropic' ? anthropic(req, key) : req.provider === 'gemini' ? gemini(req, key) : openaiCompatible(req.provider, req, key);
  // Pull the first chunk now so connection/auth errors become proper HTTP errors.
  let first: IteratorResult<string>;
  try {
    first = await gen.next();
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(502, error instanceof Error && error.message !== 'fetch failed' ? error.message : 'Could not reach the AI service. Check the internet connection.');
  }
  return (async function* () {
    if (!first.done) yield first.value;
    yield* gen;
  })();
}
