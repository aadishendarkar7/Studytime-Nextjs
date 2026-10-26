'use client';
import { useEffect, useState } from 'react';

/** Current time, refreshed every `ms` (keeps "overdue" labels and countdowns live). */
export function useNow(ms = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
