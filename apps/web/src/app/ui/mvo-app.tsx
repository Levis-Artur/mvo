'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getNavigationItems, getViewHref, roleLabels, type AppView } from '@/lib/authz';
import { useAuth } from './auth-context';
import { AppShell } from '@/components/layout/app-shell';
import { PlaceholderView } from '@/components/common';
import { AdministrationView } from '@/features/admin/administration-view';
import { DashboardView } from '@/features/dashboard/dashboard-view';
import { ImportsView } from '@/features/imports/imports-view';
import { NomenclatureView } from '@/features/inventory/inventory-view';
import { StockView } from '@/features/inventory/stock-view';
import { TransactionsView } from '@/features/inventory/transactions-view';
import { StructureView } from '@/features/organization/organization-view';
import { MyCardView, MyStockView, MyTransactionsView } from '@/features/responsible-persons/my-views';
import { PersonsView } from '@/features/responsible-persons/persons-view';
import { StockDocumentsView } from '@/features/stock-documents/stock-documents-view';
import { UsersView } from '@/features/users/users-view';

export type View = AppView;

export function MvoApp({ initialView = 'home', initialImportId }: { initialView?: View; initialImportId?: string }) {
  const router = useRouter();
  const { logout, user } = useAuth();
  const [view, setView] = useState<View>(initialView);
  const navigationItems = getNavigationItems(user);
  const [apiState, setApiState] = useState<'checking' | 'available' | 'unavailable'>('checking');
  const [apiCheckedAt, setApiCheckedAt] = useState<Date | null>(null);
  const topNavRef = useRef<HTMLDivElement | null>(null);
  const currentPage = navigationItems.find((item) => item.view === view);

  useEffect(() => { topNavRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' }); }, [view]);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/health`, { cache: 'no-store', signal: controller.signal })
      .then((response) => { setApiState(response.ok ? 'available' : 'unavailable'); setApiCheckedAt(new Date()); })
      .catch(() => { if (!controller.signal.aborted) { setApiState('unavailable'); setApiCheckedAt(new Date()); } });
    return () => controller.abort();
  }, []);

  function selectView(nextView: View) { setView(nextView); router.push(getViewHref(user, nextView)); }

  return <AppShell apiState={apiState} currentPage={currentPage?.label ?? 'Головна'} navigationItems={navigationItems} navRef={topNavRef} user={user} userLabel={user ? `${user.username} · ${roleLabels[user.role]}` : ''} onLogout={logout} onSelectView={selectView}>
    {view === 'home' ? <DashboardView apiCheckedAt={apiCheckedAt} apiState={apiState} onNavigate={selectView} /> : null}
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
    {view === 'transfers' ? <StockDocumentsView /> : null}
    {view === 'reports' ? <PlaceholderView title="Звіти" description="Розділ звітів буде підключено після появи відповідних можливостей API." /> : null}
    {view === 'administration' ? <AdministrationView /> : null}
  </AppShell>;
}
