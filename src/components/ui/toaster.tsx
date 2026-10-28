'use client';
import { useUi } from '@/lib/stores/ui';
import { cn } from '@/lib/utils';

export function Toaster() {
  const toasts = useUi((s) => s.toasts);
  const dismiss = useUi((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 lg:bottom-6 flex flex-col items-center gap-2 px-4" role="status" aria-live="polite">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismiss(t.id)}
          className={cn('pointer-events-auto min-h-11 max-w-md rounded-xl px-4 py-2.5 text-left text-[14px] leading-5 text-bg shadow-lg', t.tone === 'error' ? 'bg-danger' : 'bg-ink')}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}
