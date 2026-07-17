import type { Dispatch, SetStateAction } from 'react';
import type { ImportBatch, ImportRow, ResponsiblePerson } from '@/lib/types';
import { importTypeLabel } from '@/components/common';
import { PageHeader } from '@/components/layout/page-header';
import {
  Button,
  Card,
  ErrorState,
  FilterBar,
  LoadingState,
  Pagination,
  Select,
  StatusBadge,
} from '@/components/ui';
import type { ImportRowFilters } from './use-imports-controller';
import { ImportActionsPanel } from './import-actions-panel';
import { ImportMappingsPanel } from './import-mappings-panel';
import { ImportRowsTable } from './import-rows-table';
import { ImportStatusBadge } from './import-status-badge';
import { ImportSummaryCards } from './import-summary-cards';

export function ImportDetailView({
  batch, rows, persons, filters, pagination, mappings,
  detailLoading, rowsLoading, actionLoading, error,
  canWrite, isOwner, canCommit, missingCounterparties,
  setFilters, setMappings, onBack, onApplyFilters, onSaveMappings,
  onValidate, onCommit, onCancel, onRollback, onDelete,
}: {
  batch: ImportBatch | null;
  rows: ImportRow[];
  persons: ResponsiblePerson[];
  filters: ImportRowFilters;
  pagination: { page: number; limit: number; total: number; totalPages: number };
  mappings: Record<string, { responsiblePersonId: string; save: boolean }>;
  detailLoading: boolean;
  rowsLoading: boolean;
  actionLoading: boolean;
  error: string;
  canWrite: boolean;
  isOwner: boolean;
  canCommit: boolean;
  missingCounterparties: string[];
  setFilters: Dispatch<SetStateAction<ImportRowFilters>>;
  setMappings: Dispatch<SetStateAction<Record<string, { responsiblePersonId: string; save: boolean }>>>;
  onBack: () => void;
  onApplyFilters: (filters: ImportRowFilters) => void;
  onSaveMappings: () => void;
  onValidate: () => void;
  onCommit: () => void;
  onCancel: () => void;
  onRollback: () => void;
  onDelete: () => void;
}) {
  if (detailLoading && !batch) return <LoadingState label="Завантаження імпорту…" />;
  if (!batch) return <ErrorState message={error || 'Імпорт не знайдено.'} />;
  const hasErrors = (batch.preview?.errorRows ?? batch.errorRows) > 0;
  const hasWarnings = (batch.preview?.warningRows ?? batch.warningRows) > 0;

  return (
    <section className="grid min-w-0 gap-4">
      <PageHeader
        action={<Button variant="outline" type="button" onClick={onBack}>До списку імпортів</Button>}
        description="Перевірка рядків і керування проведенням файлу."
        icon="upload"
        title="Імпорт"
      />
      {error ? <ErrorState message={error} /> : null}
      <Card title="Загальні дані файлу">
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Detail label="Назва файлу"><span className="break-all font-semibold">{batch.originalFilename}</span></Detail>
          <Detail label="Тип">{importTypeLabel(batch.type)}</Detail>
          <Detail label="Статус"><ImportStatusBadge status={batch.status} /></Detail>
          <Detail label="Кодування">{batch.encoding}</Detail>
          <Detail label="Роздільник">{batch.delimiter === 'tab' ? 'Табуляція' : batch.delimiter}</Detail>
          <Detail label="Розмір">{new Intl.NumberFormat('uk-UA').format(batch.fileSize)} байт</Detail>
          <Detail label="Завантажено">{new Date(batch.createdAt).toLocaleString('uk-UA')}</Detail>
          <Detail label="Завершено">{batch.completedAt ? new Date(batch.completedAt).toLocaleString('uk-UA') : '—'}</Detail>
          <Detail label="Користувач"><span title="Автор імпорту не повертається поточним API">Не надається API</span></Detail>
        </dl>
      </Card>
      <ImportSummaryCards batch={batch} />
      {hasErrors || hasWarnings ? (
        <div className="ui-state" data-tone={hasErrors ? 'danger' : 'warning'} role="status">
          <StatusBadge tone={hasErrors ? 'danger' : 'warning'}>{hasErrors ? 'Є помилки' : 'Є попередження'}</StatusBadge>
          <strong>Потрібна увага перед проведенням</strong>
          <span>Помилки: {batch.preview?.errorRows ?? batch.errorRows}. Попередження: {batch.preview?.warningRows ?? batch.warningRows}.</span>
        </div>
      ) : null}
      {canWrite ? (
        <ImportMappingsPanel
          counterparties={missingCounterparties}
          loading={actionLoading}
          mappings={mappings}
          persons={persons}
          onMappingsChange={setMappings}
          onSave={onSaveMappings}
        />
      ) : null}
      <FilterBar
        loading={rowsLoading}
        search={filters.search}
        onApply={() => onApplyFilters({ ...filters, page: 1 })}
        onRefresh={() => onApplyFilters(filters)}
        onReset={() => {
          const reset = { search: '', status: '', page: 1, limit: filters.limit };
          setFilters(reset);
          onApplyFilters(reset);
        }}
        onSearchChange={(search) => setFilters((current) => ({ ...current, search, page: 1 }))}
      >
        <label className="filter-bar__field"><span>Статус рядка</span>
          <Select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value, page: 1 }))}>
            <option value="">Усі статуси</option>
            <option value="VALID">VALID</option><option value="WARNING">WARNING</option>
            <option value="ERROR">ERROR</option><option value="SKIPPED">SKIPPED</option>
            <option value="IMPORTED">IMPORTED</option>
          </Select>
        </label>
      </FilterBar>
      {error ? <ErrorState message={error} /> : null}
      <ImportRowsTable loading={rowsLoading} rows={rows} />
      <Pagination
        limit={pagination.limit}
        page={pagination.page}
        total={pagination.total}
        totalPages={pagination.totalPages}
        onLimitChange={(limit) => {
          const next = { ...filters, page: 1, limit };
          setFilters(next);
          onApplyFilters(next);
        }}
        onPage={(page) => {
          const next = { ...filters, page };
          setFilters(next);
          onApplyFilters(next);
        }}
      />
      <ImportActionsPanel
        batch={batch}
        canCommit={canCommit}
        canWrite={canWrite}
        isOwner={isOwner}
        loading={actionLoading}
        onCancel={onCancel}
        onCommit={onCommit}
        onDelete={onDelete}
        onRollback={onRollback}
        onValidate={onValidate}
      />
    </section>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0"><dt className="font-semibold text-[var(--color-text-secondary)]">{label}</dt><dd className="mt-1">{children}</dd></div>;
}
