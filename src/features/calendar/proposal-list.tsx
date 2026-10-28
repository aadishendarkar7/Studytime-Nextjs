'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/lib/stores/ui';
import { plural } from '@/lib/utils';
import { timeRange } from './block-row';
import type { Proposal } from './plan';
import { acceptProposals } from './sync';

/** Suggested blocks with checkboxes; the student keeps the ones they want. */
export function ProposalList({ proposals, onDone }: { proposals: Proposal[]; onDone: () => void }) {
  const [picked, setPicked] = useState(() => new Set(proposals.map((_, i) => i)));
  if (!proposals.length) return null;
  return (
    <div className="mt-4">
      <ul className="grid gap-1.5">
        {proposals.map((p, i) => (
          <li key={i}>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg bg-surface-2 px-3 py-2">
              <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={picked.has(i)} onChange={(e) => setPicked((s) => { const n = new Set(s); if (e.target.checked) n.add(i); else n.delete(i); return n; })} />
              <span className="min-w-0"><strong className="block truncate text-[14px] font-semibold">{p.title}</strong><span className="tnum text-[13px] text-muted">{timeRange(p)}</span></span>
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <Button onClick={() => { const n = acceptProposals(proposals.filter((_, i) => picked.has(i))).length; toast(`${plural(n, 'study block')} added to your calendar.`); onDone(); }} disabled={!picked.size}>Add {picked.size} to my calendar</Button>
        <Button variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  );
}
