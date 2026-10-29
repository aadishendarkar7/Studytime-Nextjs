import type { IconName } from '@/components/ui/icons';

export type NavItem = { href: string; label: string; icon: IconName; hint?: string; group: 'main' | 'together' | 'study' | 'me' };

/** Every place in the app. Smaller tools live inside one of these. */
export const NAV: NavItem[] = [
  { href: '/', label: 'Home', icon: 'home', group: 'main' },
  { href: '/feed', label: 'Feed', icon: 'flame', hint: 'Study sessions from friends', group: 'together' },
  { href: '/drop', label: 'Drop a Spot', icon: 'pin', hint: 'Live map, friends and chat', group: 'together' },
  { href: '/leaderboard', label: 'Leaderboard', icon: 'leaders', hint: 'Leaderboard, tree and pet, achievements', group: 'together' },
  { href: '/study', label: 'Study', icon: 'book', hint: 'AI tutor, notes, flashcards', group: 'study' },
  { href: '/calendar', label: 'Calendar', icon: 'calendar', group: 'study' },
  { href: '/focus', label: 'Focus', icon: 'focus', hint: 'Timer and focus sounds', group: 'study' },
  { href: '/you', label: 'You', icon: 'user', hint: 'Check-in, progress, profile', group: 'me' },
  { href: '/settings', label: 'Settings', icon: 'settings', group: 'me' },
];

export const GROUP_LABEL: Record<NavItem['group'], string> = { main: '', together: 'Together', study: 'Study', me: 'You' };

/** The five shown in the phone tab bar; Drop a Spot sits in the middle. Calendar is in the menu. */
export const MOBILE_TABS = ['/', '/feed', '/drop', '/study', '/focus'];

export const isActive = (pathname: string, href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`));
