'use client';
import { SignInGate } from '@/features/auth/sign-in-gate';
import { HighlightsTab } from './highlights';

export function FeedPage() {
  return (
    <>
      <header className="mt-4 mb-4 max-sm:mt-2">
        <h1 className="text-[26px] leading-8 max-sm:text-[22px]">Feed</h1>
      </header>
      <SignInGate title="Sign in to see what friends are studying" icon="flame">
        <HighlightsTab />
      </SignInGate>
    </>
  );
}
