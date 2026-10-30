import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'destructive' | 'link';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const variants: Record<Variant, string> = {
  primary: 'border border-transparent bg-brand text-white shadow-sm hover:bg-brand-hover',
  secondary: 'border border-line bg-surface text-ink shadow-sm hover:border-line-strong/60 hover:bg-surface-2',
  ghost: 'border border-transparent text-ink-2 hover:bg-surface-3 hover:text-ink',
  danger: 'border border-line bg-surface text-danger hover:border-danger/40 hover:bg-danger-soft',
  destructive: 'border border-transparent bg-[#c0262d] text-white shadow-sm hover:bg-[#a51f25]',
  link: 'border border-transparent text-accent-ink underline decoration-1 underline-offset-4 px-0! h-auto! min-h-0! shadow-none!',
};
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg max-sm:h-10',
  md: 'h-9 px-3.5 text-[14px] gap-2 max-sm:h-10',
  lg: 'h-10 px-4.5 text-[14px] gap-2',
  icon: 'size-9 justify-center',
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
        'inline-flex shrink-0 items-center justify-center rounded-lg font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50',
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
