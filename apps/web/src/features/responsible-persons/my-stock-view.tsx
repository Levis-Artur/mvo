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
  Toast,
  type DataTableColumn,
} from '@/components/ui';
import { formatQuantity } from '@/features/inventory/quantity-format';
import { stockDocumentsService } from '@/features/stock-documents/stock-documents.service';
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
  const [moreOpen, setMoreOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [toastTone, setToastTone] = useState<'success' | 'error'>('error');
  const [selectedInventoryItemId, setSelectedInventoryItemId] = useState('');
  const [selectedTransferLine, setSelectedTransferLine] = useState<{
    transfer: StockDocument;
    lineId: string;
  } | null>(null);
  const requestSequence = useRef(0);
  const moreMenuRef = useRef<HTMLDivElement>(null);

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
    if (!moreOpen) return;
    function closeOnOutsideClick(event: PointerEvent) {
      if (!moreMenuRef.current?.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setMoreOpen(false);
    }
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [moreOpen]);
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
    setToast('');
    try {
      return await stockDocumentsService.findOne(item.document.id);
    } catch (reason) {
      setToastTone('error');
      setToast(getMvoErrorMessage(reason));
      return null;
    }
  }

  async function openTransferredItem(item: TransferredMyPropertyItem) {
    const transfer = await loadTransfer(item);
    if (transfer) setSelectedTransferLine({ transfer, lineId: item.id });
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
          onBack={() => setSelectedTransferLine(null)}
        />
        {toast ? (
          <Toast message={toast} tone={toastTone} onClose={() => setToast('')} />
        ) : null}
      </>
    );
  }

  return (
    <section className="grid min-w-0 gap-4">
      <PageHeader
        description="Знайдіть потрібну позицію та відкрийте її картку."
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
            placeholder="Введіть код або назву"
            type="search"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
          />
        </label>
        <div className="my-stock-more" ref={moreMenuRef}>
          <Button
            aria-controls="my-stock-more-panel"
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
            size="compact"
            type="button"
            variant="outline"
            onClick={() => setMoreOpen((current) => !current)}
          >
            Ще
          </Button>
          {moreOpen ? (
            <div className="my-stock-more__panel" id="my-stock-more-panel">
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
              <div className="my-stock-more__actions">
                <Button
                  disabled={!searchDraft && !search}
                  size="compact"
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setSearchDraft('');
                    setSearch('');
                    setPage(1);
                    setMoreOpen(false);
                  }}
                >
                  Очистити пошук
                </Button>
                <Button
                  disabled={exporting || !personId}
                  size="compact"
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setMoreOpen(false);
                    setExportOpen(true);
                  }}
                >
                  {exporting ? 'Формування CSV…' : 'Експортувати CSV'}
                </Button>
                <Button
                  disabled={loading}
                  icon="refresh"
                  size="compact"
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setMoreOpen(false);
                    void load();
                  }}
                >
                  Оновити
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </form>

      <nav aria-label="Склад майна" className="my-stock-tabs">
        {tabs.map((item) => (
          <Button
            aria-current={section === item.id ? 'page' : undefined}
            key={item.id}
            size="compact"
            type="button"
            variant={section === item.id ? 'primary' : 'ghost'}
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

      {error ? <ErrorState message={error} /> : null}

      <div className="my-stock-list">
        <DataTable
          ariaLabel={MY_PROPERTY_SECTION_LABELS[section]}
          columns={myStockColumns(section)}
          emptyMessage={
            search
              ? 'За вказаним запитом майно не знайдено'
              : myStockEmptyMessage(section)
          }
          loading={loading}
          responsiveMode="cards-wide"
          rowKeys={(data?.items ?? []).map((item) => item.id)}
          rows={(data?.items ?? []).map((item) =>
            myStockRow(
              item,
              setSelectedInventoryItemId,
              (transferred) => void openTransferredItem(transferred),
            ),
          )}
          tableClassName={`my-stock-table my-stock-table--${section.toLocaleLowerCase()}`}
        />
      </div>
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
      {toast ? (
        <Toast message={toast} tone={toastTone} onClose={() => setToast('')} />
      ) : null}
    </section>
  );
}

function myStockColumns(section: MyPropertySection): DataTableColumn[] {
  return [
    { label: 'Код', className: 'my-stock-table__code' },
    { label: 'Назва', className: 'my-stock-table__name' },
    { label: 'Одиниця', className: 'my-stock-table__unit' },
    {
      label: section === 'TRANSFERRED' ? 'Передано' : 'Кількість на складі',
      className: 'my-stock-table__quantity',
      numeric: true,
    },
    {
      label: '',
      className: 'my-stock-table__mobile-action',
      actions: true,
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
) {
  if (item.section === 'TRANSFERRED') {
    const itemTitle = `${item.inventoryItem.externalCode} — ${item.inventoryItem.name}`;
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
      formatQuantity(item.quantity),
      <Button
        aria-label={`Відкрити передану позицію: ${itemTitle}`}
        key="open"
        size="compact"
        type="button"
        variant="outline"
        onClick={() => onOpenTransferredItem(item)}
      >
        Відкрити
      </Button>,
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
    <Button
      aria-label={`Відкрити картку: ${item.inventoryItem.name}`}
      key="open"
      size="compact"
      type="button"
      variant="outline"
      onClick={() => onOpenInventoryItem(item.inventoryItem.id)}
    >
      Відкрити
    </Button>,
  ];
}
