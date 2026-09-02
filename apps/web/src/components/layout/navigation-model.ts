import type { NavigationItem } from '@/lib/authz';
import type { IconName } from '@/components/ui';

const viewIcons: Record<NavigationItem['view'], IconName> = {
  home: 'home', persons: 'people', structure: 'structure', nomenclature: 'box', stock: 'database', imports: 'upload', transactions: 'journal', transfers: 'transfer', issues: 'journal', accounting: 'journal', 'accounting-transfers': 'journal', users: 'users', administration: 'settings', reports: 'journal', profile: 'profile', 'my-card': 'profile', 'my-stock': 'database', 'my-transactions': 'journal', manager: 'users',
};

export function navigationIcon(item: NavigationItem) { return viewIcons[item.view]; }
export function isNavigationActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  if (href === '/accounting') return pathname === href;
  return href !== '#' && (pathname === href || pathname.startsWith(`${href}/`));
}
