'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PageHeader } from '@/components/ui/card';
import { Select } from '@/components/ui/field';
import { ConnectionPill } from '@/features/settings/ai-settings';
import { useConnection } from '@/lib/ai/client';
import { EXAMS, LANGUAGES, LEVELS, SUBJECTS, useAi } from '@/lib/stores/ai';
import { cn } from '@/lib/utils';

export const AI_TABS = [
  { href: '/ai', label: 'Snap & solve' },
  { href: '/ai/chat', label: 'Tutor chat' },
  { href: '/ai/concepts', label: 'Concept cards' },
  { href: '/ai/notes', label: 'Notes & cheatsheets' },
  { href: '/ai/assignments', label: 'Assignment helper' },
  { href: '/ai/writing', label: 'Writing' },
];

export function AiHeader() {
  const pathname = usePathname();
  const ai = useAi();
  const conn = useConnection();
  const selects = [
    { id: 'aiLevel', label: 'Level', key: 'level', list: LEVELS },
    { id: 'aiSubject', label: 'Subject', key: 'subject', list: SUBJECTS },
    { id: 'aiExam', label: 'Test prep', key: 'exam', list: EXAMS },
    { id: 'aiLanguage', label: 'Language', key: 'language', list: LANGUAGES },
  ] as const;
  return (
    <>
      <PageHeader title="AI Tutor" description="Solve problems from a photo, chat with a tutor, and turn class files into notes, flashcards and study guides." action={<ConnectionPill />} />
      {conn.mode === 'none' && conn.status && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border border-line bg-surface-3 px-4 py-3 text-[13px] leading-5 text-ink rounded-lg">
          <span><strong>No AI key is connected.</strong> A free Google AI Studio key takes about two minutes and needs no credit card.</span>
          <Link href="/settings#ai" className="inline-flex h-11 items-center border border-brand bg-brand px-4 font-medium text-bg hover:bg-brand-hover rounded-xl">Set up AI</Link>
        </div>
      )}
      <div className="mb-4 grid grid-cols-2 gap-3 border border-line bg-surface p-4 md:grid-cols-4 rounded-xl">
        {selects.map((s) => (
          <div key={s.id}>
            <label htmlFor={s.id} className="mb-1.5 block text-[12px] leading-4 font-medium text-muted">{s.label}</label>
            <Select id={s.id} value={ai[s.key]} onChange={(e) => ai.update({ [s.key]: e.target.value })}>
              {s.list.map((x) => <option key={x}>{x}</option>)}
            </Select>
          </div>
        ))}
      </div>
      <nav aria-label="AI tools" className="mb-5 flex overflow-x-auto border-b border-line [scrollbar-width:none]">
        {AI_TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <Link key={t.href} href={t.href} aria-current={active ? 'page' : undefined} className={cn('flex min-h-11 shrink-0 items-center border-b-2 px-4 text-[13px] font-medium whitespace-nowrap transition-colors', active ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink')}>
              {t.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
