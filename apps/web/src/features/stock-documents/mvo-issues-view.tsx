'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/app/ui/auth-context';
import { getMvoErrorMessage } from '@/components/common';
import { PageHeader } from '@/components/layout/page-header';
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  Pagination,
  Select,
  StatusBadge,
  Toast,
} from '@/components/ui';
import { formatQuantity } from '@/features/inventory/quantity-format';
import type {
  AvailableStockSource,
  CreateIssueRealizationInput,
  IssueRealization,
  IssueHistoryFilters,
  IssueHistoryItem,
  Pagination as PaginationState,
  StockDocument,
  StockDocumentInput,
  StockDocumentStatus,
} from '@/lib/types';
import { downloadFileInBrowser } from '../responsible-persons/my-stock-model';
import { CancelDocumentModal } from './cancel-document-modal';
import { submitNewIssue } from './issue-submit';
import { MvoIssueDetailsModal } from './mvo-issue-details-modal';
import { StockDocumentForm } from './stock-document-form';
import { documentNumberLabel } from './stock-document-rules';
import { StockDocumentStatusBadge } from './stock-document-status-badge';
import { stockDocumentsService } from './stock-documents.service';
import { IssueRealizationFormModal } from './issue-realization-form-modal';

type IssueFilterState = {
  search: string;
  dateFrom: string;
  dateTo: string;
  status: '' | Extract<StockDocumentStatus, 'POSTED' | 'CANCELLED'>;
  hasAttachment: '' | 'true' | 'false';
};

const EMPTY_FILTERS: IssueFilterState = {
  search: '',
  dateFrom: '',
  dateTo: '',
  status: '',
  hasAttachment: '',
};

const EMPTY_PAGINATION: PaginationState = {
  page: 1,
  limit: 25,
  total: 0,
  totalPages: 0,
};

