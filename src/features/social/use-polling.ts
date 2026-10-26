'use client';
import { useEffect, useEffectEvent } from 'react';

/** Run `fn` now and every `ms` while the tab is visible. Re-runs immediately when `key` changes. */
export function usePolling(fn: () => unknown, ms: number, enabled = true, key?: unknown) {
  const tick = useEffectEvent(() => {
    if (!document.hidden) fn();
  });
  useEffect(() => {
    if (!enabled) return;
    tick();
    const id = setInterval(tick, ms);
    return () => clearInterval(id);
  }, [ms, enabled, key]);
}
