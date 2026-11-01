'use client';
import { useAccount } from '@/features/auth/account';
import { FeedPreview } from './feed-preview';
import { HighlightsTab } from './highlights';

export function FeedPage() {
  const user = useAccount((s) => s.user);
  return (
    <>
      <header className="mt-4 mb-4 max-sm:mt-2">
        <h1 className="text-[26px] leading-8 max-sm:text-[22px]">Feed</h1>
      </header>
      {user ? <HighlightsTab /> : <FeedPreview />}
    </>
  );
}
