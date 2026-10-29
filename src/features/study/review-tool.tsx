'use client';
import { useState } from 'react';
import { Segmented } from '@/components/ui/segmented';
import { ConceptsTool } from '@/features/ai/concepts';
import { MistakesTool } from '@/features/games/mistakes';
import { useAi } from '@/lib/stores/ai';
import { useLearning } from '@/lib/stores/learning';

/** What to go back over: questions you missed, and the concepts you have met. */
export function ReviewTool({ start = 'mistakes' }: { start?: 'mistakes' | 'concepts' }) {
  const mistakes = useLearning((s) => s.mistakes.length);
  const concepts = useAi((s) => s.concepts.length);
  const [view, setView] = useState<'mistakes' | 'concepts'>(start);
  return (
    <div className="grid gap-4">
      <Segmented label="Review" value={view} onChange={setView} options={[{ value: 'mistakes', label: `Mistakes${mistakes ? ` · ${mistakes}` : ''}` }, { value: 'concepts', label: `Concepts${concepts ? ` · ${concepts}` : ''}` }]} />
      {view === 'mistakes' ? <MistakesTool /> : <ConceptsTool />}
    </div>
  );
}
