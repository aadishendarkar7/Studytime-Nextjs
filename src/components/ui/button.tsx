import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link' | 'white' | 'outline-light';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-white shadow-sm hover:bg-brand-hover',
  secondary: 'bg-surface-3 text-ink-2 hover:bg-accent-soft border border-transparent',
  ghost: 'text-ink-2 hover:bg-surface-3',
  danger: 'text-danger hover:bg-danger-soft',
  link: 'text-accent-ink underline-offset-4 hover:underline px-0! h-auto!',
  white: 'bg-white text-[#23513c] hover:bg-[#eef4e8]',
  'outline-light': 'border border-white/35 text-white hover:bg-white/10',
};
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] rounded-lg gap-1.5',
  md: 'h-10 px-4 text-sm rounded-[10px] gap-2',
  lg: 'h-12 px-5 text-[15px] rounded-xl gap-2',
  icon: 'size-10 rounded-[10px] justify-center',
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
        'inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-55',
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
