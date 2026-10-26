'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ErrorBox } from '@/components/ui/attachments';
import { Markdown } from '@/components/ui/markdown';
import { Thinking } from '@/components/ui/progress';
import type { AiError } from '@/lib/ai/client';

export function AiErrorBox({ error }: { error: AiError | Error }) {
  const needsSetup = 'needsSetup' in error && (error as AiError).needsSetup;
  return <ErrorBox action={needsSetup ? <Link href="/settings#ai" className="font-bold underline">Open AI settings</Link> : undefined}>{error.message}</ErrorBox>;
}

export function Placeholder({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center">
      <strong className="block font-display text-base text-ink">{title}</strong>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">{children}</p>
    </div>
  );
}

/** Standard output area for a streaming AI task. */
export function AiOutput({ run, thinking, placeholder }: { run: { text: string; status: string; error: AiError | null }; thinking: string; placeholder: ReactNode }) {
  if (run.error) return <AiErrorBox error={run.error} />;
  if (run.status === 'running' && !run.text) return <Thinking label={thinking} />;
  if (!run.text) return <>{placeholder}</>;
  return <Markdown streaming={run.status === 'running'}>{run.text}</Markdown>;
}
