'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { Avatar, useAvatarVersion } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAccount } from '@/features/auth/account';
import { signInHref } from '@/features/auth/sign-in-gate';
import { api } from '@/lib/api';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';

/** Crops the middle square of a photo and shrinks it to 256×256, small enough to upload quickly. */
async function squareImage(file: File) {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  c.getContext('2d')!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, 256, 256);
  bmp.close();
  for (const q of [0.85, 0.7, 0.55]) {
    const url = c.toDataURL('image/jpeg', q);
    if (url.length < 110_000) return url;
  }
  throw new Error('That picture is too detailed. Try another.');
}

export function PictureCard() {
  const user = useAccount((s) => s.user);
  const name = useProfile((s) => s.name) || 'Student';
  const bump = useAvatarVersion((s) => s.bump);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File | undefined) => {
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) return toast('Pick an image file.', 'error');
    setBusy(true);
    try {
      await api.auth.avatar(await squareImage(file));
      bump(user.id);
      toast('Profile picture updated.');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };
  const remove = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await api.auth.removeAvatar();
      bump(user.id);
      toast('Picture removed.');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="flex flex-wrap items-center gap-4 lg:col-span-12">
      <Avatar name={name} size={72} userId={user?.id} className="bg-accent-fill text-white" />
      <div className="min-w-0 flex-1">
        <h2 className="font-sans text-[16px] font-semibold">Profile picture</h2>
        <p className="text-[13px] text-muted">{user ? 'Friends see it on your posts, in Friends and in the sidebar.' : 'Sign in to add a profile picture.'}</p>
      </div>
      {user ? (
        <div className="flex gap-2">
          <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => void upload(e.target.files?.[0])} />
          <Button loading={busy} onClick={() => input.current?.click()}>Upload photo</Button>
          <Button variant="ghost" disabled={busy} onClick={remove}>Remove</Button>
        </div>
      ) : (
        <Link href={signInHref('signin')}><Button variant="secondary">Sign in</Button></Link>
      )}
    </Card>
  );
}
