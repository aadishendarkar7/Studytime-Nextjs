'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icons';
import { LEGACY_TOOL_ACTION } from '@/features/ai/actions';
import { ChatTool } from '@/features/ai/chat';
import { NotesTool } from '@/features/ai/notes';
import { CoursesTool } from '@/features/courses/courses-tool';
import { GamesPage } from '@/features/games/games-page';
import { isDue } from '@/features/games/srs';
import { useConnection } from '@/lib/ai/client';
import { useExtras } from '@/lib/stores/extras';
import { useLearning } from '@/lib/stores/learning';
import { cn } from '@/lib/utils';

export type Tool = 'chat' | 'practice' | 'notes' | 'courses';

const TOOLS: { id: Tool; label: string; icon: IconName; blurb: string }[] = [
  { id: 'chat', label: 'Tutor', icon: 'ai', blurb: 'Ask, solve, summarize, practice tests' },
  { id: 'practice', label: 'Flashcards', icon: 'games', blurb: 'Your sets: review, quiz, match' },
  { id: 'notes', label: 'Notes', icon: 'file', blurb: 'Notes and lecture recordings' },
  { id: 'courses', label: 'Courses', icon: 'layers', blurb: 'Short courses on any topic, made for you' },
];

/** Older links that now open inside another tool. */
const MOVED: Record<string, Tool> = { lectures: 'notes', mistakes: 'practice', concepts: 'chat', review: 'practice' };
const isTool = (v: string | null): v is Tool => TOOLS.some((t) => t.id === v);

function Rail({ tool, go }: { tool: Tool; go: (t: Tool) => void }) {
  const sets = useLearning((s) => s.sets);
  const due = sets.reduce((n, s) => n + s.cards.filter((c) => isDue(c)).length, 0);
  const courses = useExtras((s) => s.courses.length);
  const counts: Partial<Record<Tool, string>> = {
    practice: due ? `${due} due` : '',
    courses: courses ? String(courses) : '',
  };
  return (
    <nav aria-label="Study tools" className="-mx-4 min-w-0 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
      <div className="flex w-max gap-1 border-b border-line sm:w-auto">
        {TOOLS.map((t) => (
          <button key={t.id} type="button" title={t.blurb} onClick={() => go(t.id)} aria-current={tool === t.id ? 'page' : undefined} className={cn('-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 py-2 text-[14px] whitespace-nowrap transition-colors', tool === t.id ? 'border-accent font-medium text-ink' : 'border-transparent text-muted hover:text-ink')}>
            <Icon name={t.icon} className={cn('size-4', tool === t.id ? 'text-accent' : 'text-muted')} /> {t.label}
            {counts[t.id] && <span className={cn('rounded-md px-1.5 text-[11px] font-semibold leading-[18px]', t.id === 'practice' && due ? 'bg-accent-fill text-white' : 'bg-surface-3 text-muted')}>{counts[t.id]}</span>}
          </button>
        ))}
      </div>
    </nav>
  );
}

function Center({ tool, action, from }: { tool: Tool; action: string; from: string | null }) {
  switch (tool) {
    case 'chat': return <div className="h-[calc(100dvh-150px)] min-h-[560px] overflow-hidden panel"><ChatTool initialAction={action} /></div>;
    case 'notes': return <NotesTool startRecording={from === 'lectures'} />;
    case 'practice': return <GamesPage embedded />;
    case 'courses': return <CoursesTool />;
  }
}

/**
 * One workspace for studying: tools on the left, the open tool in the middle,
 * and the tutor beside it on wide screens so you can ask about what you are looking at.
 */
export function StudyPage() {
  const params = useSearchParams();
  const router = useRouter();
  const raw = params.get('tool');
  const moved = raw ? MOVED[raw] : undefined;
  const tool: Tool = isTool(raw) ? raw : moved ?? 'chat';
  // Snap & solve, the assignment helper and writing feedback are tutor actions now.
  useEffect(() => {
    if (raw && LEGACY_TOOL_ACTION[raw]) router.replace(`/study?action=${LEGACY_TOOL_ACTION[raw]}`, { scroll: false });
  }, [raw, router]);
  const conn = useConnection();
  // The tutor sits beside tools only when there is room for both.
  const [panel, setPanel] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1360);
  const go = (t: Tool) => router.replace(t === 'chat' ? '/study' : `/study?tool=${t}`, { scroll: false });
  const current = TOOLS.find((t) => t.id === tool)!;
  const showPanel = panel && tool !== 'chat';

  return (
    <>
      <h1 className="sr-only">{current.label}</h1>
      <header className="mt-3 mb-4 flex items-end gap-3 max-sm:mt-1 max-sm:flex-col-reverse max-sm:items-stretch">
        <div className="min-w-0 flex-1"><Rail tool={tool} go={go} /></div>
      </header>

      {conn.mode === 'none' && conn.status && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface-2 px-4 py-3 text-[14px]">
          <span><strong>The AI tutor is not available on this site yet.</strong> You can still use it by adding your own free Google AI Studio key.</span>
          <Link href="/settings#ai"><Button size="sm" variant="secondary">Use my own key</Button></Link>
        </div>
      )}

      <div className={cn('grid gap-5 [&>*]:min-w-0', showPanel && 'xl:grid-cols-[minmax(0,1fr)_380px]', tool !== 'chat' && !panel && 'xl:pr-10')}>
        <div className={cn('min-w-0', tool !== 'chat' && tool !== 'practice' && tool !== 'courses' && 'ws-flat panel px-6 py-4 max-sm:px-4')}>
          <Center key={tool + (params.get('action') ?? '')} tool={tool} action={params.get('action') ?? ''} from={moved ? raw : null} />
        </div>
        {showPanel && (
          <aside aria-label="Tutor" className="panel hidden overflow-hidden xl:sticky xl:top-[72px] xl:block xl:h-[calc(100dvh-140px)]">
            <ChatTool compact onHide={() => setPanel(false)} />
          </aside>
        )}
        {/* Folded away, the tutor leaves a tab on the right edge to bring it back. */}
        {tool !== 'chat' && !panel && (
          <button type="button" onClick={() => setPanel(true)} aria-label="Show tutor" className="panel fixed top-1/3 right-0 z-20 hidden flex-col items-center gap-2 rounded-r-none border-r-0 px-2.5 py-4 text-[13px] font-semibold text-ink xl:flex">
            <Icon name="chat" className="size-4 text-accent" />
            <span className="[writing-mode:vertical-rl]">Tutor</span>
          </button>
        )}
      </div>
    </>
  );
}
