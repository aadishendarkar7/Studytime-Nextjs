import type { IconName } from '@/components/ui/icons';

export const NAV: { href: string; label: string; short: string; icon: IconName; badge?: string }[] = [
  { href: '/', label: 'Overview', short: 'Home', icon: 'home' },
  { href: '/ai', label: 'AI Tutor', short: 'AI Tutor', icon: 'ai', badge: 'NEW' },
  { href: '/focus', label: 'Focus timer', short: 'Focus', icon: 'focus' },
  { href: '/planner', label: 'Planner', short: 'Planner', icon: 'planner' },
  { href: '/games', label: 'Study games', short: 'Games', icon: 'games' },
  { href: '/friends', label: 'Friends & classmates', short: 'Friends', icon: 'friends' },
  { href: '/leaderboards', label: 'Leaderboards', short: 'Leaders', icon: 'leaders' },
  { href: '/rewards', label: 'Rewards', short: 'Rewards', icon: 'rewards' },
];

export const isActive = (pathname: string, href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`));
