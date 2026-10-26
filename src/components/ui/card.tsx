import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn('rounded-2xl border border-line bg-surface p-6 shadow-card max-sm:p-5', className)} {...props} />;
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('text-[11px] font-bold tracking-[0.12em] text-muted uppercase', className)}>{children}</div>;
}

export function CardHeader({ eyebrow, title, description, action, className }: { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h2 className="mt-1.5 text-lg font-bold text-ink">{title}</h2>
        {description && <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: ReactNode; action?: ReactNode }) {
  return (
    <header className="mt-8 mb-6 flex flex-wrap items-end justify-between gap-4 max-sm:mt-5">
      <div className="min-w-0">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-2 text-[clamp(28px,3vw,40px)] leading-tight font-extrabold tracking-[-0.04em] text-ink">{title}</h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">{description}</p>
      </div>
      {action}
    </header>
  );
}

export function Empty({ title, children, action }: { title?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong px-5 py-8 text-center">
      {title && <p className="font-display font-bold text-ink">{title}</p>}
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">{children}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Badge({ tone = 'default', children, className }: { tone?: 'default' | 'ok' | 'warn' | 'accent'; children: ReactNode; className?: string }) {
  const tones = { default: 'bg-surface-3 text-ink-2', ok: 'bg-ok-soft text-ok', warn: 'bg-warn-soft text-warn', accent: 'bg-accent-soft text-accent-ink' };
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap', tones[tone], className)}>{children}</span>;
}
