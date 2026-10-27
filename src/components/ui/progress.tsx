import { cn } from '@/lib/utils';

const clamp = (value: number) => Math.max(0, Math.min(100, value));

export function Bar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn('h-2.5 overflow-hidden rounded-full bg-surface-3', className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${clamp(value)}%` }} />
    </div>
  );
}

/**
 * A ruler of tick marks that fills from the left. Every fifth tick is taller.
 * It is the one moving element in the interface and it only ever reflects a real value.
 */
export function Ruler({ value, ticks = 60, className }: { value: number; ticks?: number; className?: string }) {
  const filled = Math.round((clamp(value) / 100) * ticks);
  return (
    <div className={cn('flex h-8 items-end justify-between', className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      {Array.from({ length: ticks }, (_, i) => (
        <span key={i} className={cn('w-[3px] rounded-full', i < filled ? 'bg-accent' : 'bg-line', i % 5 === 0 ? 'h-full' : 'h-1/2')} />
      ))}
    </div>
  );
}

export function Thinking({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1.5 py-3 text-[14px] text-muted" role="status">
      {[0, 150, 300].map((d) => (
        <span key={d} className="size-1.5 animate-dot rounded-full bg-accent" style={{ animationDelay: `${d}ms` }} />
      ))}
      <span className="ml-1.5">{label}</span>
    </div>
  );
}
