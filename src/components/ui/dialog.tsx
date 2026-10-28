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
      className="m-auto w-[min(520px,calc(100vw-32px))] rounded-2xl border border-line bg-surface p-0 text-ink shadow-lg"
    >
      {open && (
        <div className="p-5 max-sm:p-4">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-[17px] leading-6 font-semibold">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="-mr-1.5 grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-3 hover:text-ink">
              <Icon name="close" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
