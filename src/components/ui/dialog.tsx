'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './icons';

export function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(560px,calc(100vw-32px))] rounded-3xl border border-line bg-surface p-0 text-ink shadow-lg"
    >
      {open && (
        <div className="p-6 max-sm:p-4">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 className="text-[24px] leading-8 font-semibold">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="-mt-1 -mr-2 grid size-11 place-items-center rounded-full text-muted hover:bg-surface-3 hover:text-ink">
              <Icon name="close" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
