'use client';
import { useState } from 'react';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Note } from '@/components/ui/field';
import { Icon } from '@/components/ui/icons';
import { useExtras } from '@/lib/stores/extras';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import { uid } from '@/lib/utils';

/** Write down a distracting thought so it is out of your head, then deal with it after the session. */
export function ParkingLot({ className }: { className?: string }) {
  const { parked, update } = useExtras();
  const addReminder = useProfile((s) => s.addReminder);
  const [text, setText] = useState('');
  const open = parked.filter((t) => !t.done);
  const remove = (id: string) => update({ parked: parked.filter((t) => t.id !== id) });
  const remindTomorrow = (id: string, title: string) => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    addReminder({ title: title.slice(0, 120), type: 'homework', dueAt: d.getTime(), lead: 0 });
    remove(id);
    toast('Added to your planner for tomorrow morning.');
  };
  return (
    <Card className={className}>
      <CardHeader title="Parking lot" description="A thought pulling you away? Park it here and get back to work. Deal with it after the session." />
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!text.trim()) return; update({ parked: [{ id: uid(), text: text.trim().slice(0, 200), at: Date.now(), done: false }, ...parked].slice(0, 100) }); setText(''); }}>
        <Input aria-label="Thought to park" placeholder="Email professor about the lab, pay phone bill..." value={text} maxLength={200} onChange={(e) => setText(e.target.value)} />
        <Button type="submit" variant="secondary">Park it</Button>
      </form>
      {open.length > 0 && (
        <ul className="mt-3 grid gap-1.5">
          {open.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-2 py-1.5 pr-1.5 pl-3 text-[14px]">
              <span className="min-w-0 flex-1">{t.text}</span>
              <Button size="sm" variant="ghost" onClick={() => remindTomorrow(t.id, t.text)}>Remind me tomorrow</Button>
              <button type="button" aria-label={`Done: ${t.text}`} onClick={() => remove(t.id)} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-3 hover:text-ink max-sm:size-11"><Icon name="check" className="size-4" /></button>
            </li>
          ))}
        </ul>
      )}
      {!open.length && <Note>Nothing parked.</Note>}
    </Card>
  );
}
