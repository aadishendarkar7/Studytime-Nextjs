// Provider catalog shared by the client (settings UI) and the server (proxy).

export type ProviderId = 'gemini' | 'groq' | 'openrouter' | 'anthropic';

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  free: boolean;
  keyUrl: string;
  keyHint: string; // prefix shown in the placeholder
  /** Expected key format. Used only for a soft warning; any key may be saved. */
  keyPattern: RegExp;
  images: boolean;
  pdfs: boolean;
  models: { id: string; label: string }[];
  /** Models used for the main answer, light tasks (concept extraction), and cross-checks. */
  defaults: { main: string; fast: string; verify: string };
  note: string;
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    free: true,
    keyUrl: 'https://aistudio.google.com/apikey',
    keyHint: 'AIza… or AQ.…',
    keyPattern: /^(AIza[\w-]{20,}|AQ\.[\w.-]{20,})$/,
    images: true,
    pdfs: true,
    models: [
      { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash: recommended' },
      { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
      { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite: fastest' },
    ],
    defaults: { main: 'gemini-3.8-flash', fast: 'gemini-3.5-flash-lite', verify: 'gemini-3.8-flash' },
    note: 'Free with a Google account, no credit card. Reads photos and PDFs. Free-tier prompts may be used by Google to improve its products.',
  },
  groq: {
    id: 'groq',
    label: 'Groq',
    free: true,
    keyUrl: 'https://console.groq.com/keys',
    keyHint: 'gsk_…',
    keyPattern: /^gsk_[\w-]{20,}$/,
    images: false,
    pdfs: false,
    models: [
      { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B: recommended' },
      { id: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B: fastest' },
      { id: 'qwen/qwen3.8-27b', label: 'Qwen 3.8 27B' },
    ],
    defaults: { main: 'openai/gpt-oss-120b', fast: 'openai/gpt-oss-20b', verify: 'qwen/qwen3.8-27b' },
    note: 'Free tier, very fast. Text only: type problems instead of uploading photos.',
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    free: true,
    keyUrl: 'https://openrouter.ai/keys',
    keyHint: 'sk-or-…',
    keyPattern: /^sk-or-[\w-]{20,}$/,
    images: true,
    pdfs: true,
    models: [
      { id: 'google/gemma-4-31b-it:free', label: 'Gemma 4 31B (free)' },
      { id: 'nvidia/nemotron-3-super-120b-a12b:free', label: 'Nemotron 3 Super (free)' },
      { id: 'nvidia/nemotron-3.5-super-vl:free', label: 'Nemotron 3.5 Super VL (free, images)' },
    ],
    defaults: { main: 'google/gemma-4-31b-it:free', fast: 'google/gemma-4-31b-it:free', verify: 'nvidia/nemotron-3-super-120b-a12b:free' },
    note: 'Free models (ending in :free) allow about 50 requests a day. Image support depends on the model.',
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic Claude',
    free: false,
    keyUrl: 'https://console.anthropic.com/settings/keys',
    keyHint: 'sk-ant-…',
    keyPattern: /^sk-ant-[\w-]{20,}$/,
    images: true,
    pdfs: true,
    models: [
      { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5: recommended' },
      { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5: fastest' },
      { id: 'claude-opus-5-5', label: 'Claude Opus 5.5: most careful' },
    ],
    defaults: { main: 'claude-sonnet-5-5', fast: 'claude-haiku-5-5', verify: 'claude-opus-5-5' },
    note: 'Paid (billed per use). Strong step-by-step reasoning.',
  },
};

export const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];
export const isProviderId = (v: unknown): v is ProviderId => typeof v === 'string' && v in PROVIDERS;
export const MODEL_PATTERN = /^[\w.\-:/]{1,100}$/;

// ---------- Request format (provider-neutral) ----------
export type AiPart =
  | { type: 'text'; text: string }
  | { type: 'image'; mediaType: string; data: string }
  | { type: 'pdf'; data: string; name?: string };

export interface AiMessage {
  role: 'user' | 'assistant';
  content: string | AiPart[];
}

export interface AiRequest {
  provider: ProviderId;
  model: string;
  system?: string;
  messages: AiMessage[];
  maxTokens?: number;
}

export interface AiStatus {
  serverProviders: ProviderId[];
  defaultProvider: ProviderId | null;
  requiresAccessCode: boolean;
}
