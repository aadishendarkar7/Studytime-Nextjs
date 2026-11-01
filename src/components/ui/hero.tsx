import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * A solid block in your color with white text: the one place on a page that says
 * "this is the main thing to do here". Use one per page at most.
 */
export function Hero({ title, sub, action, children, className }: { title: ReactNode; sub?: ReactNode; action?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-[10px] bg-accent-fill px-5 py-5 text-white max-sm:px-4 max-sm:py-4', className)}>
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-[min(100%,15rem)] flex-1">
          <h2 className="text-[20px] leading-7 font-semibold tracking-tight max-sm:text-[18px]">{title}</h2>
          {sub && <p className="mt-0.5 text-[14px] leading-5 text-white/80">{sub}</p>}
        </div>
        {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
      </div>
      {children}
    </section>
  );
}

/** The main button inside a Hero: white with dark text. */
export function HeroButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={cn('h-10 rounded-md bg-white px-4 text-[14px] font-semibold text-[#14301f] transition-colors hover:bg-white/90 disabled:opacity-60', className)} {...props} />;
}

/** A quieter button inside a Hero. */
export function HeroGhost({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={cn('h-10 rounded-md px-3 text-[14px] font-medium text-white/90 transition-colors hover:bg-white/10', className)} {...props} />;
}

/** A figure inside a Hero: big number, small label. */
export function HeroStat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="min-w-0">
      <p className="tnum truncate text-[24px] leading-8 font-semibold tracking-tight">{value}</p>
      <p className="truncate text-[13px] text-white/75">{label}</p>
    </div>
  );
}
