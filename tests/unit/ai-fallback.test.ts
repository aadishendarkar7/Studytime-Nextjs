import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setStorage } from '@/lib/server/storage';
import { MemoryStorage } from '@/lib/server/storage/memory';

vi.mock('next/server', () => ({ connection: async () => undefined }));

const sse = (text: string) => new Response(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })}\n\n`, { status: 200 });
const busy = () => new Response(JSON.stringify({ error: { message: 'This model is currently experiencing high demand.' } }), { status: 503 });

async function ask(model: string) {
  const { POST } = await import('@/app/api/ai/route');
  const res = await POST(new Request('http://x/api/ai', { method: 'POST', headers: { 'content-type': 'application/json', 'x-access-code': 'code' }, body: JSON.stringify({ provider: 'gemini', model, messages: [{ role: 'user', content: 'hi' }] }) }));
  return { status: res.status, text: await res.text() };
}

describe('AI fallbacks', () => {
  beforeEach(() => {
    setStorage(new MemoryStorage());
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    vi.stubEnv('AI_ACCESS_CODE', 'code');
  });
  afterEach(() => (vi.unstubAllEnvs(), vi.unstubAllGlobals()));

  it('switches to another Gemini model when the first one is busy', async () => {
    const tried: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const model = /models\/([^:]+):/.exec(url)![1];
      tried.push(model);
      return model === 'gemini-3.8-flash' ? busy() : sse(`hello from ${model}`);
    }));
    const r = await ask('gemini-3.8-flash');
    expect(r.status).toBe(200);
    expect(r.text).toContain('hello from gemini-3.5-flash-lite');
    expect(tried).toEqual(['gemini-3.8-flash', 'gemini-3.5-flash-lite']);
  });

  it('skips a retired model', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (url.includes('gemini-2.5-flash') ? new Response('{}', { status: 404 }) : sse('ok'))));
    const r = await ask('gemini-2.5-flash');
    expect(r.text).toContain('ok');
  });

  it('gives a clear message when everything is busy', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => busy()));
    const r = await ask('gemini-3.8-flash');
    expect(r.status).toBe(503);
    expect(r.text).toMatch(/very busy/);
  });
});
