'use client';
import { useUi } from '@/lib/stores/ui';
import { cn } from '@/lib/utils';

export function Toaster() {
  const toasts = useUi((s) => s.toasts);
  const dismiss = useUi((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-8" role="status" aria-live="polite">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismiss(t.id)}
          className={cn('pointer-events-auto max-w-md rounded-xl px-4 py-3 text-left text-sm font-medium text-white shadow-lg', t.tone === 'error' ? 'bg-[#8a3b25]' : 'bg-[#1f4a36]')}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}
