import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const variants: Record<Variant, string> = {
  primary: 'border border-brand bg-brand text-white shadow-sm hover:border-brand-hover hover:bg-brand-hover',
  secondary: 'border border-line-strong/60 bg-surface text-ink shadow-sm hover:bg-surface-3',
  ghost: 'border border-transparent text-ink-2 hover:bg-surface-3 hover:text-ink',
  danger: 'border border-danger/50 bg-surface text-danger hover:bg-danger-soft',
  link: 'border border-transparent text-accent-ink underline decoration-1 underline-offset-4 px-0! h-auto! min-h-0! shadow-none!',
};
const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-[14px] gap-1.5 rounded-lg max-sm:h-11',
  md: 'h-11 px-5 text-[15px] gap-2',
  lg: 'h-12 px-6 text-[15px] gap-2',
  icon: 'size-11 justify-center',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, block, className, children, disabled, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-xl font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        block && 'w-full',
        className,
      )}
      {...props}
    >
      {loading && <span className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" />}
      {children}
    </button>
  );
});
