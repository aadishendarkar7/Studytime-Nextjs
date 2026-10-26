'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Note, Select } from '@/components/ui/field';
import { useProfile } from '@/lib/stores/profile';
import { toast, useUi } from '@/lib/stores/ui';
import type { Reflection } from '@/lib/types';

export function ReflectionDialog() {
  const open = useUi((s) => s.reflectionOpen);
  const setOpen = useUi((s) => s.setReflectionOpen);
  const addReflection = useProfile((s) => s.addReflection);
  const router = useRouter();
  const [note, setNote] = useState('');
  const [mood, setMood] = useState<Reflection['mood']>('good');
  return (
    <Dialog open={open} onClose={() => setOpen(false)} eyebrow="SESSION COMPLETE" title="How did it go?">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          addReflection({ note: note.trim(), mood });
          setNote('');
          setOpen(false);
          router.push('/');
          toast('Check-in saved. Plan your next session whenever you are ready.');
        }}
      >
        <Field label="What did you finish or learn?" htmlFor="reflectionNote">
          <Input id="reflectionNote" maxLength={160} value={note} onChange={(e) => setNote(e.target.value)} placeholder="One small win is enough" />
        </Field>
        <Field label="How do you feel now?" htmlFor="reflectionMood">
          <Select id="reflectionMood" value={mood} onChange={(e) => setMood(e.target.value as Reflection['mood'])}>
            <option value="good">Good</option>
            <option value="okay">Okay</option>
            <option value="tired">Tired</option>
          </Select>
        </Field>
        <Button type="submit" block className="mt-5">Save check-in</Button>
        <Note>Reflect briefly, then plan when to return for your next session.</Note>
      </form>
    </Dialog>
  );
}
