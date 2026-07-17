'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/app/ui/auth-context';
import { PageHeader } from '@/components/layout/page-header';
import { APP_VERSION } from '@/components/layout/status-footer';
import { getToolbarDetail, TOOLBAR_EVENT, type View } from '@/components/layout/toolbar-events';
import { ActionList, Button, Card, EmptyState, ErrorState, Icon, LoadingState, MetricCard, StatusBadge } from '@/components/ui';
import type { DashboardStats } from '@/lib/types';
import { dashboardService } from './dashboard.service';
import { dashboardContentState, dashboardMetrics, getDashboardActions } from './dashboard-model';

export function DashboardView({ apiState, apiCheckedAt, onNavigate }: { apiState: 'checking' | 'available' | 'unavailable'; apiCheckedAt: Date | null; onNavigate: (view: View) => void }) {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const loadStats = useCallback(async () => { setLoading(true); setError(''); try { setStats(await dashboardService.dashboardStats()); } catch { setStats(null); setError('Не вдалося отримати показники головної сторінки. Перевірте доступність backend API.'); } finally { setLoading(false); } }, []);
  useEffect(() => { void loadStats(); }, [loadStats]);
  useEffect(() => { const handleToolbar = (event: Event) => { const detail = getToolbarDetail(event); if (detail?.view === 'home' && detail.action === 'refresh') void loadStats(); }; window.addEventListener(TOOLBAR_EVENT, handleToolbar); return () => window.removeEventListener(TOOLBAR_EVENT, handleToolbar); }, [loadStats]);
  const state = dashboardContentState(loading, error, stats);
  const quickActions = getDashboardActions(user).map((action) => ({ ...action, onClick: (event?: React.MouseEvent) => { event?.preventDefault(); if (action.importAction) window.sessionStorage.setItem('mvo:open-import-upload', '1'); onNavigate(action.view); } }));
  return <div className="dashboard-grid">
    <aside className="dashboard-stack">
      <Card icon={<Icon name="shield" />} title="Стан системи"><dl className="summary-list"><div><dt>API</dt><dd><StatusBadge dot tone={apiState === 'available' ? 'success' : apiState === 'checking' ? 'warning' : 'danger'}>{apiState === 'available' ? 'доступний' : apiState === 'checking' ? 'перевірка' : 'недоступний'}</StatusBadge></dd></div><div><dt>Останнє оновлення</dt><dd>{apiCheckedAt ? apiCheckedAt.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }) : '—'}</dd></div><div><dt>Версія</dt><dd>{APP_VERSION}</dd></div></dl></Card>
      <Card icon={<Icon name="journal" />} title="Підсумок перевірок"><dl className="summary-list"><div><dt>Потребують перевірки</dt><dd>{stats?.inventoryItemsNeedsReview ?? '—'}</dd></div><div><dt>Імпорти з помилками</dt><dd>{stats?.importsWithErrors ?? '—'}</dd></div><div><dt>Розбіжності</dt><dd>{stats?.recentReceiptDiscrepancies ?? '—'}</dd></div></dl></Card>
      <Card icon={<Icon name="structure" />} title="Мої підрозділи"><dl className="summary-list"><div><dt>Управління</dt><dd>{stats?.managements ?? '—'}</dd></div><div><dt>Служби</dt><dd>{stats?.services ?? '—'}</dd></div><div><dt>Підрозділи</dt><dd>{stats?.units ?? '—'}</dd></div></dl></Card>
    </aside>
    <section className="dashboard-stack min-w-0">
      <PageHeader title="Головна" description="Поточний стан організаційної структури та реєстру МВО." action={<Button disabled={loading} icon="refresh" type="button" onClick={() => void loadStats()}>Оновити дані</Button>} />
      {state === 'loading' ? <LoadingState label="Завантаження показників…" /> : null}
      {state === 'error' ? <ErrorState message={error} /> : null}
      {state === 'ready' && stats ? <><Card title="Поточні показники"><div className="dashboard-metrics">{dashboardMetrics.map((metric) => <MetricCard icon={metric.icon} key={metric.key} label={metric.label} tone={metric.tone} value={stats[metric.key]} />)}</div></Card><div className="dashboard-panels"><Card icon={<Icon name="journal" />} title="Потребують уваги"><div className="grid grid-cols-1 gap-2 sm:grid-cols-3"><MetricCard icon="shield" label="Номенклатура на перевірці" tone="warning" value={stats.inventoryItemsNeedsReview} /><MetricCard icon="warning" label="Імпорти з помилками" tone="danger" value={stats.importsWithErrors} /><MetricCard icon="warning" label="Розбіжності" value={stats.recentReceiptDiscrepancies} /></div></Card><Card icon={<Icon name="journal" />} title="Останні операції"><EmptyState message="Dashboard API не повертає список останніх операцій. Перейдіть до журналу для перегляду фактичних записів." /></Card></div></> : null}
    </section>
    <aside className="dashboard-grid__right dashboard-stack"><Card icon={<Icon name="refresh" />} title="Швидкі дії"><ActionList items={quickActions} /></Card></aside>
  </div>;
}
