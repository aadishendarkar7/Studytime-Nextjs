'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Avatar } from '@/components/ui/avatar';
import { Icon, Logo } from '@/components/ui/icons';
import { useUnreadDms } from '@/features/chat/live';
import { useDropComposer } from '@/features/drop/composer';
import { useDrops } from '@/features/drop/live';
import { SoundDock } from '@/features/sounds/sound-dock';
import { useProfile } from '@/lib/stores/profile';
import { useAccount } from '@/features/auth/account';
import { signInHref } from '@/features/auth/sign-in-gate';
import { useNow } from '@/lib/use-now';
import { cn, fmtClock } from '@/lib/utils';
import { AppearanceButtons } from './appearance-picker';
import { GROUP_LABEL, isActive, MOBILE_TABS, NAV, type NavItem } from './nav';

function Wordmark({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn('flex items-center gap-2.5 text-[19px] font-semibold tracking-tight text-ink', className)}>
      <Logo className="size-9" /> Studytime
    </Link>
  );
}

function FooterLinks({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-wrap gap-x-3 gap-y-1 text-[12px] leading-5 text-muted', className)}>
      <Link href="/help" className="hover:text-ink">Support</Link>
      <Link href="/privacy" className="hover:text-ink">Privacy</Link>
      <Link href="/terms" className="hover:text-ink">Terms</Link>
    </div>
  );
}

/** Live counts shown beside nav items: drops happening now, unread messages. */
function useBadges() {
  const drops = useDrops((s) => s.drops);
  const now = useNow(60_000);
  const live = drops.filter((d) => d.startsAt <= now && d.endsAt > now).length;
  const unread = useUnreadDms();
  return { live, unread };
}

function Badge({ item, badges }: { item: NavItem; badges: ReturnType<typeof useBadges> }) {
  if (item.href !== '/drop') return null;
  return (
    <span className="flex items-center gap-1.5">
      {badges.live > 0 && <span className="tnum inline-flex items-center gap-1 text-[12px] font-medium text-ok"><span className="size-1.5 rounded-full bg-ok" />{badges.live}</span>}
      {badges.unread > 0 && <span className="tnum grid h-[18px] min-w-[18px] place-items-center rounded-full bg-ink px-1 text-[11px] font-semibold text-bg" title="Unread messages">{badges.unread}</span>}
    </span>
  );
}

