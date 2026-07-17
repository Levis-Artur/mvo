'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { inventoryService as apiClient } from './inventory.service';
import type {
  InventoryItem,
  Management,
  ResponsiblePerson,
  Service,
  StockBalance,
  Unit,
} from '@/lib/types';
import { getErrorMessage } from '@/components/common';
import { PageHeader } from '@/components/layout/page-header';
import { Button, ErrorState, Pagination } from '@/components/ui';
import { fetchAllPages } from '@/lib/fetch-all-pages';
import {
  focusFirstField,
  getToolbarDetail,
  TOOLBAR_EVENT,
} from '@/components/layout/toolbar-events';
import { StockBalancesTable } from './stock-balances-table';
import { StockFilterBar } from './stock-filter-bar';
import { StockSummaryCards } from './stock-summary-cards';
import {
  DEFAULT_STOCK_FILTERS,
  filterProblematicBalances,
  paginateBalances,
  stockQueryFromFilters,
  type StockFilterDraft,
} from './stock-model';

export function StockView() {
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [persons, setPersons] = useState<ResponsiblePerson[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [managements, setManagements] = useState<Management[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [draft, setDraft] = useState<StockFilterDraft>(DEFAULT_STOCK_FILTERS);
  const [applied, setApplied] = useState<StockFilterDraft>(DEFAULT_STOCK_FILTERS);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [referenceError, setReferenceError] = useState('');

  const filteredBalances = useMemo(
    () => filterProblematicBalances(balances, applied.onlyProblematic),
    [applied.onlyProblematic, balances],
  );
  const paged = useMemo(
    () => paginateBalances(filteredBalances, page, limit),
    [filteredBalances, limit, page],
  );

  const loadReferences = useCallback(async () => {
    const [nextManagements, nextServices, nextUnits, nextPersons, nextItems] =
      await Promise.all([
        apiClient.managements(),
        apiClient.services(),
        apiClient.units(),
        fetchAllPages((pagination) =>
          apiClient.responsiblePersons({ ...pagination }),
        ),
        fetchAllPages((pagination) => apiClient.inventoryItems(pagination)),
      ]);
    setManagements(nextManagements);
    setServices(nextServices);
    setUnits(nextUnits);
    setPersons(nextPersons);
    setItems(nextItems);
  }, []);

  const loadBalances = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = stockQueryFromFilters(applied);
      const nextBalances = await fetchAllPages((pagination) =>
        apiClient.stockBalances({ ...query, ...pagination }),
      );
      setBalances(nextBalances);
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [applied]);

  const refresh = useCallback(async () => {
    setError('');
    setReferenceError('');
    try {
      await Promise.all([loadReferences(), loadBalances()]);
    } catch (reason) {
      setReferenceError(getErrorMessage(reason));
    }
  }, [loadBalances, loadReferences]);

  useEffect(() => {
    setReferenceError('');
    void loadReferences().catch((reason: unknown) =>
      setReferenceError(getErrorMessage(reason)),
    );
  }, [loadReferences]);

  useEffect(() => {
    void loadBalances();
  }, [loadBalances]);

  useEffect(() => {
    function handleToolbar(event: Event) {
      const detail = getToolbarDetail(event);
      if (detail?.view !== 'stock') return;
      if (detail.action === 'focus-filter') focusFirstField();
      if (detail.action === 'refresh') void refresh();
    }
    window.addEventListener(TOOLBAR_EVENT, handleToolbar);
    return () => window.removeEventListener(TOOLBAR_EVENT, handleToolbar);
  }, [refresh]);

  return (
    <section className="grid min-w-0 gap-4">
      <PageHeader
        action={
          <Button icon="refresh" variant="outline" type="button" onClick={() => void refresh()}>
            Оновити
          </Button>
        }
        description="Поточні облікові залишки майна за МВО та номенклатурою."
        icon="database"
        title="Залишки"
      />
      <StockSummaryCards balances={filteredBalances} />
      <StockFilterBar
        filters={draft}
        items={items}
        loading={loading}
        managements={managements}
        persons={persons}
        services={services}
        units={units}
        onApply={() => {
          setPage(1);
          setApplied(draft);
        }}
        onChange={setDraft}
        onRefresh={() => void refresh()}
        onReset={() => {
          setDraft(DEFAULT_STOCK_FILTERS);
          setApplied(DEFAULT_STOCK_FILTERS);
          setPage(1);
        }}
      />
      {error ? <ErrorState message={error} /> : null}
      {referenceError ? <ErrorState message={referenceError} /> : null}
      <StockBalancesTable balances={paged.items} loading={loading} />
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
    </section>
  );
}
