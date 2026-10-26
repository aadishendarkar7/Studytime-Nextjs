'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AiError, callAI, type CallOptions } from '@/lib/ai/client';

/** Runs a streaming AI call and exposes its live text, status, and errors. */
export function useAiRun() {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [error, setError] = useState<AiError | null>(null);
  const controller = useRef<AbortController | null>(null);
  const frame = useRef<number | null>(null);
  const pending = useRef('');

  useEffect(() => () => controller.current?.abort(), []);
  const cancelFrame = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  };

  const run = useCallback(async (options: Omit<CallOptions, 'onText' | 'signal'>) => {
    controller.current?.abort();
    const ac = new AbortController();
    controller.current = ac;
    pending.current = '';
    setText('');
    setError(null);
    setStatus('running');
    try {
      const result = await callAI({
        ...options,
        signal: ac.signal,
        onText: (t) => {
          pending.current = t;
          if (frame.current === null) frame.current = requestAnimationFrame(() => ((frame.current = null), setText(pending.current)));
        },
      });
      cancelFrame();
      setText(result);
      setStatus('done');
      return result;
    } catch (e) {
      cancelFrame();
      if ((e as Error).name === 'AbortError') {
        // Stopped by the student: keep whatever arrived so far.
        const partial = pending.current;
        setText(partial);
        setStatus(partial ? 'done' : 'idle');
        return partial ? `${partial}\n\n*(stopped)*` : null;
      }
      setError(e instanceof AiError ? e : new AiError((e as Error).message));
      setStatus('error');
      return null;
    }
  }, []);

  const stop = useCallback(() => controller.current?.abort(), []);
  const reset = useCallback(() => (controller.current?.abort(), setText(''), setStatus('idle'), setError(null)), []);
  return { text, status, error, run, stop, reset, setText, running: status === 'running' };
}
