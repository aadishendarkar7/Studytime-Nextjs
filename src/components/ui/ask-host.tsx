'use client';
import { useEffect, useRef, useState } from 'react';
import { settle, useAsk } from '@/lib/stores/ask';
import { Button } from './button';

/** Shows askConfirm() and askText() requests as a dialog inside the page. Mount once. */
export function AskHost() {
  const req = useAsk((s) => s.current);
  const ref = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState('');
  const [seen, setSeen] = useState<typeof req>(null);
  if (req !== seen) {
    setSeen(req);
    setText(req?.value ?? '');
  }
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (req && !d.open) d.showModal();
    if (!req && d.open) d.close();
  }, [req]);
  const no = () => settle(req?.kind === 'prompt' ? null : false);
  const yes = () => settle(req?.kind === 'prompt' ? text : true);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => (e.preventDefault(), no())}
      onClick={(e) => e.target === ref.current && no()}
      aria-labelledby="askTitle"
      className="st-ask m-auto w-[min(420px,calc(100vw-32px))] rounded-[12px] border border-line bg-surface p-0 text-ink shadow-[0_24px_60px_-12px_rgba(0,0,0,0.35)] backdrop:bg-black/45 backdrop:backdrop-blur-[2px]"
    >
      {req && (
        <form
          className="p-5"
          onSubmit={(e) => {
            e.preventDefault();
            yes();
          }}
        >
          <h2 id="askTitle" className="text-[16px] leading-6 font-semibold">{req.title ?? (req.kind === 'prompt' ? req.message : req.message)}</h2>
          {req.title && <p className="mt-1 text-[14px] leading-5 text-ink-2">{req.message}</p>}
          {req.kind === 'prompt' && (
            <input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={req.placeholder}
              maxLength={200}
              aria-label={req.message}
              className="mt-3 h-10 w-full rounded-[8px] border border-line bg-surface px-3 text-[14px] outline-none focus:border-ink"
            />
          )}
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={no}>Cancel</Button>
            <Button type="submit" variant={req.danger ? 'destructive' : 'primary'} autoFocus={req.kind === 'confirm'}>{req.ok}</Button>
          </div>
        </form>
      )}
    </dialog>
  );
}
