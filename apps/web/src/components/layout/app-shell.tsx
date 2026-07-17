'use client';
import type { RefObject } from 'react';
import type { NavigationItem } from '@/lib/authz';
import type { AuthUser } from '@/lib/types';
import { AppHeader, type ApiState } from './app-header';
import { MainNavigation } from './main-navigation';
import { PageContainer } from './page-container';
import { StatusFooter } from './status-footer';
export { APP_SHELL_REGIONS } from './app-shell-model';

export function AppShell({ apiState, currentPage, navigationItems, navRef, user, userLabel, onLogout, onSelectView, children }: { apiState: ApiState; currentPage: string; navigationItems: NavigationItem[]; navRef: RefObject<HTMLDivElement | null>; user: AuthUser | null; userLabel: string; onLogout: () => Promise<void>; onSelectView: (view: NavigationItem['view']) => void; children: React.ReactNode }) {
  return <div className="app-shell"><header data-shell-region="header"><AppHeader apiState={apiState} user={user} onLogout={onLogout} /><div data-shell-region="navigation"><MainNavigation items={navigationItems} navRef={navRef} onSelect={onSelectView} /></div></header><main className="app-shell__main" data-shell-region="main"><PageContainer>{children}</PageContainer></main><div data-shell-region="footer"><StatusFooter apiState={apiState} currentPage={currentPage} userLabel={userLabel} /></div></div>;
}
