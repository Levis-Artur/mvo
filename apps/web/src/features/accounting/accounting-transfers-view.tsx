'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDateTime, getErrorMessage, fullName } from '@/components/common/formatters';
import { PageHeader } from '@/components/layout/page-header';
import {
  Button,
  DataTable,
  ErrorState,
  FilterBar,
  Pagination,
  Select,
  StatusBadge,
  Toast,
} from '@/components/ui';
import { fetchAllPages } from '@/lib/fetch-all-pages';
import type {
  AccountingTransferExportFilters,
  AccountingTransferExportBatch,
  AccountingTransferFilters,
  AccountingTransferRow,
  AuthUser,
  InventoryItem,
  Pagination as PaginationType,
  ResponsiblePerson,
} from '@/lib/types';
import { downloadFileInBrowser } from '@/features/responsible-persons/my-stock-model';
import { formatQuantity } from '@/features/inventory/quantity-format';
import { documentNumberLabel } from '@/features/stock-documents/stock-document-rules';
import { accountingTransfersService } from './accounting-transfers.service';

type Tab = 'register' | 'exports';
type FilterState = Required<Pick<AccountingTransferFilters,
  'dateFrom' | 'dateTo' | 'sourceResponsiblePersonId' |
  'destinationResponsiblePersonId' | 'inventoryItemId' | 'documentNumber'>> & {
  status: '' | NonNullable<AccountingTransferFilters['status']>;
  exportState: '' | NonNullable<AccountingTransferFilters['exportState']>;
};

const EMPTY_FILTERS: FilterState = {
  dateFrom: '',
  dateTo: '',
  sourceResponsiblePersonId: '',
  destinationResponsiblePersonId: '',
  inventoryItemId: '',
  documentNumber: '',
  status: '',
  exportState: '',
};
const EMPTY_PAGINATION: PaginationType = { page: 1, limit: 20, total: 0, totalPages: 0 };

