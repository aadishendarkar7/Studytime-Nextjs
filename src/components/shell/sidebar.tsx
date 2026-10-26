'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, Logo } from '@/components/ui/icons';
import { useProfile } from '@/lib/stores/profile';
import { cn } from '@/lib/utils';
import { isActive, NAV } from './nav';

export function Sidebar() {
  const pathname = usePathname();
  const name = useProfile((s) => s.name.trim() || 'Student');
  return (
    <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col border-r border-line bg-surface px-4 pt-8 pb-5 lg:flex">
      <Link href="/" className="mx-2 mb-9 flex items-center gap-2.5 font-display text-[22px] font-extrabold tracking-[-0.04em] text-ink">
        <Logo /> studytime
      </Link>
      <div className="mb-3 px-3 text-[11px] font-bold tracking-[0.12em] text-muted">YOUR SPACE</div>
      <nav aria-label="Main navigation" className="grid gap-1">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={cn('flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors', active ? 'bg-accent-soft text-accent-ink' : 'text-ink-2/80 hover:bg-surface-3 hover:text-ink')}>
              <Icon name={item.icon} />
              {item.label}
              {item.badge && <em className="ml-auto rounded-md bg-accent px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider text-white not-italic">{item.badge}</em>}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto">
        <div className="mb-4 rounded-2xl bg-accent-soft px-4 py-4">
          <strong className="text-[13px] text-ink">One session at a time.</strong>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">Small, steady steps add up to something big.</p>
        </div>
        <Link href="/settings" className={cn('flex items-center gap-3 border-t border-line px-1 pt-4 text-ink', pathname === '/settings' && 'text-accent-ink')}>
          <span className="grid size-9 place-items-center rounded-full bg-accent-soft text-[13px] font-extrabold text-accent-ink">{name[0].toUpperCase()}</span>
          <span className="min-w-0">
            <strong className="block truncate text-[13px]">{name}</strong>
            <small className="text-xs text-muted">Profile & settings</small>
          </span>
          <Icon name="settings" className="ml-auto size-4 text-muted" />
        </Link>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-40 flex overflow-x-auto border-t border-line bg-surface/95 px-1 pt-1.5 pb-[max(6px,env(safe-area-inset-bottom))] backdrop-blur [scrollbar-width:none] lg:hidden">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={cn('grid min-w-[66px] flex-1 justify-items-center gap-1 px-1 py-1 text-[10px] font-bold', active ? 'text-accent-ink' : 'text-muted')}>
            <Icon name={item.icon} className="size-[21px]" />
            {item.short}
          </Link>
        );
      })}
    </nav>
  );
}

export function Topbar() {
  const name = useProfile((s) => s.name.trim() || 'Student');
  return (
    <header className="flex h-16 items-center justify-between gap-4 border-b border-line text-xs text-muted lg:h-20 lg:justify-end">
      <Link href="/" className="flex items-center gap-2 font-display text-lg font-extrabold tracking-[-0.04em] text-ink lg:hidden">
        <Logo className="size-7" /> studytime
      </Link>
      <div className="flex items-center gap-4">
        <span className="max-sm:hidden">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
        <Link href="/settings" aria-label="Profile and settings" className="grid size-9 place-items-center rounded-full bg-accent-soft text-[13px] font-extrabold text-accent-ink">
          {name[0].toUpperCase()}
        </Link>
      </div>
    </header>
  );
}
