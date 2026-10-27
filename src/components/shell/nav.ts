import type { IconName } from '@/components/ui/icons';

export type NavItem = { href: string; label: string; icon: IconName };

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Study',
    items: [
      { href: '/', label: 'Overview', icon: 'home' },
      { href: '/focus', label: 'Focus timer', icon: 'focus' },
      { href: '/sounds', label: 'Focus sounds', icon: 'sound' },
      { href: '/ai', label: 'AI Tutor', icon: 'ai' },
      { href: '/games', label: 'Study games', icon: 'games' },
      { href: '/planner', label: 'Planner', icon: 'planner' },
      { href: '/grades', label: 'Grades and GPA', icon: 'grades' },
    ],
  },
  {
    label: 'Together',
    items: [
      { href: '/partners', label: 'Study partners', icon: 'partners' },
      { href: '/spots', label: 'Study spots', icon: 'map' },
      { href: '/friends', label: 'Friends', icon: 'friends' },
      { href: '/leaderboards', label: 'Leaderboards', icon: 'leaders' },
    ],
  },
  {
    label: 'You',
    items: [
      { href: '/profile', label: 'Profile', icon: 'user' },
      { href: '/rewards', label: 'Rewards', icon: 'rewards' },
      { href: '/settings', label: 'Settings', icon: 'settings' },
    ],
  },
];

export const NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export const isActive = (pathname: string, href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`));
