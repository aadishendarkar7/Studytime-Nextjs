import type { IconName } from '@/components/ui/icons';

export type NavItem = { href: string; label: string; icon: IconName; hint?: string; group: 'main' | 'together' | 'study' | 'me' };

/** Every place in the app. Smaller tools live inside one of these. */
export const NAV: NavItem[] = [
  { href: '/', label: 'Home', icon: 'home', hint: 'Focus timer and your day', group: 'main' },
  { href: '/study', label: 'Study', icon: 'book', hint: 'AI tutor, flashcards, notes, courses', group: 'study' },
  { href: '/calendar', label: 'Calendar', icon: 'calendar', group: 'study' },
  { href: '/drop', label: 'Drop a Spot', icon: 'pin', hint: 'Who is studying where', group: 'together' },
  { href: '/feed', label: 'Feed', icon: 'flame', hint: 'Study sessions people post', group: 'together' },
  { href: '/friends', label: 'Friends', icon: 'friends', hint: 'Your friends, classmates and messages', group: 'together' },
  { href: '/leaderboard', label: 'Leaderboard', icon: 'leaders', hint: 'Rankings, challenges, trophies', group: 'together' },
  { href: '/you', label: 'You', icon: 'user', hint: 'Check-in, progress, profile', group: 'me' },
  { href: '/settings', label: 'Settings', icon: 'settings', group: 'me' },
];

export const GROUP_LABEL: Record<NavItem['group'], string> = { main: '', together: 'Together', study: 'Study', me: 'You' };

/** The five shown in the phone tab bar; Drop a Spot sits in the middle. The rest are in the menu. */
export const MOBILE_TABS = ['/', '/study', '/drop', '/feed', '/friends'];

export const isActive = (pathname: string, href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`));
