'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { InventoryItem, ResponsiblePerson, StockTransaction } from '@/lib/types';
import { getErrorMessage } from '@/components/common';
import { PageHeader } from '@/components/layout/page-header';
import {
  Button,
  ErrorState,
  FilterBar,
  Input,
  Pagination,
  Select,
} from '@/components/ui';
import { fetchAllPages } from '@/lib/fetch-all-pages';
import { focusFirstField, getToolbarDetail, TOOLBAR_EVENT } from '@/components/layout/toolbar-events';
import { inventoryService as apiClient } from './inventory.service';
import { TransactionDetailsModal } from './transaction-details-modal';
import {
  DEFAULT_TRANSACTION_FILTERS,
  filterTransactions,
  paginateTransactions,
  transactionApiQuery,
  type TransactionFilterDraft,
} from './transaction-model';
import { TransactionsTable } from './transactions-table';

export function TransactionsView() {
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [persons, setPersons] = useState<ResponsiblePerson[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [draft, setDraft] = useState<TransactionFilterDraft>(DEFAULT_TRANSACTION_FILTERS);
  const [applied, setApplied] = useState<TransactionFilterDraft>(DEFAULT_TRANSACTION_FILTERS);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [selected, setSelected] = useState<StockTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [referenceError, setReferenceError] = useState('');

  const filtered = useMemo(() => filterTransactions(transactions, applied), [applied, transactions]);
  const paged = useMemo(() => paginateTransactions(filtered, page, limit), [filtered, limit, page]);

  const loadReferences = useCallback(async () => {
    setReferenceError('');
    try {
      const [nextPersons, nextItems] = await Promise.all([
        fetchAllPages((pagination) => apiClient.responsiblePersons({ isActive: true, ...pagination })),
        fetchAllPages((pagination) => apiClient.inventoryItems(pagination)),
      ]);
      setPersons(nextPersons);
      setItems(nextItems);
    } catch (reason) {
      setReferenceError(getErrorMessage(reason));
    }
  }, []);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = transactionApiQuery(applied);
      const result = await fetchAllPages((pagination) => apiClient.stockTransactions({ ...query, ...pagination }));
      setTransactions(result);
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [applied]);

  useEffect(() => { void loadReferences(); }, [loadReferences]);
  useEffect(() => { void loadTransactions(); }, [loadTransactions]);

  useEffect(() => {
    function handleToolbar(event: Event) {
      const detail = getToolbarDetail(event);
      if (detail?.view !== 'transactions') return;
      if (detail.action === 'focus-filter') focusFirstField();
      if (detail.action === 'refresh') void loadTransactions();
    }
    const refresh = () => void loadTransactions();
    window.addEventListener(TOOLBAR_EVENT, handleToolbar);
    window.addEventListener('mvo:refresh-transactions', refresh);
    return () => {
      window.removeEventListener(TOOLBAR_EVENT, handleToolbar);
      window.removeEventListener('mvo:refresh-transactions', refresh);
    };
  }, [loadTransactions]);

  function apply(filters = draft) {
    setPage(1);
    setApplied(filters);
  }

  return (
    <section className="grid min-w-0 gap-4">
      <PageHeader
        action={<Button disabled={loading} icon="refresh" variant="outline" type="button" onClick={() => void loadTransactions()}>Оновити</Button>}
        description="Операції із залишками доступні лише для перегляду."
        icon="journal"
        title="Журнал операцій"
      />
      <FilterBar
        dateFrom={draft.dateFrom}
        dateTo={draft.dateTo}
        loading={loading}
        onApply={() => apply()}
        onDateFromChange={(dateFrom) => setDraft((current) => ({ ...current, dateFrom }))}
        onDateToChange={(dateTo) => setDraft((current) => ({ ...current, dateTo }))}
        onRefresh={() => void loadTransactions()}
        onReset={() => {
          setDraft(DEFAULT_TRANSACTION_FILTERS);
          apply(DEFAULT_TRANSACTION_FILTERS);
        }}
      >
        <FilterField label="Тип операції"><Select value={draft.type} onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value as TransactionFilterDraft['type'] }))}>
          <option value="">Усі типи</option><option value="INITIAL_BALANCE">Початковий залишок</option>
          <option value="RECEIPT">Надходження</option><option value="MANUAL_RECEIPT">Ручне надходження</option>
          <option value="ADJUSTMENT_INCREASE">Коригування: збільшення</option><option value="ADJUSTMENT_DECREASE">Коригування: зменшення</option>
        </Select></FilterField>
        <FilterField label="МВО"><Select value={draft.responsiblePersonId} onChange={(event) => setDraft((current) => ({ ...current, responsiblePersonId: event.target.value }))}>
          <option value="">Усі МВО</option>{persons.map((person) => <option key={person.id} value={person.id}>{person.personnelNumber} — {person.lastName} {person.firstName}</option>)}
        </Select></FilterField>
        <FilterField label="Номенклатура"><Select value={draft.inventoryItemId} onChange={(event) => setDraft((current) => ({ ...current, inventoryItemId: event.target.value }))}>
          <option value="">Уся номенклатура</option>{items.map((item) => <option key={item.id} value={item.id}>{item.externalCode} — {item.name}</option>)}
        </Select></FilterField>
        <FilterField label="Документ або імпорт"><Input value={draft.document} onChange={(event) => setDraft((current) => ({ ...current, document: event.target.value }))} /></FilterField>
        <FilterField label="Користувач"><Input disabled placeholder="Не надається API" value={draft.user} onChange={() => undefined} /></FilterField>
        <FilterField label="Статус"><Select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as TransactionFilterDraft['status'] }))}>
          <option value="">Усі</option><option value="POSTED">Проведено</option>
        </Select></FilterField>
      </FilterBar>
      {error ? <ErrorState message={error} /> : null}
      {referenceError ? <ErrorState message={referenceError} /> : null}
      <TransactionsTable loading={loading} transactions={paged.items} onOpen={setSelected} />
      <Pagination
        limit={paged.pagination.limit}
        page={paged.pagination.page}
        total={paged.pagination.total}
        totalPages={paged.pagination.totalPages}
        onLimitChange={(nextLimit) => { setLimit(nextLimit); setPage(1); }}
        onPage={setPage}
      />
      {selected ? <TransactionDetailsModal transaction={selected} onClose={() => setSelected(null)} /> : null}
    </section>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="filter-bar__field"><span>{label}</span>{children}</label>;
}
