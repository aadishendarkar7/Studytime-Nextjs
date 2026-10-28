'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { Logo } from '@/components/ui/icons';
import { Toaster } from '@/components/ui/toaster';
import { DropComposerHost } from '@/features/drop/composer';
import { WaterPrompt } from '@/features/wellbeing/water-prompt';
import { PopQuiz } from '@/features/games/pop-quiz';
import { hydrateStores } from '@/lib/stores/hydrate';
import { GlobalEffects } from './global-effects';
import { PrintPortal } from './print-portal';
import { ReflectionDialog } from './reflection-dialog';
import { BottomTabs, Sidebar, Topbar } from './sidebar';

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
        <div className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-ink">
          <Logo className="size-6" /> Studytime
        </div>
      </div>
    );
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <Topbar />
        <main className="mx-auto w-full max-w-[1320px] px-4 pt-2 pb-28 sm:px-6 lg:px-8 lg:pb-16">
          {children}
        </main>
      </div>
      <GlobalEffects />
      <ReflectionDialog />
      <PrintPortal />
      <DropComposerHost />
      <WaterPrompt />
      <PopQuiz />
      <BottomTabs />
      <Toaster />
    </div>
  );
}
