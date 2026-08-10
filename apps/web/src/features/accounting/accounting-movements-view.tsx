'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatDateTime, getErrorMessage } from '@/components/common/formatters';
import { PageHeader } from '@/components/layout/page-header';
import { Button, DataTable, ErrorState, FilterBar, Input, Pagination, Select, StatusBadge, Toast } from '@/components/ui';
import { formatQuantity } from '@/features/inventory/quantity-format';
import { downloadFileInBrowser } from '@/features/responsible-persons/my-stock-model';
import { fetchAllPages } from '@/lib/fetch-all-pages';
import type { AccountingMovementDetails, AccountingMovementFilters, AccountingMovementRow, Pagination as PaginationType, ResponsiblePerson } from '@/lib/types';
import { AccountingMovementDetailsModal } from './accounting-movement-details-modal';
import { accountingMovementsService } from './accounting-movements.service';

type FilterState = {
  dateFrom: string;
  dateTo: string;
  operationType: '' | NonNullable<AccountingMovementFilters['operationType']>;
  responsiblePersonId: string;
  destinationResponsiblePersonId: string;
  mvoCode: string;
  inventoryCode: string;
  inventoryName: string;
  transferRecipient: string;
  issueRecipient: string;
  status: '' | NonNullable<AccountingMovementFilters['status']>;
  search: string;
};

const EMPTY_FILTERS: FilterState = {
  dateFrom: '', dateTo: '', operationType: '', responsiblePersonId: '',
  destinationResponsiblePersonId: '', mvoCode: '', inventoryCode: '',
  inventoryName: '', transferRecipient: '', issueRecipient: '', status: '', search: '',
};

const EMPTY_PAGINATION: PaginationType = { page: 1, limit: 25, total: 0, totalPages: 0 };

