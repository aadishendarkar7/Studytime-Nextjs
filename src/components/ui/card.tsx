import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn('panel p-5 max-sm:p-4', className)} {...props} />;
}

/** Small metadata label for table headers and record details. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('text-[13px] leading-5 font-medium text-muted', className)}>{children}</div>;
}

export function CardHeader({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="font-sans text-[15px] leading-6 font-semibold tracking-[-0.01em] text-ink">{title}</h2>
        {description && <p className="mt-0.5 max-w-[68ch] text-[13px] leading-5 text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, description, action, level = 1 }: { title: string; description?: ReactNode; action?: ReactNode; level?: 1 | 2 }) {
  const Heading = level === 1 ? 'h1' : 'h2';
  return (
    <header className={cn('mb-6 flex flex-wrap items-end justify-between gap-4', level === 1 ? 'mt-4 max-sm:mt-2' : 'mt-10')}>
      <div className="min-w-0">
        <Heading className={cn('text-ink', level === 1 ? 'text-[26px] leading-8 max-sm:text-[22px] max-sm:leading-7' : 'text-[20px] leading-7')}>{title}</Heading>
        {description && <p className="mt-1 max-w-[68ch] text-[14px] leading-[22px] text-muted">{description}</p>}
      </div>
      {action}
    </header>
  );
}

export function Empty({ title, children, action }: { title?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="well px-4 py-4">
      {title && <p className="text-[14px] leading-6 font-semibold text-ink">{title}</p>}
      <p className="mt-0.5 max-w-[68ch] text-[13px] leading-5 text-muted">{children}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Badge({ tone = 'default', children, className }: { tone?: 'default' | 'ok' | 'warn' | 'accent'; children: ReactNode; className?: string }) {
  const tones = {
    default: 'bg-surface-3 text-ink-2',
    ok: 'bg-ok-soft text-ok',
    warn: 'bg-warn-soft text-warn',
    accent: 'bg-accent-soft text-accent-ink',
  };
  return <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 text-[12px] leading-5 font-medium whitespace-nowrap', tones[tone], className)}>{children}</span>;
}
