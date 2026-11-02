'use client';
import { create } from 'zustand';

/**
 * In-app replacements for the browser's confirm() and prompt(), which open a grey
 * system box outside the page. These open a dialog inside Studytime instead.
 */
export interface AskRequest {
  kind: 'confirm' | 'prompt';
  message: string;
  title?: string;
  ok: string;
  danger: boolean;
  value?: string;
  placeholder?: string;
  resolve: (v: boolean | string | null) => void;
}

export const useAsk = create<{ current: AskRequest | null; queue: AskRequest[] }>(() => ({ current: null, queue: [] }));

function push(req: AskRequest) {
  const s = useAsk.getState();
  if (s.current) useAsk.setState({ queue: [...s.queue, req] });
  else useAsk.setState({ current: req });
}
export function settle(value: boolean | string | null) {
  const { current, queue } = useAsk.getState();
  current?.resolve(value);
  useAsk.setState({ current: queue[0] ?? null, queue: queue.slice(1) });
}

const DANGER = /^(delete|remove|block|end|cancel|leave|disconnect|turn off|clear|stop|replace)\b/i;
/** "Delete this note?" gets a red "Delete" button; anything else gets "OK". */
const verb = (m: string) => {
  const w = DANGER.exec(m.trim())?.[1];
  return w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : null;
};

export function askConfirm(message: string, opts: { title?: string; ok?: string; danger?: boolean } = {}) {
  const v = verb(message);
  return new Promise<boolean>((resolve) => push({ kind: 'confirm', message, title: opts.title, ok: opts.ok ?? v ?? 'OK', danger: opts.danger ?? Boolean(v), resolve: (x) => resolve(x === true) }));
}

export function askText(message: string, opts: { title?: string; ok?: string; value?: string; placeholder?: string } = {}) {
  return new Promise<string | null>((resolve) => push({ kind: 'prompt', message, title: opts.title, ok: opts.ok ?? 'Save', danger: false, value: opts.value ?? '', placeholder: opts.placeholder, resolve: (x) => resolve(typeof x === 'string' ? x : null) }));
}
