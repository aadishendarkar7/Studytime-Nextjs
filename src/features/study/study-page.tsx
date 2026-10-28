'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { Icon, type IconName } from '@/components/ui/icons';
import { LEGACY_TOOL_ACTION } from '@/features/ai/actions';
import { ChatTool } from '@/features/ai/chat';
import { ConceptsTool } from '@/features/ai/concepts';
import { NotesTool } from '@/features/ai/notes';
import { LectureTool } from '@/features/ai/lectures';
import { GamesPage } from '@/features/games/games-page';
import { MistakesTool } from '@/features/games/mistakes';
import { isDue } from '@/features/games/srs';
import { ConnectionPill } from '@/features/settings/ai-settings';
import { useConnection } from '@/lib/ai/client';
import { LANGUAGES, useAi } from '@/lib/stores/ai';
import { ALL_SUBJECTS, EXAM_GROUPS, LEVELS, SUBJECT_GROUPS } from '@/lib/subjects';
import { useLearning } from '@/lib/stores/learning';
import { useProfile } from '@/lib/stores/profile';
import { cn } from '@/lib/utils';

export type Tool = 'chat' | 'notes' | 'practice' | 'mistakes' | 'concepts' | 'lectures';

const TOOLS: { id: Tool; label: string; icon: IconName; blurb: string }[] = [
  { id: 'chat', label: 'Tutor', icon: 'ai', blurb: 'Ask, solve, summarize, make cheat sheets from your files' },
  { id: 'practice', label: 'Study games', icon: 'games', blurb: 'Flashcards, quizzes, matching, speed rounds' },
  { id: 'mistakes', label: 'Mistakes', icon: 'reset', blurb: 'Questions you got wrong, to fix before the exam' },
  { id: 'notes', label: 'Notes', icon: 'file', blurb: 'Everything you saved: notes, cheat sheets, guides' },
  { id: 'lectures', label: 'Lecture recorder', icon: 'sound', blurb: 'Record a class and mark key moments' },
  { id: 'concepts', label: 'Concept cards', icon: 'bulb', blurb: 'What you have learned, and your gaps' },
];

const isTool = (v: string | null): v is Tool => TOOLS.some((t) => t.id === v);

const OTHER = '__other';

/** A select with grouped options and a "type your own" choice. */
function GroupedPick({ id, label, value, groups, none, onChange }: { id: string; label: string; value: string; groups: { group: string; items: string[] }[]; none: string; onChange: (v: string) => void }) {
  const known = value === none || groups.some((g) => g.items.includes(value));
  const [typing, setTyping] = useState(!known);
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[12px] font-semibold text-muted">{label}</label>
      <Select id={id} className="h-10" value={typing ? OTHER : value} onChange={(e) => (e.target.value === OTHER ? setTyping(true) : (setTyping(false), onChange(e.target.value)))}>
        <option value={none}>{none}</option>
        {groups.map((g) => <optgroup key={g.group} label={g.group}>{g.items.map((x) => <option key={x}>{x}</option>)}</optgroup>)}
        <option value={OTHER}>Something else (type it)</option>
      </Select>
      {typing && <Input className="mt-1.5 h-9 text-[14px]" autoFocus maxLength={60} aria-label={`Your ${label.toLowerCase()}`} placeholder={label === 'Subject' ? 'e.g. STAT 410 or Organic chemistry II' : 'e.g. Chapter 5 quiz'} defaultValue={known ? '' : value} onBlur={(e) => e.target.value.trim() && onChange(e.target.value.trim())} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />}
    </div>
  );
}

