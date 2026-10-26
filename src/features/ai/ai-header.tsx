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
      <PageHeader eyebrow="AI STUDY COMPANION" title="AI Tutor" description="Snap a problem, chat with a tutor, and turn class materials into notes, flashcards, and study guides." action={<ConnectionPill />} />
      {conn.mode === 'none' && conn.status && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warn/30 bg-warn-soft px-5 py-4 text-sm text-warn">
          <span><strong>Connect a free AI key to start.</strong> Get one from Google AI Studio in about 2 minutes — no credit card.</span>
          <Link href="/settings#ai" className="rounded-lg bg-brand px-3.5 py-2 font-semibold text-white">Set up AI</Link>
        </div>
      )}
      <div className="mb-4 grid grid-cols-2 gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card md:grid-cols-4">
        {selects.map((s) => (
          <div key={s.id}>
            <label htmlFor={s.id} className="mb-1.5 block text-[11px] font-bold tracking-[0.08em] text-muted uppercase">{s.label}</label>
            <Select id={s.id} value={ai[s.key]} onChange={(e) => ai.update({ [s.key]: e.target.value })}>
              {s.list.map((x) => <option key={x}>{x}</option>)}
            </Select>
          </div>
        ))}
      </div>
      <nav aria-label="AI tools" className="mb-5 flex gap-1 overflow-x-auto rounded-2xl bg-surface-3 p-1 [scrollbar-width:none]">
        {AI_TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <Link key={t.href} href={t.href} aria-current={active ? 'page' : undefined} className={cn('flex-1 shrink-0 rounded-xl px-4 py-2.5 text-center text-sm font-semibold whitespace-nowrap transition-colors', active ? 'bg-surface text-ink shadow-sm' : 'text-ink-2/75 hover:text-ink')}>
              {t.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
