'use client';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { toast } from '@/lib/stores/ui';
import { copyText, plural } from '@/lib/utils';
import { useAccount } from './account';

export const inviteLink = (id: string) => `${location.origin}/invite/${id}`;

export async function shareInvite(id: string, name: string) {
  const url = inviteLink(id);
  const text = `${name} invited you to Studytime. See where friends are studying and study together.`;
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Join me on Studytime', text, url });
      return;
    } catch {
      /* closed the share sheet */
    }
  }
  toast((await copyText(url)) ? 'Invite link copied.' : url);
}

/** Your personal invite link. Friends who join follow you back, and you get a mystery pack. */
export function InviteCard({ className }: { className?: string }) {
  const user = useAccount((s) => s.user);
  if (!user) return null;
  return (
    <section className={className ?? 'rounded-xl border border-line bg-surface p-4'}>
      <h2 className="font-sans text-[15px] font-semibold">Invite friends</h2>
      <p className="mt-0.5 text-[12px] leading-5 text-muted">Friends who join from your link follow you right away, and you get a mystery pack for each one.{user.invites ? ` ${plural(user.invites, 'friend')} joined so far.` : ''}</p>
      <Button size="sm" className="mt-3" onClick={() => void shareInvite(user.id, user.name)}><Icon name="send" className="size-4" /> Share invite link</Button>
    </section>
  );
}