function TutorSettings() {
  const ai = useAi();
  const major = useProfile((s) => s.major);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);
  const levels = LEVELS.includes(ai.level) ? LEVELS : [ai.level, ...LEVELS];
  const summary = [ai.subject !== 'Any subject' ? ai.subject : ai.level, ai.exam !== 'None' ? ai.exam : ''].filter(Boolean).join(' · ');
  return (
    <div ref={box} className="relative">
      <Button size="sm" variant="secondary" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name="settings" className="size-4" /> <span className="max-w-[220px] truncate">{summary}</span>
      </Button>
      {open && (
        <div role="dialog" aria-label="Tutor settings" className="absolute top-11 right-0 z-40 grid w-80 gap-3 rounded-2xl border border-line bg-surface p-4 shadow-lg max-sm:w-[calc(100vw-32px)]">
          <GroupedPick id="aiSubject" label="Subject" value={ai.subject} none="Any subject" groups={SUBJECT_GROUPS} onChange={(v) => ai.update({ subject: v })} />
          {major && ai.subject === 'Any subject' && ALL_SUBJECTS.some((x) => x.toLowerCase() === major.toLowerCase()) && <button type="button" className="-mt-1.5 text-left text-[12px] font-medium text-accent-ink" onClick={() => ai.update({ subject: ALL_SUBJECTS.find((x) => x.toLowerCase() === major.toLowerCase())! })}>Use my major: {major}</button>}
          <GroupedPick id="aiExam" label="Studying for" value={ai.exam} none="None" groups={EXAM_GROUPS} onChange={(v) => ai.update({ exam: v })} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="aiLevel" className="mb-1 block text-[12px] font-semibold text-muted">Level</label>
              <Select id="aiLevel" className="h-10" value={ai.level} onChange={(e) => ai.update({ level: e.target.value })}>{levels.map((x) => <option key={x}>{x}</option>)}</Select>
            </div>
            <div>
              <label htmlFor="aiLanguage" className="mb-1 block text-[12px] font-semibold text-muted">Language</label>
              <Select id="aiLanguage" className="h-10" value={ai.language} onChange={(e) => ai.update({ language: e.target.value })}>{LANGUAGES.map((x) => <option key={x}>{x}</option>)}</Select>
            </div>
          </div>
          <ConnectionPill />
        </div>
      )}
    </div>
  );
}

function Rail({ tool, go }: { tool: Tool; go: (t: Tool) => void }) {
  const ai = useAi();
  const sets = useLearning((s) => s.sets);
  const due = sets.reduce((n, s) => n + s.cards.filter((c) => isDue(c)).length, 0);
  const mistakes = useLearning((s) => s.mistakes.length);
  const counts: Partial<Record<Tool, string>> = {
    mistakes: mistakes ? String(mistakes) : '',
    chat: ai.chats.length ? String(ai.chats.length) : '',
    notes: ai.notes.length ? String(ai.notes.length) : '',
    practice: due ? `${due} due` : sets.length ? String(sets.length) : '',
    concepts: ai.concepts.length ? String(ai.concepts.length) : '',
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

function Center({ tool, action }: { tool: Tool; action: string }) {
  switch (tool) {
    case 'chat': return <div className="h-[calc(100dvh-150px)] min-h-[560px] overflow-hidden rounded-xl border border-line bg-surface"><ChatTool initialAction={action} /></div>;
    case 'notes': return <NotesTool />;
    case 'mistakes': return <MistakesTool />;
    case 'practice': return <GamesPage embedded />;
    case 'concepts': return <ConceptsTool />;
    case 'lectures': return <LectureTool />;
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
  const tool: Tool = isTool(raw) ? raw : 'chat';
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
        <div className="flex shrink-0 items-center gap-2 pb-1.5 max-sm:justify-end">
          <TutorSettings />
          {tool !== 'chat' && (
            <Button size="sm" variant={showPanel ? 'secondary' : 'primary'} className="max-xl:hidden" onClick={() => setPanel(!panel)}>
              <Icon name="panel" className="size-4" /> {showPanel ? 'Hide tutor' : 'Show tutor'}
            </Button>
          )}
        </div>
      </header>

      {conn.mode === 'none' && conn.status && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface-2 px-4 py-3 text-[14px]">
          <span><strong>Connect the AI to use these tools.</strong> A free Google AI Studio key takes about two minutes and needs no credit card.</span>
          <Link href="/settings#ai"><Button size="sm">Set up AI</Button></Link>
        </div>
      )}

      <div className={cn('grid gap-5 [&>*]:min-w-0', showPanel && 'xl:grid-cols-[minmax(0,1fr)_380px]')}>
        <div className={cn('min-w-0', tool !== 'chat' && tool !== 'practice' && 'ws-flat rounded-xl border border-line bg-surface px-6 py-4 max-sm:px-4')}>
          <Center key={tool + (params.get('action') ?? '')} tool={tool} action={params.get('action') ?? ''} />
        </div>
        {showPanel && (
          <aside aria-label="Tutor" className="hidden overflow-hidden rounded-2xl border border-line bg-surface xl:sticky xl:top-6 xl:block xl:h-[calc(100dvh-140px)]">
            <ChatTool compact />
          </aside>
        )}
      </div>
    </>
  );
}