export function AccountingMovementsView() {
  const [rows, setRows] = useState<AccountingMovementRow[]>([]);
  const [persons, setPersons] = useState<ResponsiblePerson[]>([]);
  const [draft, setDraft] = useState<FilterState>(EMPTY_FILTERS);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [pagination, setPagination] = useState(EMPTY_PAGINATION);
  const [selected, setSelected] = useState<AccountingMovementDetails | null>(null);
  const [detailsLoadingId, setDetailsLoadingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [referenceError, setReferenceError] = useState('');
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await accountingMovementsService.list({ ...toApiFilters(filters), page, limit: Math.min(limit, 100) });
      setRows(result.items);
      setPagination(result.pagination);
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [filters, limit, page]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    let active = true;
    fetchAllPages((pagination) => accountingMovementsService.persons({ ...pagination }))
      .then((result) => { if (active) setPersons(result); })
      .catch((reason) => { if (active) setReferenceError(`Не вдалося завантажити довідник МВО: ${getErrorMessage(reason)}`); });
    return () => { active = false; };
  }, []);

  async function openDetails(id: string) {
    setDetailsLoadingId(id);
    setError('');
    try {
      setSelected(await accountingMovementsService.details(id));
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setDetailsLoadingId('');
    }
  }

  async function openDocumentDetails(id: string) {
    setDetailsLoadingId(id);
    setError('');
    try {
      setSelected(await accountingMovementsService.documentDetails(id));
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setDetailsLoadingId('');
    }
  }

  async function exportCsv() {
    setExporting(true);
    setError('');
    try {
      downloadFileInBrowser(await accountingMovementsService.exportCsv(toApiFilters(filters)));
      setToast('Історію руху експортовано у CSV.');
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setExporting(false);
    }
  }

  function apply(next = draft) {
    setFilters(next);
    setPage(1);
  }

  return <section className="grid min-w-0 gap-4">
    <PageHeader
      action={<Button disabled={exporting || loading} type="button" onClick={() => void exportCsv()}>{exporting ? 'Формування…' : 'Експортувати CSV'}</Button>}
      description="Єдиний read-only журнал надходжень, передач, видач і скасувань."
      icon="journal"
      title="Рух майна"
    />
    <FilterBar
      dateFrom={draft.dateFrom}
      dateTo={draft.dateTo}
      loading={loading}
      search={draft.search}
      onApply={() => apply()}
      onDateFromChange={(dateFrom) => setDraft((current) => ({ ...current, dateFrom }))}
      onDateToChange={(dateTo) => setDraft((current) => ({ ...current, dateTo }))}
      onRefresh={() => void load()}
      onReset={() => { setDraft(EMPTY_FILTERS); apply(EMPTY_FILTERS); }}
      onSearchChange={(search) => setDraft((current) => ({ ...current, search }))}
    >
      <FilterField label="Тип операції"><Select value={draft.operationType} onChange={(event) => setDraft((current) => ({ ...current, operationType: event.target.value as FilterState['operationType'] }))}>
        <option value="">Усі операції</option><option value="IMPORT">Надходження</option><option value="MVO_TRANSFER">Передача МВО</option><option value="ISSUE">Видача з передачі</option>
      </Select></FilterField>
      <FilterField label="Код МВО"><Input value={draft.mvoCode} onChange={(event) => setDraft((current) => ({ ...current, mvoCode: event.target.value }))} /></FilterField>
      <FilterField label="МВО"><Select value={draft.responsiblePersonId} onChange={(event) => setDraft((current) => ({ ...current, responsiblePersonId: event.target.value }))}>
        <option value="">Усі МВО</option>{persons.map((person) => <option key={person.id} value={person.id}>{person.externalAccountingCode ?? person.personnelNumber} — {person.lastName} {person.firstName} {person.middleName ?? ''}</option>)}
      </Select></FilterField>
      <FilterField label="Кому передано"><Select value={draft.destinationResponsiblePersonId} onChange={(event) => setDraft((current) => ({ ...current, destinationResponsiblePersonId: event.target.value }))}>
        <option value="">Усі МВО</option>{persons.map((person) => <option key={person.id} value={person.id}>{person.externalAccountingCode ?? person.personnelNumber} — {person.lastName} {person.firstName} {person.middleName ?? ''}</option>)}
      </Select></FilterField>
      <FilterField label="Код/ПІБ, кому передано"><Input value={draft.transferRecipient} onChange={(event) => setDraft((current) => ({ ...current, transferRecipient: event.target.value }))} /></FilterField>
      <FilterField label="Кому видано"><Input value={draft.issueRecipient} onChange={(event) => setDraft((current) => ({ ...current, issueRecipient: event.target.value }))} /></FilterField>
      <FilterField label="Код номенклатури"><Input value={draft.inventoryCode} onChange={(event) => setDraft((current) => ({ ...current, inventoryCode: event.target.value }))} /></FilterField>
      <FilterField label="Назва номенклатури"><Input value={draft.inventoryName} onChange={(event) => setDraft((current) => ({ ...current, inventoryName: event.target.value }))} /></FilterField>
      <FilterField label="Статус"><Select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as FilterState['status'] }))}>
        <option value="">Усі статуси</option><option value="POSTED">Проведено</option><option value="CANCELLED">Скасовано</option><option value="COMPLETED">Імпорт проведено</option>
      </Select></FilterField>
    </FilterBar>
    {referenceError ? <div className="ui-alert" data-tone="warning" role="status">{referenceError}</div> : null}
    {error ? <ErrorState message={error} /> : null}
    <DataTable
      ariaLabel="Бухгалтерський журнал руху майна"
      columns={[
        { label: 'Дата' }, { label: 'Тип операції' }, { label: 'Документ' },
        { label: 'МВО' }, { label: 'Код МВО' }, { label: 'Номенклатура' },
        { label: 'Код номенклатури' }, { label: 'Кількість', numeric: true },
        { label: 'Кому передано' }, { label: 'Кому видано' },
        { label: 'Пов’язаний документ' }, { label: 'Статус' }, { label: 'Документ/файл' },
      ]}
      emptyMessage="Рухів майна за вибраними фільтрами немає."
      loading={loading}
      responsiveMode="cards-wide"
      rowKeys={rows.map((row) => row.id)}
      rows={rows.map((row) => [
        formatDateTime(row.occurredAt),
        <StatusBadge key={`operation-${row.id}`} tone={operationTone(row)}>{row.operationLabel}</StatusBadge>,
        <Button disabled={detailsLoadingId === row.id} key={`document-${row.id}`} size="compact" title={`Відкрити ${row.documentLabel}`} type="button" variant="link" onClick={() => void openDetails(row.id)}>{detailsLoadingId === row.id ? 'Відкриття…' : row.documentLabel}</Button>,
        row.responsiblePerson.fullName,
        row.responsiblePerson.externalAccountingCode ?? row.responsiblePerson.personnelNumber,
        row.inventoryItem.name,
        row.inventoryItem.externalCode,
        formatSignedQuantity(row.quantity),
        row.transferredTo ? `${row.transferredTo.externalAccountingCode ?? row.transferredTo.personnelNumber} — ${row.transferredTo.fullName}` : '—',
        row.issuedTo ?? '—',
        row.relatedDocument ? <Button disabled={detailsLoadingId === row.relatedDocument.id} key={`related-${row.id}`} size="compact" type="button" variant="link" onClick={() => void openDocumentDetails(row.relatedDocument!.id)}>{detailsLoadingId === row.relatedDocument.id ? 'Відкриття…' : row.relatedDocument.label}</Button> : '—',
        <StatusBadge key={`status-${row.id}`} tone={statusTone(row.status)}>{row.statusLabel}</StatusBadge>,
        row.hasAttachment ? <StatusBadge key={`attachment-${row.id}`} tone="info">Є документ</StatusBadge> : '—',
      ])}
    />
    <Pagination
      limit={pagination.limit}
      limits={[25, 50, 100]}
      page={pagination.page}
      total={pagination.total}
      totalPages={pagination.totalPages}
      onLimitChange={(nextLimit) => { setLimit(nextLimit); setPage(1); }}
      onPage={setPage}
    />
    {selected ? <AccountingMovementDetailsModal details={selected} openingDocumentId={detailsLoadingId} onOpenDocument={(id) => void openDocumentDetails(id)} onClose={() => setSelected(null)} /> : null}
    {toast ? <Toast message={toast} tone="success" onClose={() => setToast('')} /> : null}
  </section>;
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="filter-bar__field"><span>{label}</span>{children}</label>;
}

