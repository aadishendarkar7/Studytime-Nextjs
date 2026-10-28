'use client';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { readAttachment, type Attachment } from '@/lib/ai/files';
import { toast } from '@/lib/stores/ui';
import { cn } from '@/lib/utils';
import { Icon } from './icons';

export function useAttachments(limit: number) {
  const [files, setFiles] = useState<Attachment[]>([]);
  const [reading, setReading] = useState(false);
  const add = useCallback(
    async (list: FileList | File[]) => {
      setReading(true);
      const next: Attachment[] = [];
      for (const file of Array.from(list)) {
        if (files.length + next.length >= limit) {
          toast(`You can attach up to ${limit} files.`);
          break;
        }
        try {
          next.push(await readAttachment(file));
        } catch (error) {
          toast((error as Error).message, 'error');
        }
      }
      setFiles((f) => [...f, ...next].slice(0, limit));
      setReading(false);
    },
    [files.length, limit],
  );
  const remove = (i: number) => setFiles((f) => f.filter((_, j) => j !== i));
  const clear = () => setFiles([]);
  return { files, add, remove, clear, reading };
}

export function DropZone({ onFiles, accept, multiple = true, title, hint, inputId }: { onFiles: (f: FileList) => void; accept: string; multiple?: boolean; title: string; hint: string; inputId?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={title}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), input.current?.click())}
      onDragOver={(e) => (e.preventDefault(), setOver(true))}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
      }}
      className={cn('my-3 flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors', over ? 'border-accent bg-accent-soft' : 'border-line bg-surface-2 hover:border-line-strong')}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface text-ink-2"><Icon name="clip" className="size-[18px]" /></span>
      <span className="min-w-0 flex-1 text-left">
        <strong className="block text-[14px] font-semibold text-ink">{title}</strong>
        <span className="block text-[13px] text-muted">{hint}</span>
      </span>
      <span className="hidden rounded-lg border border-line-strong/60 bg-surface px-3 py-1.5 text-[13px] font-semibold text-ink sm:block">Choose file</span>
      <input
        id={inputId}
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}

export function FileTray({ files, onRemove, reading }: { files: Attachment[]; onRemove: (i: number) => void; reading?: boolean }) {
  if (!files.length && !reading) return null;
  return (
    <div className="my-2 flex flex-wrap gap-2">
      {files.map((f, i) => (
        <span key={`${f.name}-${i}`} className="relative flex max-w-56 items-center gap-2 rounded-lg border border-line bg-surface py-1.5 pr-10 pl-1.5 text-xs">
          {f.kind === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={f.preview} alt="" className="size-11 object-cover" />
          ) : (
            <b className="grid size-11 place-items-center bg-surface-3 text-[12px] text-ink-2">{f.kind === 'pdf' ? 'PDF' : 'DOC'}</b>
          )}
          <span className="truncate">{f.name}</span>
          <button type="button" onClick={() => onRemove(i)} aria-label={`Remove ${f.name}`} className="absolute top-0 right-0 grid size-9 place-items-center text-muted hover:text-ink">
            <Icon name="close" className="size-4" />
          </button>
        </span>
      ))}
      {reading && <span className="self-center text-xs text-muted">Reading file</span>}
    </div>
  );
}

export function ErrorBox({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="border border-danger bg-danger-soft px-4 py-3 text-[13px] leading-5 text-danger" role="alert">
      <strong>Something went wrong.</strong> {children} {action}
    </div>
  );
}