export function AccountingTransfersView({ initialTab = 'register', user }: {
  initialTab?: Tab;
  user: Pick<AuthUser, 'role'> | null;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [rows, setRows] = useState<AccountingTransferRow[]>([]);
  const [batches, setBatches] = useState<AccountingTransferExportBatch[]>([]);
  const [persons, setPersons] = useState<ResponsiblePerson[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [draft, setDraft] = useState<FilterState>(EMPTY_FILTERS);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [pagination, setPagination] = useState(EMPTY_PAGINATION);
  const [batchPage, setBatchPage] = useState(1);
  const [batchLimit, setBatchLimit] = useState(20);
  const [batchPagination, setBatchPagination] = useState(EMPTY_PAGINATION);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [referenceError, setReferenceError] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => setTab(initialTab), [initialTab]);

  const loadRegister = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await accountingTransfersService.list({
        ...toApiFilters(filters),
        page,
        limit: Math.min(limit, 100),
      });
      setRows(result.items);
      setPagination(result.pagination);
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [filters, limit, page]);

  const loadBatches = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await accountingTransfersService.batches({ page: batchPage, limit: Math.min(batchLimit, 100) });
      setBatches(result.items);
      setBatchPagination(result.pagination);
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [batchLimit, batchPage]);

  useEffect(() => {
    if (tab === 'register') void loadRegister();
    else void loadBatches();
  }, [loadBatches, loadRegister, tab]);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchAllPages((pagination) => accountingTransfersService.persons({ ...pagination, isActive: true })),
      fetchAllPages((pagination) => accountingTransfersService.inventoryItems({ ...pagination })),
    ]).then(([loadedPersons, loadedItems]) => {
      if (!active) return;
      setPersons(loadedPersons);
      setItems(loadedItems);
    }).catch((reason) => {
      if (active) setReferenceError(`Не вдалося завантажити довідники: ${getErrorMessage(reason)}`);
    });
    return () => { active = false; };
  }, []);

  async function exportCsv() {
    setExporting(true);
    setError('');
    try {
      downloadFileInBrowser(
        await accountingTransfersService.exportCsv(toExportFilters(filters)),
      );
      setToast('CSV сформовано. Пакет експорту збережено в історії.');
      await Promise.all([loadRegister(), loadBatches()]);
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setExporting(false);
    }
  }

  async function downloadBatch(id: string) {
    setExporting(true);
    setError('');
    try {
      downloadFileInBrowser(await accountingTransfersService.downloadBatch(id));
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setExporting(false);
    }
  }

  return <section className="grid min-w-0 gap-4">
    <PageHeader
      action={tab === 'register' && user && user.role !== 'AUDITOR' ? <Button disabled={exporting} type="button" onClick={() => void exportCsv()}>{exporting ? 'Формування…' : 'Експортувати CSV'}</Button> : undefined}
      description="Нові передачі між МВО для бухгалтерського опрацювання. Експорт не змінює залишки та не пов’язує передачі з імпортами."
      icon="journal"
      title="Передачі МВО для бухгалтерії"
    />
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Бухгалтерські передачі">
      <Button aria-selected={tab === 'register'} role="tab" variant={tab === 'register' ? 'primary' : 'outline'} type="button" onClick={() => { setTab('register'); router.push('/accounting/mvo-transfers'); }}>Реєстр передач</Button>
      <Button aria-selected={tab === 'exports'} role="tab" variant={tab === 'exports' ? 'primary' : 'outline'} type="button" onClick={() => { setTab('exports'); router.push('/accounting/mvo-transfers/exports'); }}>Історія експортів</Button>
    </div>
    {referenceError ? <div className="ui-alert" data-tone="warning" role="status">{referenceError}</div> : null}
    {error ? <ErrorState message={error} /> : null}
    {tab === 'register' ? <>
      <FilterBar
        dateFrom={draft.dateFrom}
        dateTo={draft.dateTo}
        loading={loading}
        search={draft.documentNumber}
        onApply={() => { setFilters(draft); setPage(1); }}
        onDateFromChange={(dateFrom) => setDraft((current) => ({ ...current, dateFrom }))}
        onDateToChange={(dateTo) => setDraft((current) => ({ ...current, dateTo }))}
        onRefresh={() => void loadRegister()}
        onReset={() => { setDraft(EMPTY_FILTERS); setFilters(EMPTY_FILTERS); setPage(1); }}
        onSearchChange={(documentNumber) => setDraft((current) => ({ ...current, documentNumber }))}
      >
        <FilterField label="Відправник"><Select value={draft.sourceResponsiblePersonId} onChange={(event) => setDraft((current) => ({ ...current, sourceResponsiblePersonId: event.target.value }))}><option value="">Усі</option>{persons.map((person) => <option key={person.id} value={person.id}>{person.personnelNumber} — {fullName(person)}</option>)}</Select></FilterField>
        <FilterField label="Одержувач"><Select value={draft.destinationResponsiblePersonId} onChange={(event) => setDraft((current) => ({ ...current, destinationResponsiblePersonId: event.target.value }))}><option value="">Усі</option>{persons.map((person) => <option key={person.id} value={person.id}>{person.personnelNumber} — {fullName(person)}</option>)}</Select></FilterField>
        <FilterField label="Показати документи, що містять номенклатуру"><Select value={draft.inventoryItemId} onChange={(event) => setDraft((current) => ({ ...current, inventoryItemId: event.target.value }))}><option value="">Уся</option>{items.map((item) => <option key={item.id} value={item.id}>{item.externalCode} — {item.name}</option>)}</Select></FilterField>
        <FilterField label="Статус"><Select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as FilterState['status'] }))}><option value="">Усі</option><option value="DRAFT">Чернетка</option><option value="POSTED">Проведено</option><option value="CANCELLED">Скасовано</option></Select></FilterField>
        <FilterField label="Експорт"><Select value={draft.exportState} onChange={(event) => setDraft((current) => ({ ...current, exportState: event.target.value as FilterState['exportState'] }))}><option value="">Усі</option><option value="NOT_EXPORTED">Не експортовано</option><option value="EXPORTED">Експортовано</option></Select></FilterField>
      </FilterBar>
      <DataTable
        ariaLabel="Передачі МВО для бухгалтерії"
        columns={[
          { label: 'Дата' }, { label: 'Номер документа' }, { label: 'МВО-відправник' },
          { label: 'МВО-одержувач' }, { label: 'Код' }, { label: 'Назва' },
          { label: 'Одиниця' }, { label: 'Кількість', numeric: true },
          { label: 'Статус' }, { label: 'Дата проведення' },
        ]}
        emptyMessage="Нових передач MVO_TRANSFER за вибраними фільтрами немає."
        loading={loading}
        rows={rows.map((row) => [
          formatDate(row.documentDate),
          documentNumberLabel(row.displayNumber),
          `${row.sourceResponsiblePerson.personnelNumber} — ${row.sourceResponsiblePerson.fullName}`,
          row.destinationResponsiblePerson ? `${row.destinationResponsiblePerson.personnelNumber} — ${row.destinationResponsiblePerson.fullName}` : '—',
          row.inventoryItem.externalCode,
          row.inventoryItem.name,
          row.inventoryItem.unitOfMeasure ?? '—',
          formatQuantity(row.quantity),
          <div className="flex flex-wrap gap-1" key="status">
            <StatusBadge tone={statusTone(row.status)}>{statusLabel(row.status)}</StatusBadge>
            {row.exportState === 'EXPORTED' ? <StatusBadge tone="info">Передано бухгалтерії</StatusBadge> : null}
          </div>,
          row.postedAt ? formatDateTime(row.postedAt) : '—',
        ])}
        tableClassName="accounting-transfers-table"
      />
      <Pagination limit={pagination.limit} page={pagination.page} total={pagination.total} totalPages={pagination.totalPages} onLimitChange={(next) => { setLimit(Math.min(next, 100)); setPage(1); }} onPage={setPage} />
    </> : <>
      <DataTable
        ariaLabel="Історія пакетів експорту передач МВО"
        columns={[{ label: 'Дата' }, { label: 'Файл' }, { label: 'Документів', numeric: true }, { label: 'Рядків', numeric: true }, { label: 'Користувач' }, { label: 'Дії', actions: true }]}
        emptyMessage="Пакети експорту ще не створювалися."
        loading={loading}
        rows={batches.map((batch) => [
          formatDateTime(batch.createdAt), batch.filename, batch.documentCount, batch.rowCount,
          batch.createdByUser.username,
          <Button disabled={exporting} key="download" size="compact" variant="outline" type="button" onClick={() => void downloadBatch(batch.id)}>Завантажити повторно</Button>,
        ])}
      />
      <Pagination limit={batchPagination.limit} page={batchPagination.page} total={batchPagination.total} totalPages={batchPagination.totalPages} onLimitChange={(next) => { setBatchLimit(Math.min(next, 100)); setBatchPage(1); }} onPage={setBatchPage} />
    </>}
    {toast ? <Toast message={toast} onClose={() => setToast('')} /> : null}
  </section>;
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="filter-bar__field"><span>{label}</span>{children}</label>;
}

