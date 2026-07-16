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
        'РќРµ РІРґР°Р»РѕСЃСЏ РѕС‚СЂРёРјР°С‚Рё РїРѕРєР°Р·РЅРёРєРё dashboard. РџРµСЂРµРІС–СЂС‚Рµ РґРѕСЃС‚СѓРїРЅС–СЃС‚СЊ backend API.',
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
    ['РђРєС‚РёРІРЅС– РњР’Рћ', stats?.activeResponsiblePersons],
    ['РЈРїСЂР°РІР»С–РЅРЅСЏ', stats?.managements],
    ['РЎР»СѓР¶Р±Рё', stats?.services],
    ['РџС–РґСЂРѕР·РґС–Р»Рё', stats?.units],
    ['РќРѕРјРµРЅРєР»Р°С‚СѓСЂР°', stats?.inventoryItems],
    ['РџРѕС‚СЂРµР±СѓСЋС‚СЊ РїРµСЂРµРІС–СЂРєРё', stats?.inventoryItemsNeedsReview],
    ['РњР’Рћ С–Р· Р·Р°Р»РёС€РєР°РјРё', stats?.responsiblePersonsWithStock],
    ['РџСЂРѕРІРµРґРµРЅС– С–РјРїРѕСЂС‚Рё', stats?.completedImports],
    ['Р†РјРїРѕСЂС‚Рё Р· РїРѕРјРёР»РєР°РјРё', stats?.importsWithErrors],
    ['Р РѕР·Р±С–Р¶РЅРѕСЃС‚С– РЅР°РґС…РѕРґР¶РµРЅСЊ', stats?.recentReceiptDiscrepancies],
  ];

  return (
    <section className="grid gap-3">
      <PageHeader
        title="Р“РѕР»РѕРІРЅР°"
        description="РџРѕС‚РѕС‡РЅРёР№ СЃС‚Р°РЅ РѕСЂРіР°РЅС–Р·Р°С†С–Р№РЅРѕС— СЃС‚СЂСѓРєС‚СѓСЂРё С‚Р° СЂРµС”СЃС‚СЂСѓ РњР’Рћ."
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
            title="РџРѕС‚СЂРµР±СѓСЋС‚СЊ СѓРІР°РіРё"
            description="РљРѕСЂРѕС‚РєРёР№ СЃРїРёСЃРѕРє РєРѕРЅС‚СЂРѕР»СЊРЅРёС… РїРѕРєР°Р·РЅРёРєС–РІ РґР»СЏ С‰РѕРґРµРЅРЅРѕС— РїРµСЂРµРІС–СЂРєРё."
          />
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <Stat
              label="РќРѕРјРµРЅРєР»Р°С‚СѓСЂР° РЅР° РїРµСЂРµРІС–СЂС†С–"
              value={stats?.inventoryItemsNeedsReview ?? 0}
            />
            <Stat
              label="Р†РјРїРѕСЂС‚Рё Р· РїРѕРјРёР»РєР°РјРё"
              value={stats?.importsWithErrors ?? 0}
            />
            <Stat
              label="Р РѕР·Р±С–Р¶РЅРѕСЃС‚С–"
              value={stats?.recentReceiptDiscrepancies ?? 0}
            />
          </div>
        </div>
        <div className="erp-panel p-3">
          <SectionTitle
            title="РЁРІРёРґРєС– РґС–С—"
            description="РћСЃРЅРѕРІРЅС– СЂРѕР±РѕС‡С– СЂРѕР·РґС–Р»Рё СЃРёСЃС‚РµРјРё."
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
                РќРѕРІРёР№ С–РјРїРѕСЂС‚
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
                РџРµСЂРµРіР»СЏРЅСѓС‚Рё Р·Р°Р»РёС€РєРё
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}


