'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { Logo } from '@/components/ui/icons';
import { Toaster } from '@/components/ui/toaster';
import { hydrateStores } from '@/lib/stores/hydrate';
import { GlobalEffects } from './global-effects';
import { PrintPortal } from './print-portal';
import { ReflectionDialog } from './reflection-dialog';
import { Sidebar, Topbar } from './sidebar';

/**
 * Client shell. Progress lives in the browser (localStorage), so pages render
 * after the stores load; the server sends a light skeleton first.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    hydrateStores().then(() => setReady(true));
  }, []);
  if (!ready)
    return (
      <div className="grid min-h-dvh place-items-center" aria-busy="true">
        <div className="flex items-center gap-2.5 font-display text-[24px] font-semibold text-ink">
          <Logo /> studytime
        </div>
      </div>
    );
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <main className="mx-auto w-full max-w-[1200px] px-4 pb-16 sm:px-6 lg:px-10">
          <Topbar />
          {children}
        </main>
      </div>
      <GlobalEffects />
      <ReflectionDialog />
      <PrintPortal />
      <Toaster />
    </div>
  );
}
