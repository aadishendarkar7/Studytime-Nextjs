import { cn } from '@/lib/utils';

/** A round initial with an optional presence dot. */
export function Avatar({ name, color, size = 32, online, className }: { name: string; color?: string; size?: number; online?: boolean; className?: string }) {
  return (
    <span className={cn('relative inline-grid shrink-0 place-items-center rounded-full font-semibold text-white', !color && 'bg-surface-3 text-ink-2', className)} style={{ width: size, height: size, fontSize: Math.round(size * 0.42), background: color }} aria-hidden="true">
      {(name.trim()[0] || '?').toUpperCase()}
      {online !== undefined && <span className={cn('absolute -right-0.5 -bottom-0.5 rounded-full border-2 border-surface', online ? 'bg-ok' : 'bg-line-strong')} style={{ width: Math.max(9, size * 0.32), height: Math.max(9, size * 0.32) }} />}
    </span>
  );
}
