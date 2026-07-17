'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/app/ui/auth-context';
import type { InventoryItem, StockBalance } from '@/lib/types';
import { inventoryService as apiClient } from '@/features/inventory/inventory.service';
import { getErrorMessage } from '@/components/common';
import { PageHeader } from '@/components/layout/page-header';
import { ErrorState, Pagination } from '@/components/ui';
import { fetchAllPages } from '@/lib/fetch-all-pages';
import { getToolbarDetail, TOOLBAR_EVENT } from '@/components/layout/toolbar-events';
import { StockBalancesTable } from '@/features/inventory/stock-balances-table';
import { StockFilterBar } from '@/features/inventory/stock-filter-bar';
import { StockSummaryCards } from '@/features/inventory/stock-summary-cards';
import {
  DEFAULT_STOCK_FILTERS,
  filterProblematicBalances,
  mvoStockActionLinks,
  paginateBalances,
  stockQueryFromFilters,
  type StockFilterDraft,
} from '@/features/inventory/stock-model';

export function MyStockView() {
  const { user } = useAuth();
  const personId = user?.responsiblePersonId ?? '';
  const links = mvoStockActionLinks(personId);
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [draft, setDraft] = useState<StockFilterDraft>(DEFAULT_STOCK_FILTERS);
  const [applied, setApplied] = useState<StockFilterDraft>(DEFAULT_STOCK_FILTERS);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const filtered = useMemo(
    () => filterProblematicBalances(balances, applied.onlyProblematic),
    [applied.onlyProblematic, balances],
  );
  const paged = useMemo(
    () => paginateBalances(filtered, page, limit),
    [filtered, limit, page],
  );

  const load = useCallback(async () => {
    if (!personId) {
      setLoading(false);
      setError('До користувача не прив’язано картку МВО.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const query = stockQueryFromFilters(applied, personId);
      const [nextBalances, nextItems] = await Promise.all([
        fetchAllPages((pagination) =>
          apiClient.stockBalances({ ...query, ...pagination }),
        ),
        fetchAllPages((pagination) => apiClient.inventoryItems(pagination)),
      ]);
      setBalances(nextBalances);
      setItems(nextItems);
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [applied, personId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function handleToolbar(event: Event) {
      const detail = getToolbarDetail(event);
      if (detail?.view === 'my-stock' && detail.action === 'refresh') void load();
    }
    window.addEventListener(TOOLBAR_EVENT, handleToolbar);
    return () => window.removeEventListener(TOOLBAR_EVENT, handleToolbar);
  }, [load]);

  return (
    <section className="grid min-w-0 gap-4">
      <PageHeader
        action={
          personId ? (
            <div className="flex flex-wrap gap-2">
              <a className="btn btn-primary" href={links.transfer}>Передати</a>
              <a className="btn btn-outline" href={links.issue}>Видати</a>
            </div>
          ) : undefined
        }
        description="Власні облікові залишки за прив’язаною карткою МВО."
        icon="box"
        title="Моє майно"
      />
      {personId ? <StockSummaryCards balances={filtered} /> : null}
      {personId ? (
        <StockFilterBar
          hideResponsiblePerson
          filters={draft}
          items={items}
          loading={loading}
          managements={[]}
          persons={[]}
          services={[]}
          units={[]}
          onApply={() => {
            setApplied(draft);
            setPage(1);
          }}
          onChange={setDraft}
          onRefresh={() => void load()}
          onReset={() => {
            setDraft(DEFAULT_STOCK_FILTERS);
            setApplied(DEFAULT_STOCK_FILTERS);
            setPage(1);
          }}
        />
      ) : null}
      {error ? <ErrorState message={error} /> : null}
      {personId ? <StockBalancesTable balances={paged.items} loading={loading} /> : null}
      {personId ? (
        <Pagination
          limit={paged.pagination.limit}
          page={paged.pagination.page}
          total={paged.pagination.total}
          totalPages={paged.pagination.totalPages}
          onLimitChange={(nextLimit) => {
            setLimit(nextLimit);
            setPage(1);
          }}
          onPage={setPage}
        />
      ) : null}
    </section>
  );
}
