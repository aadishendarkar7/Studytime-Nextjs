'use client';
import { useEffect, useState, type ReactNode } from 'react';
import Noise from '@/components/bits/Noise';
import { Logo } from '@/components/ui/icons';
import { Toaster } from '@/components/ui/toaster';
import { DropComposerHost } from '@/features/drop/composer';
import { startAccount, useAccount } from '@/features/auth/account';
import { Welcome } from '@/features/auth/welcome';
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
  const user = useAccount((s) => s.user);
  useEffect(() => {
    void startAccount().then(() => setReady(true));
  }, []);
  if (ready && user && !user.onboarded) return <><Welcome /><Toaster /></>;
  if (!ready)
    return (
      <div className="grid min-h-dvh place-items-center" aria-busy="true">
        <div className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-ink">
          <Logo className="size-9" /> Studytime
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
      {/* A fine, still film grain over everything, so flat colors read like paper instead of plastic. */}
      <Noise fixed fps={0} opacity={0.05} blendMode="overlay" contrast={0.5} zIndex={60} />
      <BottomTabs />
      <Toaster />
    </div>
  );
}
