'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icons';
import { useAccount } from './account';

/** Where to send someone to sign in, so they come straight back here after. */
export const signInHref = (mode: 'signin' | 'signup' = 'signup') => {
  const here = typeof location === 'undefined' ? '/' : location.pathname + location.search;
  return `/signin?mode=${mode}&next=${encodeURIComponent(here)}`;
};

/** Shows its children to signed-in people, and a short sign-in card to everyone else. */
export function SignInGate({ title, icon = 'user', children }: { title: string; icon?: IconName; children: ReactNode }) {
  const user = useAccount((s) => s.user);
  if (user) return <>{children}</>;
  return (
    <div className="mx-auto flex max-w-md flex-col items-center rounded-2xl border border-line bg-surface px-6 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent-ink"><Icon name={icon} className="size-6" /></span>
      <h2 className="mt-4 text-[20px] leading-7 font-semibold">{title}</h2>
      <p className="mt-1 text-[14px] text-muted">Free, and your progress so far comes with you.</p>
      <div className="mt-5 flex gap-2">
        <Link href={signInHref('signup')}><Button>Create account</Button></Link>
        <Link href={signInHref('signin')}><Button variant="secondary">Sign in</Button></Link>
      </div>
    </div>
  );
}
