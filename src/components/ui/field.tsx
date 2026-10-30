import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const control = 'well w-full min-w-0 px-3 text-[14px] text-ink outline-none hover:border-line-strong/60 focus:border-[color-mix(in_oklab,var(--glow)_70%,transparent)] focus:shadow-[inset_0_1px_2px_rgb(0_0_0/0.28),0_0_0_3px_color-mix(in_oklab,var(--glow)_18%,transparent)] disabled:opacity-50';

export function Label({ htmlFor, children, hint, className }: { htmlFor?: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn('mb-1.5 block text-[13px] leading-5 font-medium text-ink', className)}>
      {children}
      {hint && <span className="ml-1 font-normal text-muted">{hint}</span>}
    </label>
  );
}

export function Field({ label, htmlFor, hint, children, className }: { label: string; htmlFor?: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('mt-4 first:mt-0', className)}>
      <Label htmlFor={htmlFor} hint={hint}>{label}</Label>
      {children}
    </div>
  );
}

/** Two (or more) fields side by side on wider screens. */
export function FieldRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mt-4 grid gap-x-3 gap-y-4 sm:grid-cols-2 [&>*]:mt-0', className)}>{children}</div>;
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(control, 'h-9 max-sm:h-10', className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...props }, ref) {
  return <select ref={ref} className={cn(control, 'h-9 pr-8 max-sm:h-10', className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(control, 'py-2 leading-[22px]', className)} {...props} />;
});

export function Checkbox({ label, ...props }: { label: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="mt-3 flex min-h-9 items-center gap-2.5 text-[14px] text-ink">
      <input type="checkbox" className="size-4 accent-[var(--accent)]" {...props} />
      {label}
    </label>
  );
}

export function Note({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('mt-3 max-w-[68ch] text-[13px] leading-5 text-muted', className)}>{children}</p>;
}
