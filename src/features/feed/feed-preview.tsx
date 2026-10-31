'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { signInHref } from '@/features/auth/sign-in-gate';
import type { FeedPost } from '@/lib/types';
import { HighlightCard } from './highlights';

const H = 3_600_000;
const sample = (p: Partial<FeedPost> & Pick<FeedPost, 'id' | 'name' | 'minutes' | 'subject'>, hoursAgo: number): FeedPost => ({
  userId: `sample-${p.id}`,
  school: '',
  major: '',
  topics: [],
  place: '',
  with: [],
  note: '',
  visibility: 'everyone',
  kudos: [],
  kudosNames: [],
  ...p,
  at: Date.now() - hoursAgo * H,
});

/** Example posts so the Feed doesn't look empty to visitors. They are not real people. */
const SAMPLES: FeedPost[] = [
  sample({ id: 'a', name: 'Maya', minutes: 135, subject: 'Organic Chemistry', topics: ['Reaction mechanisms', 'SN1 vs SN2'], place: 'Main library, 3rd floor', note: 'Finally get stereochemistry. Flashcards for the rest tomorrow.', kudos: ['x', 'y', 'z'], kudosNames: ['Jordan', 'Priya', 'Sam'] }, 1),
  sample({ id: 'b', name: 'Leo', minutes: 90, subject: 'Calculus II', topics: ['Integration by parts'], place: 'Student center', with: ['Ana'], kudos: ['x'], kudosNames: ['Chris'] }, 3),
  sample({ id: 'c', name: 'Aisha', minutes: 60, subject: 'Spanish', topics: ['Subjunctive'], note: 'Quiz mode streak: 6 days.', kudos: ['x', 'y'], kudosNames: ['Noah', 'Lily'] }, 6),
];

export function FeedPreview() {
  return (
    <div className="mx-auto grid max-w-xl gap-4">
      <p className="flex items-center gap-1.5 text-[13px] text-muted"><Icon name="flame" className="size-4" /> Example posts. Sign in to see what real students near you are studying.</p>
      <div className="relative">
        <div inert aria-hidden="true" className="grid gap-4 select-none">
          {SAMPLES.map((p) => <HighlightCard key={p.id} post={p} onChange={() => {}} />)}
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-bg via-bg/85 to-transparent" />
      </div>
      <div className="-mt-24 relative flex flex-col items-center rounded-2xl border border-line bg-surface px-6 py-8 text-center shadow-sm">
        <h2 className="text-[20px] leading-7 font-semibold">Sign in for more</h2>
        <p className="mt-1 text-[14px] text-muted">Follow friends, cheer their sessions and post your own. Free.</p>
        <div className="mt-5 flex gap-2">
          <Link href={signInHref('signup')}><Button>Create account</Button></Link>
          <Link href={signInHref('signin')}><Button variant="secondary">Sign in</Button></Link>
        </div>
      </div>
    </div>
  );
}