export function MvoIssuesView() {
  const { user } = useAuth();
  const [items, setItems] = useState<IssueHistoryItem[]>([]);
  const [pagination, setPagination] = useState(EMPTY_PAGINATION);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<25 | 50 | 100>(25);
  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sources, setSources] = useState<AvailableStockSource[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [sourcesError, setSourcesError] = useState('');
  const [actionError, setActionError] = useState('');
  const [selected, setSelected] = useState<StockDocument | null>(null);
  const [realizingIssue, setRealizingIssue] = useState<StockDocument | null>(null);
  const [realizationSaving, setRealizationSaving] = useState(false);
  const [realizationError, setRealizationError] = useState('');
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState('');
  const [toastTone, setToastTone] = useState<'success' | 'error'>('success');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await stockDocumentsService.issueHistory({
        ...toApiFilters(filters),
        page,
        limit,
      });
      setItems(response.items);
      setPagination(response.pagination);
    } catch (reason) {
      setError(getMvoErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [filters, limit, page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function loadSources() {
    setSourcesLoading(true);
    setSourcesError('');
    try {
      setSources(await stockDocumentsService.availableToMe());
    } catch (reason) {
      setSourcesError(
        `Не вдалося завантажити майно: ${getMvoErrorMessage(reason)}`,
      );
    } finally {
      setSourcesLoading(false);
    }
  }

  function openCreate() {
    setActionError('');
    setCreating(true);
    void loadSources();
  }

  async function submitIssue(input: StockDocumentInput, files: File[]) {
    if (saving) return;
    setSaving(true);
    setActionError('');
    try {
      await submitNewIssue(
        input,
        files,
        stockDocumentsService.createAndPostIssue,
      );
      setCreating(false);
      setSources([]);
      setToastTone('success');
      setToast('Видачу успішно оформлено.');
      setPage(1);
      await load();
      window.dispatchEvent(new CustomEvent('mvo:refresh-stock'));
      window.dispatchEvent(new CustomEvent('mvo:refresh-transactions'));
      window.dispatchEvent(new CustomEvent('mvo:refresh-accounting-cards'));
    } catch (reason) {
      setActionError(getMvoErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  async function openDetails(id: string) {
    setDetailsLoading(true);
    setActionError('');
    try {
      setSelected(await stockDocumentsService.findOne(id));
    } catch (reason) {
      setToastTone('error');
      setToast(getMvoErrorMessage(reason));
    } finally {
      setDetailsLoading(false);
    }
  }

  async function cancelIssue() {
    if (!selected || saving) return;
    setSaving(true);
    setActionError('');
    try {
      const cancelled = await stockDocumentsService.cancel(selected.id);
      setSelected(cancelled);
      setCancelOpen(false);
      setToastTone('success');
      setToast('Видачу скасовано. Залишки оновлено.');
      await load();
      window.dispatchEvent(new CustomEvent('mvo:refresh-stock'));
      window.dispatchEvent(new CustomEvent('mvo:refresh-transactions'));
    } catch (reason) {
      setActionError(getMvoErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  async function openRealization(issueId: string) {
    setRealizationError('');
    try {
      setRealizingIssue(await stockDocumentsService.findOne(issueId));
    } catch (reason) {
      setToastTone('error');
      setToast(getMvoErrorMessage(reason));
    }
  }

  async function submitRealization(
    input: CreateIssueRealizationInput,
    files: File[],
  ) {
    if (!realizingIssue || realizationSaving) return;
    setRealizationSaving(true);
    setRealizationError('');
    try {
      await stockDocumentsService.createIssueRealization(
        realizingIssue.id,
        input,
        files,
      );
      const issueId = realizingIssue.id;
      setRealizingIssue(null);
      setToastTone('success');
      setToast('Реалізацію успішно оформлено.');
      await load();
      if (selected?.id === issueId) {
        setSelected(await stockDocumentsService.findOne(issueId));
      }
    } catch (reason) {
      setRealizationError(getMvoErrorMessage(reason));
    } finally {
      setRealizationSaving(false);
    }
  }

  async function cancelRealization(realization: IssueRealization) {
    if (!selected || realizationSaving) return;
    setRealizationSaving(true);
    setActionError('');
    try {
      await stockDocumentsService.cancelIssueRealization(
        selected.id,
        realization.id,
      );
      setSelected(await stockDocumentsService.findOne(selected.id));
      await load();
      setToastTone('success');
      setToast('Реалізацію скасовано. Доступну кількість оновлено.');
    } catch (reason) {
      setActionError(getMvoErrorMessage(reason));
    } finally {
      setRealizationSaving(false);
    }
  }

  async function exportHistory() {
    if (exporting) return;
    setExporting(true);
    setToast('');
    try {
      const file = await stockDocumentsService.exportIssueHistory(
        toApiFilters(filters),
      );
      downloadFileInBrowser(file);
    } catch (reason) {
      setToastTone('error');
      setToast(`Не вдалося експортувати історію: ${getMvoErrorMessage(reason)}`);
    } finally {
      setExporting(false);
    }
  }

  if (!user) {
    return <LoadingState label="Завантаження видач…" />;
  }

  return (
    <section className="mvo-issues-page">
      <PageHeader
        action={
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={openCreate}>
              + Нова видача
            </Button>
            <Button
              disabled={exporting}
              type="button"
              variant="outline"
              onClick={() => void exportHistory()}
            >
              {exporting ? 'Експортуємо…' : 'Експортувати'}
            </Button>
          </div>
        }
        description="Оформлюйте видачу майна та переглядайте історію проведених документів."
        icon="journal"
        title="Видачі"
      />

      <form
        className="mvo-issues-search"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setFilters(draftFilters);
        }}
      >
        <FormField label="Пошук">
          <Input
            placeholder="Пошук за №, номенклатурою або одержувачем"
            type="search"
            value={draftFilters.search}
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                search: event.target.value,
              }))
            }
          />
        </FormField>
        <Button type="submit" variant="outline">Знайти</Button>
        <Button
          aria-expanded={filtersOpen}
          type="button"
          variant="outline"
          onClick={() => setFiltersOpen((current) => !current)}
        >
          Фільтри
        </Button>
      </form>

      {filtersOpen ? (
        <div className="mvo-issues-filters">
          <FormField label="Дата від">
            <Input
              type="date"
              value={draftFilters.dateFrom}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  dateFrom: event.target.value,
                }))
              }
            />
          </FormField>
          <FormField label="Дата до">
            <Input
              type="date"
              value={draftFilters.dateTo}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  dateTo: event.target.value,
                }))
              }
            />
          </FormField>
          <FormField label="Статус">
            <Select
              value={draftFilters.status}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  status: event.target.value as IssueFilterState['status'],
                }))
              }
            >
              <option value="">Усі</option>
              <option value="POSTED">Проведено</option>
              <option value="CANCELLED">Скасовано</option>
            </Select>
          </FormField>
          <FormField label="Підтверджуючий документ">
            <Select
              value={draftFilters.hasAttachment}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  hasAttachment: event.target.value as IssueFilterState['hasAttachment'],
                }))
              }
            >
              <option value="">Усі</option>
              <option value="true">Є документ</option>
              <option value="false">Без документа</option>
            </Select>
          </FormField>
          <div className="mvo-issues-filters__actions">
            <Button
              type="button"
              onClick={() => {
                setPage(1);
                setFilters(draftFilters);
                setFiltersOpen(false);
              }}
            >
              Застосувати
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDraftFilters(EMPTY_FILTERS);
                setFilters(EMPTY_FILTERS);
                setPage(1);
              }}
            >
              Очистити
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="grid gap-2">
          <ErrorState message={error} />
          <div><Button type="button" variant="outline" onClick={() => void load()}>Спробувати ще раз</Button></div>
        </div>
      ) : loading ? (
        <LoadingState label="Завантаження історії видач…" />
      ) : items.length ? (
        <>
          <IssueHistoryTable
            items={items}
            onOpen={(id) => void openDetails(id)}
            onRealize={(id) => void openRealization(id)}
          />
          <Pagination
            limit={pagination.limit}
            limits={[25, 50, 100]}
            page={pagination.page}
            total={pagination.total}
            totalPages={pagination.totalPages}
            onLimitChange={(nextLimit) => {
              setLimit(nextLimit as 25 | 50 | 100);
              setPage(1);
            }}
            onPage={setPage}
          />
        </>
      ) : (
        <div className="mvo-issues-empty">
          <EmptyState
            title="Видач ще немає"
            message="Оформіть першу видачу майна."
          />
          <Button type="button" onClick={openCreate}>+ Нова видача</Button>
        </div>
      )}

      {creating ? (
        <StockDocumentForm
          availableSources={sources}
          document={null}
          error={actionError}
          initialSourceId={user.responsiblePersonId ?? ''}
          loadingSources={sourcesLoading}
          loadingTargets={false}
          persons={[]}
          saving={saving}
          sourcesError={sourcesError}
          targetsError=""
          transferTargets={[]}
          type="ISSUE"
          user={user}
          onClose={() => {
            if (!saving) setCreating(false);
          }}
          onRemoveAttachment={async () => undefined}
          onSourceChange={() => loadSources()}
          onSubmit={submitIssue}
        />
      ) : null}

      {selected && !cancelOpen ? (
        <MvoIssueDetailsModal
          document={selected}
          error={actionError}
          loading={detailsLoading}
          onCancel={() => {
            setActionError('');
            setCancelOpen(true);
          }}
          onCancelRealization={(realization) =>
            void cancelRealization(realization)
          }
          onClose={() => {
            setSelected(null);
            setActionError('');
          }}
          onRealize={() => void openRealization(selected.id)}
        />
      ) : null}

      {realizingIssue ? (
        <IssueRealizationFormModal
          error={realizationError}
          issue={realizingIssue}
          saving={realizationSaving}
          onClose={() => {
            if (!realizationSaving) {
              setRealizingIssue(null);
              setRealizationError('');
            }
          }}
          onSubmit={(input, files) => void submitRealization(input, files)}
        />
      ) : null}

      {selected && cancelOpen ? (
        <CancelDocumentModal
          document={selected}
          error={actionError}
          loading={saving}
          onClose={() => {
            if (!saving) {
              setCancelOpen(false);
              setActionError('');
            }
          }}
          onConfirm={() => void cancelIssue()}
        />
      ) : null}

      {toast ? (
        <Toast
          message={toast}
          tone={toastTone}
          onClose={() => setToast('')}
        />
      ) : null}
    </section>
  );
}

