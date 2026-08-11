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
import { importSummary } from './import-model';

export function ImportDetailView({
  batch, rows, persons, filters, pagination, mappings,
  detailLoading, rowsLoading, actionLoading, error,
  canWrite, isOwner, canCommit, missingCounterparties,
  setFilters, setMappings, onBack, onApplyFilters, onSaveMappings,
  onValidate, onCommit, onCancel, onRollback, onDelete,
  accountingWorkspace = false,
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
  accountingWorkspace?: boolean;
}) {
  if (detailLoading && !batch) return <LoadingState label="Завантаження імпорту…" />;
  if (!batch) return <ErrorState message={error || 'Імпорт не знайдено.'} />;
  const hasErrors = (batch.preview?.errorRows ?? batch.errorRows) > 0;
  const hasWarnings = (batch.preview?.warningRows ?? batch.warningRows) > 0;

  if (accountingWorkspace) {
    const summary = importSummary(batch);
    const visibleErrors = rows.filter((row) => row.status === 'ERROR').slice(0, 5);
    const isTerminal = ['COMPLETED', 'PARTIALLY_COMPLETED', 'CANCELLED', 'ROLLED_BACK'].includes(batch.status);
    return (
      <section className="accounting-import-detail">
        <PageHeader
          action={<Button variant="outline" type="button" onClick={onBack}>Назад до завантажень</Button>}
          description="Перевірте розпізнані рядки та проведіть відомість після успішної перевірки."
          icon="upload"
          title="Перевірка відомості"
        />
        {error ? <ErrorState message={error} /> : null}
        <Card title="Дані завантаження">
          <dl className="accounting-import-detail__metadata">
            <Detail label="Файл"><span className="break-words font-semibold" title={batch.originalFilename}>{batch.originalFilename}</span></Detail>
            <Detail label="Дата">{new Date(batch.createdAt).toLocaleString('uk-UA')}</Detail>
            <Detail label="Хто завантажив">{batch.uploadedByUser?.username ?? 'Невідомо'}</Detail>
            <Detail label="Статус"><ImportStatusBadge status={batch.status} /></Detail>
          </dl>
        </Card>
        <Card title="Результат перевірки">
          <dl className="accounting-import-detail__summary">
            <Detail label="Усього рядків">{summary.total}</Detail>
            <Detail label="Успішних рядків">{summary.imported || summary.operations}</Detail>
            <Detail label="Рядків із помилками">{summary.errors}</Detail>
            <Detail label="МВО">{batch.preview?.matchedPersons ?? 0}</Detail>
            <Detail label="Номенклатур">{summary.newItems + summary.updatedItems}</Detail>
          </dl>
        </Card>
        {hasErrors ? (
          <Card title="Файл містить помилки">
            <div className="grid gap-3">
              <p className="text-sm text-[var(--color-text-secondary)]">Виправте зазначені рядки у файлі та завантажте відомість повторно.</p>
              {visibleErrors.length ? (
                <ul className="accounting-import-detail__errors">
                  {visibleErrors.map((row) => (
                    <li key={row.id}>
                      <strong>Рядок {row.rowNumber}</strong>
                      {row.externalAccountingCode ? <span>Код МВО: {row.externalAccountingCode}</span> : null}
                      <span>{row.message || 'Не вдалося обробити рядок.'}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm">Виберіть фільтр «З помилками», щоб переглянути проблемні рядки.</p>}
            </div>
          </Card>
        ) : hasWarnings ? (
          <div className="ui-state" data-tone="warning" role="status">
            <StatusBadge tone="warning">Є попередження</StatusBadge>
            <span>Перегляньте попередження перед проведенням відомості.</span>
          </div>
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
              <option value="">Усі</option>
              <option value="VALID">Готові</option>
              <option value="ERROR">З помилками</option>
            </Select>
          </label>
        </FilterBar>
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
        {canWrite && !isTerminal ? (
          <div className="accounting-import-detail__actions">
            <Button disabled={actionLoading} variant="outline" type="button" onClick={onValidate}>Перевірити повторно</Button>
            <Button disabled={!canCommit || actionLoading} type="button" onClick={onCommit}>Провести імпорт</Button>
            <Button disabled={actionLoading} variant="outline" type="button" onClick={onCancel}>Скасувати</Button>
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="grid min-w-0 gap-4">
      <PageHeader
        action={<Button variant="outline" type="button" onClick={onBack}>До списку імпортів</Button>}
        description={accountingWorkspace
          ? 'Завантажте CSV-файл оборотної відомості для оновлення облікових залишків МВО.'
          : 'Перевірка рядків і керування проведенням файлу.'}
        icon="upload"
        title={accountingWorkspace ? 'Імпорт бухгалтерських даних' : 'Імпорт'}
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
            <option value="">Усі</option>
            <option value="VALID">Готові</option>
            <option value="ERROR">З помилками</option>
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
