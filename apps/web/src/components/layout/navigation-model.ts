import type { NavigationItem } from '@/lib/authz';
import type { IconName } from '@/components/ui';

const viewIcons: Record<NavigationItem['view'], IconName> = {
  home: 'home', persons: 'people', structure: 'structure', nomenclature: 'box', stock: 'database', imports: 'upload', transactions: 'journal', transfers: 'transfer', users: 'users', administration: 'settings', reports: 'journal', profile: 'profile', 'my-card': 'profile', 'my-stock': 'database', 'my-transactions': 'journal',
};

export function navigationIcon(item: NavigationItem) { return viewIcons[item.view]; }
export function isNavigationActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return href !== '#' && (pathname === href || pathname.startsWith(`${href}/`));
}
