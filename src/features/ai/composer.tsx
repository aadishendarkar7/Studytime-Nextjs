'use client';
import { useRef, useState, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import type { Attachment } from '@/lib/ai/files';
import { cn } from '@/lib/utils';

type Att = { files: Attachment[]; add: (f: FileList | File[]) => unknown; remove: (i: number) => void; reading: boolean };

/** A small borderless select that sits inside a composer's bottom bar. */
export function InlineSelect({ label, className, children, ...props }: { label: string } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={cn('relative inline-flex items-center', className)}>
      <select aria-label={label} className="h-8 cursor-pointer appearance-none rounded-lg bg-transparent pr-7 pl-2.5 text-[13px] font-medium text-ink-2 outline-none hover:bg-surface-3 hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/30" {...props}>{children}</select>
      <Icon name="down" className="pointer-events-none absolute right-2 size-3.5 text-muted" />
    </span>
  );
}

function Thumbs({ att }: { att: Att }) {
  if (!att.files.length && !att.reading) return null;
  return (
    <div className="flex flex-wrap gap-2 px-3 pt-3">
      {att.files.map((f, i) => (
        <span key={`${f.name}-${i}`} className="group relative flex h-14 items-center gap-2 overflow-hidden rounded-lg border border-line bg-surface-2 pr-8 text-[12px]">
          {f.kind === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={f.preview} alt="" className="h-full w-14 object-cover" />
          ) : (
            <b className="grid h-full w-12 place-items-center bg-surface-3 text-[11px] text-ink-2">{f.kind === 'pdf' ? 'PDF' : 'DOC'}</b>
          )}
          <span className="max-w-32 truncate text-ink-2">{f.name}</span>
          <button type="button" onClick={() => att.remove(i)} aria-label={`Remove ${f.name}`} className="absolute top-1 right-1 grid size-6 place-items-center rounded-md text-muted hover:bg-surface-3 hover:text-ink">
            <Icon name="close" className="size-3.5" />
          </button>
        </span>
      ))}
      {att.reading && <span className="self-center text-[12px] text-muted">Reading file</span>}
    </div>
  );
}

/**
 * The input for every study tool: one box you type, paste or drop files into,
 * with options and the send button along the bottom edge.
 */
export function Composer({
  id,
  value,
  onChange,
  placeholder,
  rows = 4,
  att,
  accept = 'image/*,.pdf',
  camera,
  top,
  controls,
  submitLabel,
  onSubmit,
  loading,
  footnote,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  rows?: number;
  att?: Att;
  accept?: string;
  camera?: boolean;
  top?: ReactNode;
  controls?: ReactNode;
  submitLabel: string;
  onSubmit: () => void;
  loading?: boolean;
  footnote?: ReactNode;
}) {
  const file = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div>
      <div
        onDragOver={att ? (e) => (e.preventDefault(), setOver(true)) : undefined}
        onDragLeave={() => setOver(false)}
        onDrop={att ? (e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files.length) att.add(e.dataTransfer.files); } : undefined}
        className={cn('relative rounded-2xl border bg-surface transition-colors focus-within:border-ink/35', over ? 'border-accent bg-accent-soft/50' : 'border-line-strong/50')}
      >
        {top && <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">{top}</div>}
        {att && <Thumbs att={att} />}
        <textarea
          id={id}
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && (e.preventDefault(), onSubmit())}
          placeholder={placeholder}
          className="block w-full resize-y bg-transparent px-4 pt-3.5 pb-2 text-[15px] leading-6 text-ink outline-none placeholder:text-muted"
        />
        <div className="flex flex-wrap items-center gap-1 px-2 pb-2">
          {att && (
            <>
              <button type="button" onClick={() => file.current?.click()} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-ink-2 hover:bg-surface-3 hover:text-ink">
                <Icon name="clip" className="size-4" /> Attach
              </button>
              <input ref={file} type="file" accept={accept} multiple hidden onChange={(e) => (e.target.files?.length && att.add(e.target.files), (e.target.value = ''))} />
              {camera && (
                <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-ink-2 hover:bg-surface-3 hover:text-ink sm:hidden">
                  <Icon name="camera" className="size-4" /> Camera
                  <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files && att.add(e.target.files)} />
                </label>
              )}
              {controls && <span className="mx-1 h-4 w-px bg-line" aria-hidden="true" />}
            </>
          )}
          {controls}
          <Button size="sm" className="ml-auto" loading={loading} onClick={onSubmit}>{submitLabel} <Icon name="arrow" className="size-4" /></Button>
        </div>
        {over && <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-2xl text-[14px] font-semibold text-accent-ink">Drop to attach</div>}
      </div>
      {footnote && <p className="mt-2 px-1 text-[13px] leading-5 text-muted">{footnote}</p>}
    </div>
  );
}

/** A quiet heading above a result or a list. */
export function SectionLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex min-h-8 items-center justify-between gap-3">
      <h2 className="font-sans text-[12px] font-semibold tracking-[0.08em] text-muted uppercase">{children}</h2>
      {action}
    </div>
  );
}
