'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './icons';

/** A panel that slides in from the right edge, for tools that sit beside the main view. */
export function Sheet({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
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
      className={`m-0 ml-auto h-dvh max-h-dvh ${wide ? 'w-[min(720px,100vw)]' : 'w-[min(560px,100vw)]'} max-w-none rounded-l-2xl border-l border-line bg-surface p-0 text-ink shadow-lg`}
    >
      {open && (
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5 max-sm:px-4">
            <h2 className="truncate text-[17px] leading-6">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-3 hover:text-ink"><Icon name="close" /></button>
          </div>
          <div className="ws-flat min-h-0 flex-1 overflow-y-auto px-5 py-4 max-sm:px-4">{children}</div>
        </div>
      )}
    </dialog>
  );
}
