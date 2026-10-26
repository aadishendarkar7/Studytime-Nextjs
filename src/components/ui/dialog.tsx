'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { Eyebrow } from './card';
import { Icon } from './icons';

export function Dialog({ open, onClose, eyebrow, title, children }: { open: boolean; onClose: () => void; eyebrow?: string; title: string; children: ReactNode }) {
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
      className="m-auto w-[min(560px,calc(100vw-32px))] rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl"
    >
      {open && (
        <div className="p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
              <h2 className="mt-1 text-xl font-bold">{title}</h2>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-muted hover:bg-surface-3">
              <Icon name="close" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
