'use client';
import { cn } from '@/lib/utils';

export function Segmented<T extends string>({ options, value, onChange, label, className, wrap = true }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label?: string; className?: string; wrap?: boolean }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('flex gap-1.5', wrap && 'flex-wrap', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-[9px] border px-3 py-2 text-[13px] font-semibold transition-colors',
            value === o.value ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line-strong bg-surface-2 text-ink-2 hover:bg-surface-3',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
