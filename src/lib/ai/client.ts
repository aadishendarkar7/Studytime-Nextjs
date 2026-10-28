'use client';
import { useEffect, useState } from 'react';
import { modelFor, useAi } from '@/lib/stores/ai';
import { parseJSONLoose } from '@/lib/utils';
import { PROVIDERS, type AiMessage, type AiStatus, type ProviderId } from './providers';

// ---------- Server status (cached per page load) ----------
let statusCache: AiStatus | null = null;
let statusPromise: Promise<AiStatus> | null = null;
const listeners = new Set<(s: AiStatus) => void>();

export function loadAiStatus(force = false): Promise<AiStatus> {
  if (statusCache && !force) return Promise.resolve(statusCache);
  if (!statusPromise || force) {
    statusPromise = fetch('/api/ai/status', { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<AiStatus>) : Promise.reject()))
      .catch(() => ({ serverProviders: [], defaultProvider: null, requiresAccessCode: false }) as AiStatus)
      .then((s) => {
        statusCache = s;
        listeners.forEach((l) => l(s));
        return s;
      });
  }
  return statusPromise;
}

export function useAiStatus() {
  const [status, setStatus] = useState<AiStatus | null>(statusCache);
  useEffect(() => {
    listeners.add(setStatus);
    loadAiStatus().then(setStatus);
    return () => void listeners.delete(setStatus);
  }, []);
  return status;
}

export type Connection = { mode: 'own' | 'server' | 'none'; provider: ProviderId };

/** Decide which provider/key to use: the student's own key first, then the server's. */
export function resolveConnection(status: AiStatus | null = statusCache): Connection {
  const s = useAi.getState();
  if (s.keys[s.provider]) return { mode: 'own', provider: s.provider };
  if (status?.serverProviders.includes(s.provider)) return { mode: 'server', provider: s.provider };
  if (status?.defaultProvider) return { mode: 'server', provider: status.defaultProvider };
  return { mode: 'none', provider: s.provider };
}

export function useConnection() {
  const status = useAiStatus();
  const provider = useAi((s) => s.provider);
  const keys = useAi((s) => s.keys);
  void provider;
  void keys;
  return { ...resolveConnection(status), status };
}

export class AiError extends Error {
  constructor(message: string, public needsSetup = false) {
    super(message);
  }
}

export interface CallOptions {
  system?: string;
  messages: AiMessage[];
  maxTokens?: number;
  tier?: 'main' | 'fast' | 'verify';
  onText?: (fullText: string) => void;
  signal?: AbortSignal;
  /** Use this provider no matter what is picked in Settings (for example Gemini for audio). */
  provider?: ProviderId;
}

/** Stream a reply through /api/ai. Resolves with the full text. */
export async function callAI({ system, messages, maxTokens = 2500, tier = 'main', onText, signal, provider }: CallOptions): Promise<string> {
  const status = await loadAiStatus();
  let conn = resolveConnection(status);
  if (provider && conn.provider !== provider) {
    if (useAi.getState().keys[provider]) conn = { mode: 'own', provider };
    else if (status.serverProviders.includes(provider)) conn = { mode: 'server', provider };
    else throw new AiError(`This needs ${PROVIDERS[provider].label}. Add a free ${PROVIDERS[provider].label} key in Settings → AI tutor.`, true);
  }
  if (conn.mode === 'none') throw new AiError('Add a free AI key in Settings → AI tutor to use AI features.', true);
  const settings = useAi.getState();
  const info = PROVIDERS[conn.provider];
  const model = provider && provider !== settings.provider ? PROVIDERS[provider].defaults[tier] : modelFor({ provider: conn.provider, models: settings.models }, tier);
  const hasFiles = messages.some((m) => Array.isArray(m.content) && m.content.some((p) => p.type !== 'text'));
  if (hasFiles && !info.images) throw new AiError(`${info.label} can’t read photos or PDFs. Type or paste the text instead, or switch to Google Gemini (free) in Settings.`);
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (conn.mode === 'own') headers['x-ai-key'] = settings.keys[conn.provider]!;
  if (settings.accessCode) headers['x-access-code'] = settings.accessCode;
  let response: Response;
  try {
    response = await fetch('/api/ai', { method: 'POST', headers, signal, body: JSON.stringify({ provider: conn.provider, model, system, messages, maxTokens }) });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new AiError('Could not reach Studytime. Check your internet connection.');
  }
  if (!response.ok || !response.body) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    if (response.status === 413) throw new AiError('Those files are too large. Use fewer or smaller pages.');
    throw new AiError(body.error || `AI request failed (${response.status}).`, response.status === 503 || response.status === 401);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let cut: number;
    while ((cut = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, cut).trim();
      buffer = buffer.slice(cut + 1);
      if (!line) continue;
      const event = JSON.parse(line) as { t?: string; e?: string; done?: boolean };
      if (event.e) throw new AiError(event.e);
      if (event.t) {
        text += event.t;
        onText?.(text);
      }
    }
  }
  if (!text.trim()) throw new AiError('The AI returned an empty reply. Try again, or pick another model in Settings.');
  return text;
}

export async function callJSON<T>(options: Omit<CallOptions, 'onText'>): Promise<T> {
  return parseJSONLoose<T>(await callAI(options));
}