function NavLinks({ pathname, large }: { pathname: string; large?: boolean }) {
  const badges = useBadges();
  const groups = (['main', 'study', 'together', 'me'] as const).map((g) => ({ g, items: NAV.filter((n) => n.group === g && (large || n.href !== '/settings')) }));
  return (
    <div className="grid gap-4">
      {groups.map(({ g, items }) => (
        <div key={g} className="grid gap-px">
          {GROUP_LABEL[g] && <p className="mb-1 px-2.5 text-[12px] font-medium text-muted">{GROUP_LABEL[g]}</p>}
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn('flex items-center gap-2.5 rounded-lg px-2.5 transition-colors', large ? 'min-h-12 text-[16px]' : 'h-8 text-[14px]', active ? 'bg-accent-soft font-medium text-accent-ink' : 'text-ink-2 hover:bg-surface-3/70 hover:text-ink')}
              >
                <Icon name={item.icon} className={cn('size-[17px] shrink-0', active || item.href === '/drop' ? 'text-accent-ink' : 'text-muted')} />
                <span className="min-w-0 flex-1 truncate">
                  {item.label}
                  {large && item.hint && <small className="block text-[13px] font-normal text-muted">{item.hint}</small>}
                </span>
                <Badge item={item} badges={badges} />
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const name = useProfile((s) => s.name.trim() || 'Student');
  const school = useProfile((s) => s.school);
  const signedIn = useAccount((s) => Boolean(s.user));
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-[var(--sidebar)] px-3 pt-4 pb-3 lg:flex">
      <Wordmark className="mx-2 mb-6 h-10" />
      <nav aria-label="Main navigation" className="min-h-0 flex-1 overflow-y-auto">
        <NavLinks pathname={pathname} />
      </nav>
      <div className="mt-3 grid gap-2 border-t border-line pt-3">
        <SoundDock />
        <div className="flex items-center gap-1">
          {signedIn ? (
          <Link href="/you?tab=profile" className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface-3">
              <Avatar name={name} size={28} />
              <span className="min-w-0">
                <strong className="block truncate text-[13px] font-medium">{name}</strong>
                <small className="block truncate text-[12px] text-muted">{school || 'Add your school'}</small>
              </span>
            </Link>
          ) : (
            <Link href={signInHref('signup')} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg bg-accent-fill px-3 py-2 text-white hover:opacity-90">
              <Icon name="user" className="size-4" />
              <span className="min-w-0"><strong className="block truncate text-[13px] font-semibold">Create account</strong><small className="block truncate text-[12px] text-white/80">Free. Saves your progress</small></span>
            </Link>
          )}
          <Link href="/settings" aria-label="Settings" title="Settings" className={cn('grid size-8 shrink-0 place-items-center rounded-lg hover:bg-surface-3 hover:text-ink', isActive(pathname, '/settings') ? 'bg-surface-3 text-ink' : 'text-muted')}><Icon name="settings" className="size-[17px]" /></Link>
        </div>
        <FooterLinks className="px-2" />
      </div>
    </aside>
  );
}

const EXTRA_TITLES: Record<string, string> = { '/help': 'Support', '/privacy': 'Privacy', '/terms': 'Terms' };

/** While a session is going, a small live timer follows you to every page. Tap it to go back. */
function TimerChip({ hidden }: { hidden: boolean }) {
  const timer = useProfile((s) => s.timer);
  if (hidden || timer.mode === 'ready') return null;
  return (
    <Link href="/" className="inline-flex h-8 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-[13px] font-medium text-ink hover:bg-surface-2">
      <span className={cn('size-2 rounded-full', timer.mode === 'running' ? 'bg-accent' : 'bg-muted')} aria-hidden="true" />
      <span className="tnum">{fmtClock(timer.remaining)}</span>
      <span className="text-muted max-sm:hidden">{timer.mode === 'running' ? 'focusing' : 'paused'}</span>
    </Link>
  );
}

export function Topbar() {
  const signedIn = useAccount((st) => Boolean(st.user));
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
  const section = NAV.find((n) => n.href !== '/' && isActive(pathname, n.href));
  const title = pathname === '/' ? 'Home' : section?.label ?? EXTRA_TITLES[pathname] ?? (pathname.startsWith('/class/') ? 'Classes' : '');
  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-bg px-4 sm:px-6 lg:px-8">
        <Wordmark className="lg:hidden" />
        <span className="truncate text-[14px] font-medium text-ink max-lg:hidden">{title}</span>
        <TimerChip hidden={pathname === '/'} />
        <div className="ml-auto flex items-center gap-1">
          {pathname !== '/drop' && (
            <button type="button" onClick={() => useDropComposer.getState().show()} className="mr-1 inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-[13px] font-medium text-ink shadow-sm hover:bg-surface-2 max-sm:hidden">
              <Icon name="pin" className="size-4 text-accent-ink" /> Drop a spot
            </button>
          )}
          <AppearanceButtons />
          {!signedIn && <Link href={signInHref('signin')} className="ml-1 inline-flex h-8 items-center rounded-lg bg-accent-fill px-3 text-[13px] font-semibold text-white hover:opacity-90 lg:hidden">Sign in</Link>}
          <button
            type="button"
            onClick={() => setOpenAt(open ? null : pathname)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="grid size-9 place-items-center rounded-lg text-ink hover:bg-surface-3 lg:hidden"
          >
            <Icon name={open ? 'close' : 'menu'} />
          </button>
        </div>
      </header>
      {open && (
        <nav id="mobile-menu" aria-label="Main navigation" className="fixed inset-x-0 top-14 bottom-0 z-20 overflow-y-auto bg-surface px-4 pt-4 pb-24 sm:px-6 lg:hidden">
          <NavLinks pathname={pathname} large />
          <div className="mt-6 border-t border-line pt-4">
            <SoundDock />
          </div>
          <FooterLinks className="mt-6 px-3" />
        </nav>
      )}
    </>
  );
}

/** Phone tab bar for the five places used most. */
export function BottomTabs() {
  const pathname = usePathname();
  const badges = useBadges();
  return (
    <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {MOBILE_TABS.map((href) => NAV.find((n) => n.href === href)!).map((item) => {
          const active = isActive(pathname, item.href);
          if (item.href === '/drop')
            return (
              <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-ink">
                <span className="relative grid h-8 w-12 place-items-center rounded-xl bg-accent-fill text-white">
                  <Icon name="pin" className="size-[18px]" />
                  {badges.unread > 0 && <span className="absolute -top-1 -left-1 size-2.5 rounded-full border-2 border-surface bg-ink" />}
                  {badges.live > 0 && <span className="tnum absolute -top-1.5 -right-1.5 grid h-4 min-w-4 place-items-center rounded-full border-2 border-surface bg-ok px-0.5 text-[10px] leading-none text-white">{badges.live}</span>}
                </span>
                Drop
              </Link>
            );
          return (
            <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={cn('flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium', active ? 'text-ink' : 'text-muted')}>
              <span className="grid h-8 w-12 place-items-center"><Icon name={item.icon} className="size-5" /></span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
