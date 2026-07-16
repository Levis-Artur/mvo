'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getNavigationItems, getViewHref, roleLabels, type AppView } from '@/lib/authz';
import { useAuth } from './auth-context';
import { AppHeader } from '@/components/layout/app-header';
import { StatusBar } from '@/components/layout/status-bar';
import { DashboardView } from '@/features/dashboard/dashboard-view';
import { PersonsView } from '@/features/responsible-persons/persons-view';
import { MyCardView, MyStockView, MyTransactionsView, MyTransfersView } from '@/features/responsible-persons/my-views';
import { UsersView } from '@/features/users/users-view';
import { StructureView } from '@/features/organization/organization-view';
import { NomenclatureView } from '@/features/inventory/inventory-view';
import { StockView } from '@/features/inventory/stock-view';
import { ImportsView } from '@/features/imports/imports-view';
import { TransactionsView } from '@/features/inventory/transactions-view';
import { PlaceholderView } from '@/components/common';

export type View = AppView;

export function MvoApp({ initialView = 'home', initialImportId }: { initialView?: View; initialImportId?: string }) {
  const router = useRouter();
  const { logout, user } = useAuth();
  const [view, setView] = useState<View>(initialView);
  const navigationItems = getNavigationItems(user);
  const [apiState, setApiState] = useState<'checking' | 'available' | 'unavailable'>('checking');
  const topNavRef = useRef<HTMLElement | null>(null);
  const currentPage = navigationItems.find((item) => item.view === view);

  useEffect(() => {
    topNavRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [view]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/health`, { cache: 'no-store', signal: controller.signal })
      .then((response) => setApiState(response.ok ? 'available' : 'unavailable'))
      .catch(() => { if (!controller.signal.aborted) setApiState('unavailable'); });
    return () => controller.abort();
  }, []);

  function selectView(nextView: View) {
    setView(nextView);
    router.push(getViewHref(user, nextView));
  }

  return <div className="flex min-h-screen flex-col bg-[var(--app-background)] text-[var(--text-primary)]">
    <AppHeader apiState={apiState} currentView={view} navigationItems={navigationItems} topNavRef={topNavRef} user={user} onLogout={logout} onSelectView={selectView} />
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--workspace-background)]"><main className="compact-scrollbar min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
      {view === 'home' ? <DashboardView onNavigate={selectView} /> : null}
      {view === 'persons' ? <PersonsView /> : null}
      {view === 'structure' ? <StructureView /> : null}
      {view === 'stock' ? <StockView /> : null}
      {view === 'nomenclature' ? <NomenclatureView /> : null}
      {view === 'imports' ? <ImportsView initialImportId={initialImportId} /> : null}
      {view === 'transactions' ? <TransactionsView /> : null}
      {view === 'users' ? <UsersView /> : null}
      {view === 'my-card' ? <MyCardView /> : null}
      {view === 'my-stock' ? <MyStockView /> : null}
      {view === 'my-transactions' ? <MyTransactionsView /> : null}
      {view === 'transfers' ? <MyTransfersView /> : null}
      {view === 'reports' ? <PlaceholderView title="Звіти" description="Розділ звітів буде підключено після появи відповідних endpoint." /> : null}
      {view === 'administration' ? <PlaceholderView title="Адміністрування" description="Адміністративні налаштування ще не реалізовані." /> : null}
    </main></div>
    <StatusBar apiState={apiState} currentPage={currentPage?.label ?? 'Головна'} userLabel={user ? `${user.username} · ${roleLabels[user.role]}` : ''} />
  </div>;
}
