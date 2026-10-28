'use client';
import { cn } from '@/lib/utils';

/** A segmented control: a gray track with the chosen option raised on it. */
export function Segmented<T extends string>({ options, value, onChange, label, className, wrap = true }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label?: string; className?: string; wrap?: boolean }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('flex max-w-full gap-0.5 rounded-lg bg-surface-3 p-0.5', wrap ? 'flex-wrap' : 'overflow-x-auto [scrollbar-width:none]', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-8 shrink-0 rounded-md px-3 text-[13px] font-medium whitespace-nowrap transition-colors max-sm:h-9',
            value === o.value ? 'bg-surface text-ink shadow-[0_1px_2px_rgb(var(--shadow-color)/0.12),0_0_0_1px_var(--line)]' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Page-level tabs: a row of labels with an underline under the open one. */
export function Tabs<T extends string>({ options, value, onChange, label, className }: { options: { value: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void; label?: string; className?: string }) {
  return (
    <div role="tablist" aria-label={label} className={cn('-mx-1 flex gap-1 overflow-x-auto border-b border-line px-1 [scrollbar-width:none]', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            '-mb-px flex h-10 shrink-0 items-center gap-1.5 border-b-2 px-2.5 text-[14px] font-medium whitespace-nowrap transition-colors',
            value === o.value ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink',
          )}
        >
          {o.label}
          {o.count ? <span className="tnum rounded bg-surface-3 px-1.5 text-[11px] leading-[18px] text-ink-2">{o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
