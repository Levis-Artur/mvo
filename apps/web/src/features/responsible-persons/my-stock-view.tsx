'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/app/ui/auth-context';
import { getMvoErrorMessage } from '@/components/common';
import { getToolbarDetail, TOOLBAR_EVENT } from '@/components/layout/toolbar-events';
import { PageHeader } from '@/components/layout/page-header';
import {
  Button,
  DataTable,
  ErrorState,
  Input,
  Pagination,
  Select,
  StatusBadge,
  Toast,
  type DataTableColumn,
} from '@/components/ui';
import { formatQuantity } from '@/features/inventory/quantity-format';
import { documentNumberLabel } from '@/features/stock-documents/stock-document-rules';
import { StockDocumentStatusBadge } from '@/features/stock-documents/stock-document-status-badge';
import { StockDocumentDetailsModal } from '@/features/stock-documents/stock-document-details-modal';
import { stockDocumentsService } from '@/features/stock-documents/stock-documents.service';
import { TransferIssueModal } from '@/features/stock-documents/transfer-issue-modal';
import type {
  MyPropertyItem,
  MyPropertyResponse,
  MyPropertySection,
  MyPropertySortBy,
  SortOrder,
  StockDocument,
  TransferredMyPropertyItem,
} from '@/lib/types';
import { MyStockExportModal } from './my-stock-export-modal';
import { MyInventoryItemCard } from './my-inventory-item-card';
import { MyTransferredPropertyCard } from './my-transferred-property-card';
import {
  DEFAULT_MY_PROPERTY_SORT,
  downloadFileInBrowser,
  exportSection,
  MY_PROPERTY_SECTION_DESCRIPTIONS,
  MY_PROPERTY_SECTION_LABELS,
  myPropertySortOptions,
  normalizedPropertySearch,
} from './my-stock-model';
import { responsiblePersonsService } from './responsible-persons.service';

const tabs = (
  Object.entries(MY_PROPERTY_SECTION_LABELS) as [MyPropertySection, string][]
).map(([id, label]) => ({ id, label }));

