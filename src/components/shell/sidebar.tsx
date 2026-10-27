'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, Logo } from '@/components/ui/icons';
import { SoundDock } from '@/features/sounds/sound-dock';
import { useProfile } from '@/lib/stores/profile';
import { cn } from '@/lib/utils';
import { isActive, NAV_GROUPS } from './nav';

function Wordmark({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn('flex items-center gap-2.5 font-display text-[24px] leading-8 text-ink', className)}>
      <Logo className="size-8" /> studytime
    </Link>
  );
}

function LegalLinks({ className }: { className?: string }) {
  return (
    <div className={cn('flex gap-4 text-[13px] leading-5 text-muted', className)}>
      <Link href="/privacy" className="hover:text-ink hover:underline">Privacy</Link>
      <Link href="/terms" className="hover:text-ink hover:underline">Terms</Link>
    </div>
  );
}

function NavList({ pathname, large }: { pathname: string; large?: boolean }) {
  return (
    <>
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="mt-4 first:mt-0">
          <p className="mb-1 px-3 text-[12px] leading-4 font-semibold text-muted">{group.label}</p>
          <div className="grid gap-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 font-medium transition-colors',
                    large ? 'min-h-12 text-[16px]' : 'h-9 text-[14px]',
                    active ? 'bg-accent-soft text-accent-ink' : 'text-ink-2 hover:bg-surface-3 hover:text-ink',
                  )}
                >
                  <Icon name={item.icon} className="size-[19px]" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const name = useProfile((s) => s.name.trim() || 'Student');
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface/90 px-3 pt-6 pb-4 lg:flex">
      <Wordmark className="mx-3 mb-5" />
      <nav aria-label="Main navigation" className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
        <NavList pathname={pathname} />
      </nav>
      <div className="mt-3 grid gap-3 border-t border-line pt-3">
        <SoundDock />
        <Link href="/profile" className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-surface-3">
          <span className="grid size-9 place-items-center rounded-full bg-accent-soft text-[14px] font-semibold text-accent-ink">{name[0].toUpperCase()}</span>
          <span className="min-w-0">
            <strong className="block truncate text-[14px] font-semibold">{name}</strong>
            <small className="text-[13px] text-muted">View profile</small>
          </span>
        </Link>
        <LegalLinks className="px-2" />
      </div>
    </aside>
  );
}

export function Topbar() {
  const pathname = usePathname();
  // The menu is open only for the page it was opened on, so navigating closes it.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenAt(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  return (
    <>
      <header className="z-30 flex h-16 max-lg:sticky max-lg:top-0 items-center justify-between gap-4 text-[14px] text-muted max-lg:-mx-4 max-lg:border-b max-lg:border-line max-lg:bg-surface/95 max-lg:px-4 sm:max-lg:-mx-6 sm:max-lg:px-6 lg:justify-end">
        <Wordmark className="lg:hidden" />
        <div className="flex items-center gap-4">
          <span className="tnum max-sm:hidden">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
          <button
            type="button"
            onClick={() => setOpenAt(open ? null : pathname)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="grid size-11 place-items-center rounded-xl border border-line bg-surface text-ink lg:hidden"
          >
            <Icon name={open ? 'close' : 'menu'} />
          </button>
        </div>
      </header>
      {open && (
        <nav id="mobile-menu" aria-label="Main navigation" className="fixed inset-x-0 top-16 bottom-0 z-20 overflow-y-auto bg-surface px-4 pt-4 pb-8 sm:px-6 lg:hidden">
          <NavList pathname={pathname} large />
          <div className="mt-6 border-t border-line pt-4">
            <SoundDock />
          </div>
          <LegalLinks className="mt-6 px-3" />
        </nav>
      )}
    </>
  );
}
