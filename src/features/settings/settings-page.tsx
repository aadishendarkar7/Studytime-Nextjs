'use client';
import { useEffect, useRef } from 'react';
import { Card, CardHeader, PageHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, FieldRow, Note } from '@/components/ui/field';
import { Icon } from '@/components/ui/icons';
import { Segmented } from '@/components/ui/segmented';
import { BACKDROPS, PALETTES, WASHES } from '@/lib/appearance';
import { exportBackup, importBackup } from '@/lib/stores/hydrate';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import { cn, downloadFile } from '@/lib/utils';
import { AiSettings } from './ai-settings';

function ColorInput({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label} htmlFor={id}>
      <div className="flex h-11 items-center gap-3 rounded-xl border border-line-strong bg-surface px-2">
        <input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value)} className="size-8 cursor-pointer rounded-lg border-0 bg-transparent p-0" />
        <span className="tnum font-mono text-[14px] text-ink-2 uppercase">{value}</span>
      </div>
    </Field>
  );
}

function AppearanceCard() {
  const { accent, glow, backdrop, wash, update } = useProfile();
  const active = PALETTES.find((p) => p.accent === accent && p.glow === glow)?.name;
  return (
    <Card className="lg:col-span-2">
      <CardHeader title="Appearance" description="Pick a color pair or choose your own. The first color is used for buttons and progress, the second blends into the background." />
      <div role="radiogroup" aria-label="Color pair" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {PALETTES.map((p) => (
          <button
            key={p.name}
            type="button"
            role="radio"
            aria-checked={active === p.name}
            onClick={() => update({ accent: p.accent, glow: p.glow })}
            className={cn('flex items-center gap-3 rounded-xl border p-2.5 text-left text-[14px] font-medium transition-colors', active === p.name ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line hover:bg-surface-3')}
          >
            <span className="relative size-9 shrink-0 overflow-hidden rounded-lg" style={{ background: p.glow }}>
              <span className="absolute inset-y-0 left-0 w-1/2" style={{ background: p.accent }} />
            </span>
            {p.name}
          </button>
        ))}
      </div>
      <FieldRow>
        <ColorInput id="accentColor" label="Main color" value={accent} onChange={(v) => update({ accent: v })} />
        <ColorInput id="glowColor" label="Background color" value={glow} onChange={(v) => update({ glow: v })} />
      </FieldRow>
      <Field label="Background pattern">
        <Segmented label="Background pattern" value={backdrop} onChange={(v) => update({ backdrop: v })} options={BACKDROPS} />
      </Field>
      <Field label="Color strength">
        <Segmented label="Color strength" value={wash} onChange={(v) => update({ wash: v })} options={WASHES} />
      </Field>
      <Note>If a color is too light to read on, buttons use a darker shade of it automatically.</Note>
    </Card>
  );
}

function DataCard() {
  const fileInput = useRef<HTMLInputElement>(null);
  return (
    <Card>
      <CardHeader title="Backup and restore" description="Your progress is saved in this browser. Export a backup to move it to another device." />
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => downloadFile(`studytime-backup-${new Date().toISOString().slice(0, 10)}.json`, exportBackup(), 'application/json')}><Icon name="download" className="size-4" /> Export backup</Button>
        <Button variant="secondary" onClick={() => fileInput.current?.click()}><Icon name="upload" className="size-4" /> Import backup</Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f || !confirm('Replace the progress in this browser with this backup?')) return;
            try {
              await importBackup(await f.text());
              toast('Backup restored.');
            } catch (error) {
              toast((error as Error).message, 'error');
            }
          }}
        />
      </div>
      <Note>Backups never include your API keys.</Note>
    </Card>
  );
}

export function SettingsPage() {
  useEffect(() => {
    if (location.hash === '#ai') setTimeout(() => document.getElementById('ai')?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);
  return (
    <>
      <PageHeader title="Settings" description="Colors and background, the AI tutor connection, and backups. Your name, goals and courses are on your profile." />
      <div className="grid gap-5 lg:grid-cols-2">
        <AppearanceCard />
        <AiSettings />
        <DataCard />
      </div>
    </>
  );
}
