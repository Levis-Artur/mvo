'use client';

import { useCallback, useEffect, useState } from 'react';
import { dashboardService as apiClient } from './dashboard.service';
import { useAuth } from '@/app/ui/auth-context';
import { can } from '@/lib/authz';
import type { DashboardStats } from '@/lib/types';
import {
  ErrorMessage,
  PageHeader,
  SectionTitle,
  Stat,
} from '@/components/common';
import {
  getToolbarDetail,
  TOOLBAR_EVENT,
  type View,
} from '@/components/layout/toolbar-events';

export function DashboardView({ onNavigate }: { onNavigate: (view: View) => void }) {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setStats(await apiClient.dashboardStats());
    } catch {
      setStats(null);
      setError(
        'Не вдалося отримати показники dashboard. Перевірте доступність backend API.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    function handleToolbar(event: Event) {
      const detail = getToolbarDetail(event);
      if (detail?.view === 'home' && detail.action === 'refresh') {
        void loadStats();
      }
    }

    window.addEventListener(TOOLBAR_EVENT, handleToolbar);
    return () => window.removeEventListener(TOOLBAR_EVENT, handleToolbar);
  }, [loadStats]);

  const cards = [
    ['Активні МВО', stats?.activeResponsiblePersons],
    ['Управління', stats?.managements],
    ['Служби', stats?.services],
    ['Підрозділи', stats?.units],
    ['Номенклатура', stats?.inventoryItems],
    ['Потребують перевірки', stats?.inventoryItemsNeedsReview],
    ['МВО із залишками', stats?.responsiblePersonsWithStock],
    ['Проведені імпорти', stats?.completedImports],
    ['Імпорти з помилками', stats?.importsWithErrors],
    ['Розбіжності надходжень', stats?.recentReceiptDiscrepancies],
  ];

  return (
    <section className="grid gap-3">
      <PageHeader
        title="Головна"
        description="Поточний стан організаційної структури та реєстру МВО."
      />
      {error ? <ErrorMessage message={error} /> : null}
      <div className="erp-panel grid gap-px overflow-hidden bg-[var(--border-light)] sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(([label, value]) => (
          <div
            key={label}
            className="bg-white px-3 py-2"
          >
            <p className="truncate text-xs font-medium text-[var(--text-secondary)]">
              {label}
            </p>
            <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-[var(--primary)]">
              {loading ? (
                <span className="block h-6 w-16 animate-pulse rounded bg-[var(--border-light)]" />
              ) : (
                value ?? 0
              )}
            </p>
          </div>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="erp-panel p-3">
          <SectionTitle
            title="Потребують уваги"
            description="Короткий список контрольних показників для щоденної перевірки."
          />
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <Stat
              label="Номенклатура на перевірці"
              value={stats?.inventoryItemsNeedsReview ?? 0}
            />
            <Stat
              label="Імпорти з помилками"
              value={stats?.importsWithErrors ?? 0}
            />
            <Stat
              label="Розбіжності"
              value={stats?.recentReceiptDiscrepancies ?? 0}
            />
          </div>
        </div>
        <div className="erp-panel p-3">
          <SectionTitle
            title="Швидкі дії"
            description="Основні робочі розділи системи."
          />
          <div className="mt-3 grid gap-1.5">
            {can(user, 'write', 'imports') ? (
              <button
                className="btn btn-outline justify-start"
                type="button"
                onClick={() => {
                  window.sessionStorage.setItem('mvo:open-import-upload', '1');
                  onNavigate('imports');
                }}
              >
                Новий імпорт
              </button>
            ) : null}
            {can(user, 'read', 'responsiblePersons') ? (
              <button
                className="btn btn-outline justify-start"
                type="button"
                onClick={() => onNavigate('persons')}
              >
                Реєстр МВО
              </button>
            ) : null}
            {can(user, 'read', 'stock') ? (
              <button
                className="btn btn-outline justify-start"
                type="button"
                onClick={() => onNavigate('stock')}
              >
                Переглянути залишки
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}