export function MyStockView() {
  const { user } = useAuth();
  const personId = user?.responsiblePersonId ?? '';
  const [data, setData] = useState<MyPropertyResponse | null>(null);
  const [section, setSection] = useState<MyPropertySection>('DIRECT');
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<MyPropertySortBy>(
    DEFAULT_MY_PROPERTY_SORT.sortBy,
  );
  const [sortOrder, setSortOrder] = useState<SortOrder>(
    DEFAULT_MY_PROPERTY_SORT.sortOrder,
  );
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState('');
  const [toastTone, setToastTone] = useState<'success' | 'error'>('error');
  const [selectedInventoryItemId, setSelectedInventoryItemId] = useState('');
  const [selectedTransferLine, setSelectedTransferLine] = useState<{
    transfer: StockDocument;
    lineId: string;
  } | null>(null);
  const [issueTransfer, setIssueTransfer] = useState<StockDocument | null>(null);
  const [initialIssueLineId, setInitialIssueLineId] = useState('');
  const [detailDocument, setDetailDocument] = useState<StockDocument | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState('');
  const requestSequence = useRef(0);

  const load = useCallback(async () => {
    if (!personId) {
      setLoading(false);
      setError('До користувача не прив’язано картку МВО.');
      return;
    }
    const sequence = ++requestSequence.current;
    setLoading(true);
    setError('');
    try {
      const response = await responsiblePersonsService.myProperty({
        search: search || undefined,
        section,
        page,
        limit: Math.min(limit, 100),
        sortBy,
        sortOrder,
      });
      if (sequence === requestSequence.current) setData(response);
    } catch (reason) {
      if (sequence === requestSequence.current) {
        setError(getMvoErrorMessage(reason));
      }
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [limit, page, personId, search, section, sortBy, sortOrder]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearch(normalizedPropertySearch(searchDraft));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [searchDraft]);
  useEffect(() => {
    function refresh(event: Event) {
      const detail = getToolbarDetail(event);
      if (!detail || (detail.view === 'my-stock' && detail.action === 'refresh')) {
        void load();
      }
    }
    window.addEventListener(TOOLBAR_EVENT, refresh);
    window.addEventListener('mvo:refresh-accounting-cards', refresh);
    window.addEventListener('mvo:refresh-transferred-property', refresh);
    return () => {
      window.removeEventListener(TOOLBAR_EVENT, refresh);
      window.removeEventListener('mvo:refresh-accounting-cards', refresh);
      window.removeEventListener('mvo:refresh-transferred-property', refresh);
    };
  }, [load]);

  async function exportCsv(scope: 'ALL' | 'CURRENT') {
    if (exporting) return;
    setExporting(true);
    setToast('');
    try {
      const file = await responsiblePersonsService.exportMyPropertyCsv({
        search: normalizedPropertySearch(searchDraft) || undefined,
        section: exportSection(scope, section),
      });
      downloadFileInBrowser(file);
      setExportOpen(false);
    } catch (reason) {
      setToastTone('error');
      setToast(
        `Не вдалося експортувати CSV: ${getMvoErrorMessage(reason)}`,
      );
    } finally {
      setExporting(false);
    }
  }

  async function loadTransfer(item: TransferredMyPropertyItem) {
    setActionLoadingId(item.id);
    setToast('');
    try {
      return await stockDocumentsService.findOne(item.document.id);
    } catch (reason) {
      setToastTone('error');
      setToast(getMvoErrorMessage(reason));
      return null;
    } finally {
      setActionLoadingId('');
    }
  }

  async function openTransferredItem(item: TransferredMyPropertyItem) {
    const transfer = await loadTransfer(item);
    if (transfer) setSelectedTransferLine({ transfer, lineId: item.id });
  }

  async function openIssue(item: TransferredMyPropertyItem) {
    const transfer = await loadTransfer(item);
    if (!transfer) return;
    setIssueTransfer(transfer);
    setInitialIssueLineId(item.id);
  }

  async function refreshSelectedTransfer() {
    if (!selectedTransferLine) return;
    const transfer = await stockDocumentsService.findOne(
      selectedTransferLine.transfer.id,
    );
    setSelectedTransferLine((current) =>
      current ? { ...current, transfer } : current,
    );
  }

  async function openIssueDetails(issueId: string) {
    setActionLoadingId(issueId);
    setToast('');
    try {
      setDetailDocument(await stockDocumentsService.findOne(issueId));
    } catch (reason) {
      setToastTone('error');
      setToast(getMvoErrorMessage(reason));
    } finally {
      setActionLoadingId('');
    }
  }

  if (selectedInventoryItemId) {
    return (
      <MyInventoryItemCard
        inventoryItemId={selectedInventoryItemId}
        onBack={() => setSelectedInventoryItemId('')}
      />
    );
  }

  if (selectedTransferLine && user) {
    return (
      <>
        <MyTransferredPropertyCard
          transfer={selectedTransferLine.transfer}
          transferLineId={selectedTransferLine.lineId}
          user={user}
          onBack={() => setSelectedTransferLine(null)}
          onIssue={() => {
            setIssueTransfer(selectedTransferLine.transfer);
            setInitialIssueLineId(selectedTransferLine.lineId);
          }}
          onViewIssue={(issueId) => void openIssueDetails(issueId)}
        />
        {issueTransfer ? (
          <TransferIssueModal
            initialTransferLineId={initialIssueLineId}
            transfer={issueTransfer}
            user={user}
            onClose={() => setIssueTransfer(null)}
            onSuccess={async () => {
              setIssueTransfer(null);
              await Promise.all([load(), refreshSelectedTransfer()]);
              setToastTone('success');
              setToast('Видачу оформлено.');
            }}
          />
        ) : null}
        {detailDocument ? (
          <StockDocumentDetailsModal
            readOnly
            document={detailDocument}
            error=""
            loading={actionLoadingId === detailDocument.id}
            user={user}
            onCancel={() => undefined}
            onClose={() => setDetailDocument(null)}
            onDelete={() => undefined}
            onEdit={() => undefined}
            onIssue={() => undefined}
            onOpenSourceTransfer={() =>
              setDetailDocument(selectedTransferLine.transfer)
            }
            onPost={() => undefined}
          />
        ) : null}
        {toast ? (
          <Toast message={toast} tone={toastTone} onClose={() => setToast('')} />
        ) : null}
      </>
    );
  }

  return (
    <section className="grid min-w-0 gap-4">
      <PageHeader
        description="Переглядайте поточний залишок та історію передач іншим МВО."
        icon="box"
        title="Моє майно"
      />

      <form
        className="my-stock-toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setSearch(normalizedPropertySearch(searchDraft));
        }}
      >
        <label className="my-stock-toolbar__search">
          <span>Пошук майна</span>
          <Input
            placeholder="Код, назва, номер документа або одержувач"
            type="search"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
          />
        </label>
        <div className="my-stock-toolbar__actions">
          <Button
            disabled={loading && !searchDraft}
            type="button"
            variant="outline"
            onClick={() => {
              setSearchDraft('');
              setSearch('');
              setPage(1);
            }}
          >
            Очистити
          </Button>
          <Button
            disabled={exporting || !personId}
            type="button"
            variant="outline"
            onClick={() => setExportOpen(true)}
          >
            {exporting ? 'Формування CSV…' : 'Експортувати CSV'}
          </Button>
          <Button
            disabled={loading}
            icon="refresh"
            type="button"
            variant="outline"
            onClick={() => void load()}
          >
            Оновити
          </Button>
        </div>
      </form>

      <div className="grid gap-2">
        <nav aria-label="Склад майна" className="flex flex-wrap gap-2">
          {tabs.map((item) => (
            <Button
              aria-current={section === item.id ? 'page' : undefined}
              key={item.id}
              type="button"
              variant={section === item.id ? 'primary' : 'outline'}
              onClick={() => {
                setSection(item.id);
                setPage(1);
                const nextOptions = myPropertySortOptions(item.id);
                if (!nextOptions.some((option) => option.value === sortBy)) {
                  setSortBy(item.id === 'TRANSFERRED' ? 'documentDate' : 'name');
                  setSortOrder(item.id === 'TRANSFERRED' ? 'desc' : 'asc');
                }
              }}
            >
              {item.label}
            </Button>
          ))}
        </nav>
        <p className="text-sm text-[var(--color-text-secondary)]">
          {MY_PROPERTY_SECTION_DESCRIPTIONS[section]}
        </p>
      </div>

      <div className="my-stock-sort-bar">
        <strong>Знайдено записів: {data?.pagination.total ?? 0}</strong>
        <label>
          <span>Сортувати за</span>
          <Select
            value={sortBy}
            onChange={(event) => {
              setSortBy(event.target.value as MyPropertySortBy);
              setPage(1);
            }}
          >
            {myPropertySortOptions(section).map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span>Порядок</span>
          <Select
            value={sortOrder}
            onChange={(event) => {
              setSortOrder(event.target.value as SortOrder);
              setPage(1);
            }}
          >
            <option value="asc">За зростанням</option>
            <option value="desc">За спаданням</option>
          </Select>
        </label>
      </div>

      {error ? <ErrorState message={error} /> : null}

      <DataTable
        ariaLabel={MY_PROPERTY_SECTION_LABELS[section]}
        columns={myStockColumns(section)}
        emptyMessage={
          search
            ? 'За вказаним запитом майно не знайдено'
            : myStockEmptyMessage(section)
        }
        loading={loading}
        responsiveMode={section === 'TRANSFERRED' ? 'cards-wide' : 'cards'}
        rows={(data?.items ?? []).map((item) =>
          myStockRow(
            item,
            setSelectedInventoryItemId,
            (transferred) => void openTransferredItem(transferred),
            (transferred) => void openIssue(transferred),
            actionLoadingId,
          ),
        )}
        tableClassName={`my-stock-table my-stock-table--${section.toLocaleLowerCase()}`}
      />
      <Pagination
        limit={data?.pagination.limit ?? limit}
        page={data?.pagination.page ?? page}
        total={data?.pagination.total ?? 0}
        totalPages={data?.pagination.totalPages ?? 0}
        onLimitChange={(nextLimit) => {
          setLimit(Math.min(nextLimit, 100));
          setPage(1);
        }}
        onPage={setPage}
      />

      {exportOpen ? (
        <MyStockExportModal
          currentSection={section}
          loading={exporting}
          search={normalizedPropertySearch(searchDraft)}
          onClose={() => {
            if (!exporting) setExportOpen(false);
          }}
          onExport={(scope) => void exportCsv(scope)}
        />
      ) : null}
      {issueTransfer && user ? (
        <TransferIssueModal
          initialTransferLineId={initialIssueLineId}
          transfer={issueTransfer}
          user={user}
          onClose={() => setIssueTransfer(null)}
          onSuccess={async () => {
            setIssueTransfer(null);
            await load();
            setToastTone('success');
            setToast('Видачу оформлено.');
          }}
        />
      ) : null}
      {toast ? (
        <Toast message={toast} tone={toastTone} onClose={() => setToast('')} />
      ) : null}
    </section>
  );
}

function myStockColumns(section: MyPropertySection): DataTableColumn[] {
  if (section === 'TRANSFERRED') {
    return [
      { label: 'Код', className: 'my-stock-table__code' },
      { label: 'Назва', className: 'my-stock-table__name' },
      { label: 'Одиниця', className: 'my-stock-table__unit' },
      { label: 'Кому передано', className: 'my-stock-table__person' },
      { label: '№ передачі', className: 'my-stock-table__document' },
      { label: 'Дата передачі', className: 'my-stock-table__date' },
      {
        label: 'Передано',
        className: 'my-stock-table__quantity',
        numeric: true,
      },
      {
        label: 'Видано',
        className: 'my-stock-table__quantity',
        numeric: true,
      },
      {
        label: 'Залишилось оформити видачу',
        className: 'my-stock-table__quantity',
        numeric: true,
      },
      { label: 'Статус', className: 'my-stock-table__status' },
      { label: 'Дія', className: 'my-stock-table__actions', actions: true },
    ];
  }
  return [
    { label: 'Код', className: 'my-stock-table__code' },
    { label: 'Назва', className: 'my-stock-table__name' },
    { label: 'Одиниця', className: 'my-stock-table__unit' },
    {
      label: 'Кількість на складі',
      className: 'my-stock-table__quantity',
      numeric: true,
    },
  ];
}

function myStockEmptyMessage(section: MyPropertySection) {
  return section === 'TRANSFERRED'
    ? 'Ви ще не передавали майно іншим МВО.'
    : 'У вас немає майна за даними поточного обліку.';
}

function myStockRow(
  item: MyPropertyItem,
  onOpenInventoryItem: (id: string) => void,
  onOpenTransferredItem: (item: TransferredMyPropertyItem) => void,
  onIssue: (item: TransferredMyPropertyItem) => void,
  actionLoadingId: string,
) {
  if (item.section === 'TRANSFERRED') {
    const itemTitle = `${item.inventoryItem.externalCode} — ${item.inventoryItem.name}`;
    const available = Number(item.availableToIssue);
    const canIssue = item.document.status === 'POSTED' && available > 0;
    return [
      <Button
        aria-label={`Відкрити передану позицію ${item.inventoryItem.externalCode}`}
        className="my-stock-item-link"
        key="code"
        title={item.inventoryItem.externalCode}
        type="button"
        variant="link"
        onClick={() => onOpenTransferredItem(item)}
      >
        {item.inventoryItem.externalCode}
      </Button>,
      <Button
        aria-label={`Відкрити передану позицію: ${itemTitle}`}
        className="my-stock-item-link my-stock-table__name-text"
        key="name"
        title={itemTitle}
        type="button"
        variant="link"
        onClick={() => onOpenTransferredItem(item)}
      >
        {item.inventoryItem.name}
      </Button>,
      item.inventoryItem.unitOfMeasure ?? '—',
      item.recipient
        ? `${item.recipient.externalAccountingCode ?? item.recipient.personnelNumber} — ${item.recipient.fullName}`
        : 'Одержувача не вказано',
      documentNumberLabel(item.document.displayNumber),
      new Date(item.document.documentDate).toLocaleDateString('uk-UA'),
      formatQuantity(item.quantity),
      formatQuantity(item.issuedQuantity),
      formatQuantity(item.availableToIssue),
      <StockDocumentStatusBadge key="status" status={item.document.status} />,
      canIssue ? (
        <Button
          disabled={actionLoadingId === item.id}
          key="issue"
          size="compact"
          type="button"
          onClick={() => onIssue(item)}
        >
          {actionLoadingId === item.id ? 'Відкриваємо…' : 'Видати'}
        </Button>
      ) : available <= 0 && item.document.status === 'POSTED' ? (
        <StatusBadge key="complete" tone="neutral">
          Видано повністю
        </StatusBadge>
      ) : null,
    ];
  }
  return [
    <Button
      aria-label={`Відкрити картку номенклатури ${item.inventoryItem.externalCode}`}
      className="my-stock-item-link"
      key="code"
      title={item.inventoryItem.externalCode}
      type="button"
      variant="link"
      onClick={() => onOpenInventoryItem(item.inventoryItem.id)}
    >
      {item.inventoryItem.externalCode}
    </Button>,
    <Button
      aria-label={`Відкрити картку: ${item.inventoryItem.name}`}
      className="my-stock-item-link my-stock-table__name-text"
      key="name"
      title={item.inventoryItem.name}
      type="button"
      variant="link"
      onClick={() => onOpenInventoryItem(item.inventoryItem.id)}
    >
      {item.inventoryItem.name}
    </Button>,
    item.inventoryItem.unitOfMeasure ?? '—',
    formatQuantity(item.quantity),
  ];
}
