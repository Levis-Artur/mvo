'use client';
import type { RefObject } from 'react';
import { usePathname } from 'next/navigation';
import { Button, Icon } from '@/components/ui';
import type { AppView, NavigationItem } from '@/lib/authz';
import { isNavigationActive, navigationIcon } from './navigation-model';

export function MainNavigation({ items, navRef, onSelect }: { items: NavigationItem[]; navRef: RefObject<HTMLDivElement | null>; onSelect: (view: AppView) => void }) {
  const pathname = usePathname();
  return <nav aria-label="Основна навігація" className="main-navigation"><div className="compact-scrollbar main-navigation__scroll" ref={navRef}>{items.map((item) => {
    const active = isNavigationActive(pathname, item.href);
    return <Button aria-current={active ? 'page' : undefined} className="main-navigation__item" data-active={active ? 'true' : undefined} disabled={item.disabled} key={`${item.view}-${item.label}`} title={item.title} type="button" variant="ghost" onClick={() => { if (!item.disabled) onSelect(item.view); }}><Icon name={navigationIcon(item)} />{item.label}</Button>;
  })}</div></nav>;
}
