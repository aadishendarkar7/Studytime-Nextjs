'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/field';
import { useProfile } from '@/lib/stores/profile';
import { toast, useUi } from '@/lib/stores/ui';
import type { Reflection } from '@/lib/types';
import { useAccount } from '@/features/auth/account';
import { ShareForm } from '@/features/feed/share-form';
import { useExtras } from '@/lib/stores/extras';

export function ReflectionDialog() {
  const open = useUi((s) => s.reflectionOpen);
  const setOpen = useUi((s) => s.setReflectionOpen);
  const addReflection = useProfile((s) => s.addReflection);
  const router = useRouter();
  const [note, setNote] = useState('');
  const [mood, setMood] = useState<Reflection['mood']>('good');
  const [share, setShare] = useState<{ minutes: number; subject: string; place: string; note: string; at: number } | null>(null);
  const signedIn = useAccount((s) => Boolean(s.user));
  const prompt = useExtras((s) => s.feedPrompt);
  const close = () => {
    setShare(null);
    setOpen(false);
    router.push('/');
  };
  if (share)
    return (
      <Dialog open={open} onClose={close} title="Save it as a highlight?">
        <p className="mb-3 text-[13px] text-muted">A recap of this session for you and the people who follow you. You can share it as an image too.</p>
        <ShareForm initial={share} onDone={close} />
        <label className="mt-4 flex items-center gap-2 text-[12px] text-muted"><input type="checkbox" className="size-3.5 accent-[var(--accent)]" checked={!prompt} onChange={(e) => useExtras.getState().update({ feedPrompt: !e.target.checked })} /> Don&rsquo;t ask after sessions (you can still add them in Drop a Spot › Highlights)</label>
      </Dialog>
    );
  return (
    <Dialog open={open} onClose={() => setOpen(false)} title="Session complete">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          addReflection({ note: note.trim(), mood });
          const last = useProfile.getState().sessions[0];
          setNote('');
          toast('Check-in saved.');
          if (signedIn && prompt && last) return setShare({ minutes: last.minutes, subject: last.subject, place: last.location, note: note.trim(), at: new Date(last.at).getTime() });
          setOpen(false);
          router.push('/');
        }}
      >
        <Field label="What did you finish or learn?" htmlFor="reflectionNote">
          <Input id="reflectionNote" maxLength={160} value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: finished problem set 4" />
        </Field>
        <Field label="How do you feel?" htmlFor="reflectionMood">
          <Select id="reflectionMood" value={mood} onChange={(e) => setMood(e.target.value as Reflection['mood'])}>
            <option value="good">Good</option>
            <option value="okay">Okay</option>
            <option value="tired">Tired</option>
          </Select>
        </Field>
        <Button type="submit" block className="mt-5">Save check-in</Button>
        
      </form>
    </Dialog>
  );
}
