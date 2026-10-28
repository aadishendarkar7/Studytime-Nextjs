'use client';
import { useState } from 'react';
import { Badge, Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Note, Select } from '@/components/ui/field';
import { callAI, loadAiStatus, useConnection } from '@/lib/ai/client';
import { PROVIDER_IDS, PROVIDERS, type ProviderId } from '@/lib/ai/providers';
import { useAi } from '@/lib/stores/ai';
import { toast } from '@/lib/stores/ui';
import { cn } from '@/lib/utils';

export function ConnectionPill({ className }: { className?: string }) {
  const conn = useConnection();
  const label = PROVIDERS[conn.provider].label;
  return (
    <span className={cn('inline-flex min-h-9 items-center gap-2 border px-3 text-[13px] font-medium rounded-xl', conn.mode === 'none' ? 'border-line bg-surface-3 text-ink' : 'border-line text-ink', className)}>
      <i className={cn('size-2', conn.mode === 'none' ? 'bg-danger' : 'bg-accent')} />
      {conn.mode === 'own' ? `${label}, your key` : conn.mode === 'server' ? `${label}, provided by this site` : 'AI not connected'}
    </span>
  );
}

export function AiSettings() {
  const ai = useAi();
  const conn = useConnection();
  const provider = PROVIDERS[ai.provider];

  return (
    <Card id="ai" className="scroll-mt-6 self-start">
      <CardHeader title="Connect the AI" description="Pick a provider and paste its API key. Google Gemini is free and reads photos and PDFs." action={<ConnectionPill />} />
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="AI provider">
        {PROVIDER_IDS.map((id) => {
          const p = PROVIDERS[id];
          const active = ai.provider === id;
          return (
            <button key={id} type="button" role="radio" aria-checked={active} onClick={() => ai.update({ provider: id as ProviderId })} className={cn("rounded-lg border px-3.5 py-3 text-left transition-colors", active ? "border-accent bg-accent-soft" : "border-line bg-surface hover:bg-surface-2")}>
              <span className="flex items-center justify-between gap-2">
                <strong className="text-sm">{p.label}</strong>
                <Badge tone={p.free ? 'ok' : 'default'}>{p.free ? 'Free' : 'Paid'}</Badge>
              </span>
              <span className="mt-1.5 block text-xs text-muted">{p.images ? 'Text, photos & PDFs' : 'Text only'}{ai.keys[id] ? ' · key saved' : conn.status?.serverProviders.includes(id) ? ' · provided by site' : ''}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[13px] text-muted">{provider.note}</p>
      <ProviderForm key={ai.provider} />
      <Note>Your key is saved only in this browser. It’s sent through this Studytime server to {provider.label} for each request and is never stored on the server. Free tiers have per-minute and daily limits; a solve with cross-check uses about 3 requests.</Note>
      <Button variant="link" size="sm" className="mt-1" onClick={() => loadAiStatus(true).then(() => toast('Refreshed.'))}>Refresh connection status</Button>
    </Card>
  );
}

/** Key + model fields for the selected provider (remounts when the provider changes). */
function ProviderForm() {
  const ai = useAi();
  const conn = useConnection();
  const provider = PROVIDERS[ai.provider];
  const savedKey = ai.keys[ai.provider] || '';
  const [keyInput, setKeyInput] = useState('');
  const [testing, setTesting] = useState(false);
  const chosenModel = ai.models[ai.provider] || provider.defaults.main;
  const isCustom = !provider.models.some((m) => m.id === chosenModel);
  const [custom, setCustom] = useState(isCustom ? chosenModel : '');
  const [showCustom, setShowCustom] = useState(isCustom);

  const save = () => {
    const key = keyInput.trim();
    if (!key) return toast('Paste your API key first.', 'error');
    ai.setKey(ai.provider, key);
    setKeyInput('');
    toast(provider.keyPattern.test(key) ? `${provider.label} key saved in this browser.` : `Key saved. It doesn’t look like a typical ${provider.label} key (${provider.keyHint}): use Test connection to check it.`);
  };
  const test = async () => {
    setTesting(true);
    try {
      const reply = await callAI({ tier: 'main', maxTokens: 30, messages: [{ role: 'user', content: 'Reply with exactly the word: ready' }] });
      toast(/ready/i.test(reply) ? 'AI tutor is connected and ready.' : `Connected. The model replied: “${reply.slice(0, 60)}”`);
    } catch (error) {
      toast((error as Error).message, 'error');
    } finally {
      setTesting(false);
    }
  };

  return (
      <div className="mt-2 grid gap-x-5 lg:grid-cols-2">
        <div>
          <Field label={`${provider.label} API key`} htmlFor="aiKeyInput">
            <div className="flex gap-2">
              <Input id="aiKeyInput" type="password" autoComplete="off" spellCheck={false} value={keyInput} onChange={(e) => setKeyInput(e.target.value)} placeholder={savedKey ? `Saved: ••••${savedKey.slice(-4)}` : provider.keyHint} onKeyDown={(e) => e.key === 'Enter' && save()} />
              <Button onClick={save}>Save key</Button>
            </div>
          </Field>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="secondary" loading={testing} onClick={test}>Test connection</Button>
            {savedKey && <Button variant="danger" onClick={() => (ai.setKey(ai.provider, ''), toast('Key removed from this browser.'))}>Remove key</Button>}
            <a href={provider.keyUrl} target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold text-accent-ink underline">Get a {provider.free ? 'free ' : ''}key →</a>
          </div>
          {conn.status?.requiresAccessCode && (
            <Field label="Site access code" htmlFor="aiAccess" hint="only needed to use this site’s shared key">
              <Input id="aiAccess" value={ai.accessCode} onChange={(e) => ai.update({ accessCode: e.target.value.trim() })} />
            </Field>
          )}
        </div>
        <div>
          <Field label="Model" htmlFor="aiModel">
            <Select id="aiModel" value={showCustom ? '__custom' : chosenModel} onChange={(e) => (e.target.value === '__custom' ? setShowCustom(true) : (ai.setModel(ai.provider, e.target.value), setShowCustom(false), setCustom('')))}>
              {provider.models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              <option value="__custom">Other model…</option>
            </Select>
          </Field>
          {showCustom && (
            <div className="mt-2 flex gap-2">
              <Input aria-label="Custom model ID" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Exact model ID" />
              <Button variant="secondary" onClick={() => custom.trim() && (ai.setModel(ai.provider, custom.trim()), toast('Model saved.'))}>Use</Button>
            </div>
          )}
          <Checkbox label="Cross-check solutions with a second pass" checked={ai.crossCheck} onChange={(e) => ai.update({ crossCheck: e.target.checked })} />
        </div>
      </div>
  );
}
