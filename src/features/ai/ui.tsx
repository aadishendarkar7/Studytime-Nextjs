'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ErrorBox } from '@/components/ui/attachments';
import { Markdown } from '@/components/ui/markdown';
import { Thinking } from '@/components/ui/progress';
import type { AiError } from '@/lib/ai/client';

export function AiErrorBox({ error }: { error: AiError | Error }) {
  const needsSetup = 'needsSetup' in error && (error as AiError).needsSetup;
  return <ErrorBox action={needsSetup ? <Link href="/settings#ai" className="font-semibold underline">Open AI settings</Link> : undefined}>{error.message}</ErrorBox>;
}

export function Placeholder({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border border-dashed border-line px-5 py-8 rounded-xl">
      <strong className="block font-display text-[18px] leading-6 font-semibold text-ink">{title}</strong>
      <p className="mt-1.5 max-w-[68ch] text-[13px] leading-5 text-muted">{children}</p>
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