function toApiFilters(filters: FilterState): AccountingMovementFilters {
  return {
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    operationType: filters.operationType || undefined,
    responsiblePersonId: filters.responsiblePersonId || undefined,
    destinationResponsiblePersonId: filters.destinationResponsiblePersonId || undefined,
    mvoCode: filters.mvoCode.trim() || undefined,
    inventoryCode: filters.inventoryCode.trim() || undefined,
    inventoryName: filters.inventoryName.trim() || undefined,
    transferRecipient: filters.transferRecipient.trim() || undefined,
    issueRecipient: filters.issueRecipient.trim() || undefined,
    status: filters.status || undefined,
    search: filters.search.trim() || undefined,
  };
}

function formatSignedQuantity(value: string) {
  if (value.startsWith('+')) return `+${formatQuantity(value.slice(1))}`;
  return formatQuantity(value);
}

function operationTone(row: AccountingMovementRow): 'success' | 'info' {
  if (row.operationType === 'IMPORT') return 'success';
  return 'info';
}

function statusTone(status: AccountingMovementRow['status']): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'POSTED' || status === 'COMPLETED') return 'success';
  if (status === 'PARTIALLY_COMPLETED') return 'warning';
  if (status === 'CANCELLED') return 'danger';
  return 'neutral';
}