export function IssueHistoryTable({
  items,
  onOpen,
  onRealize,
}: {
  items: IssueHistoryItem[];
  onOpen: (id: string) => void;
  onRealize: (id: string) => void;
}) {
  return (
    <DataTable
      ariaLabel="Історія видач"
      columns={[
        { label: '№', className: 'mvo-issues-table__number' },
        { label: 'Дата', className: 'mvo-issues-table__date' },
        { label: 'Кому видано', className: 'mvo-issues-table__recipient' },
        { label: 'Позицій', numeric: true, className: 'mvo-issues-table__positions' },
        { label: 'Видано', numeric: true, className: 'mvo-issues-table__quantity' },
        { label: 'Реалізовано', numeric: true, className: 'mvo-issues-table__quantity' },
        { label: 'Залишилось', numeric: true, className: 'mvo-issues-table__quantity' },
        { label: 'Статус', className: 'mvo-issues-table__status' },
        { label: 'Документ', className: 'mvo-issues-table__attachment' },
        { label: 'Дія', actions: true, className: 'mvo-issues-table__actions' },
      ]}
      responsiveMode="cards-wide"
      rowKeys={items.map((item) => item.id)}
      rows={items.map((item) => [
        documentNumberLabel(item.displayNumber),
        new Date(item.documentDate).toLocaleDateString('uk-UA'),
        item.recipientName ?? 'Не вказано',
        item.numberOfLines,
        formatQuantity(item.issuedQuantity),
        formatQuantity(item.realizedQuantity),
        formatQuantity(item.availableToRealize),
        <StockDocumentStatusBadge key="status" status={item.status} />,
        item.hasAttachment ? (
          <StatusBadge key="attachment" tone="info">Є документ</StatusBadge>
        ) : '—',
        <div className="table-actions" key="actions">
          <Button
            size="compact"
            type="button"
            variant="outline"
            onClick={() => onOpen(item.id)}
          >
            Відкрити
          </Button>
          {item.status === 'POSTED' && Number(item.availableToRealize) > 0 ? (
            <Button
              size="compact"
              type="button"
              onClick={() => onRealize(item.id)}
            >
              Реалізувати
            </Button>
          ) : null}
          {item.isFullyRealized ? (
            <StatusBadge tone="success">Реалізовано повністю</StatusBadge>
          ) : null}
        </div>,
      ])}
      tableClassName="mvo-issues-table"
    />
  );
}

function toApiFilters(filters: IssueFilterState): IssueHistoryFilters {
  return {
    search: filters.search.trim() || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    status: filters.status || undefined,
    hasAttachment:
      filters.hasAttachment === ''
        ? undefined
        : filters.hasAttachment === 'true',
  };
}