function toApiFilters(filters: FilterState): AccountingTransferFilters {
  return {
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    sourceResponsiblePersonId: filters.sourceResponsiblePersonId || undefined,
    destinationResponsiblePersonId: filters.destinationResponsiblePersonId || undefined,
    inventoryItemId: filters.inventoryItemId || undefined,
    status: filters.status || undefined,
    exportState: filters.exportState || undefined,
    documentNumber: filters.documentNumber.trim() || undefined,
  };
}

function toExportFilters(filters: FilterState): AccountingTransferExportFilters {
  return {
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    sourceResponsiblePersonId: filters.sourceResponsiblePersonId || undefined,
    destinationResponsiblePersonId:
      filters.destinationResponsiblePersonId || undefined,
    inventoryItemId: filters.inventoryItemId || undefined,
    documentNumber: filters.documentNumber.trim() || undefined,
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('uk-UA').format(new Date(value));
}

function statusLabel(status: AccountingTransferRow['status']) {
  if (status === 'POSTED') return 'Проведено';
  if (status === 'CANCELLED') return 'Скасовано';
  return 'Чернетка';
}

function statusTone(status: AccountingTransferRow['status']): 'success' | 'danger' | 'warning' {
  if (status === 'POSTED') return 'success';
  if (status === 'CANCELLED') return 'danger';
  return 'warning';
}
