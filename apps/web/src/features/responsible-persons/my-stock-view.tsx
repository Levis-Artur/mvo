'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/ui/auth-context';
import { getMvoErrorMessage } from '@/components/common';
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
import { getToolbarDetail, TOOLBAR_EVENT } from '@/components/layout/toolbar-events';
import { formatQuantity } from '@/features/inventory/quantity-format';
import { mvoStockActionLinks } from '@/features/inventory/stock-model';
import type {
  MyPropertyItem,
  MyPropertyResponse,
  MyPropertySection,
  MyPropertySortBy,
  SortOrder,
} from '@/lib/types';
import { MyStockExportModal } from './my-stock-export-modal';
import { MyPropertyDetailsModal } from './my-property-details-modal';
import {
  DEFAULT_MY_PROPERTY_SORT,
  downloadFileInBrowser,
  exportSection,
  MY_PROPERTY_SECTION_LABELS,
  MY_PROPERTY_SECTION_DESCRIPTIONS,
  myPropertySortOptions,
  normalizedPropertySearch,
  propertyActionLinks,
} from './my-stock-model';
import { responsiblePersonsService } from './responsible-persons.service';

const tabs = (Object.entries(MY_PROPERTY_SECTION_LABELS) as [MyPropertySection, string][])
  .map(([id, label]) => ({ id, label }));

export function MyStockView() {
  const router = useRouter();
  const { user } = useAuth();
  const personId = user?.responsiblePersonId ?? '';
  const actionLinks = mvoStockActionLinks(personId);
  const [data, setData] = useState<MyPropertyResponse | null>(null);
  const [section, setSection] = useState<MyPropertySection>('DIRECT');
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<MyPropertySortBy>(DEFAULT_MY_PROPERTY_SORT.sortBy);
  const [sortOrder, setSortOrder] = useState<SortOrder>(DEFAULT_MY_PROPERTY_SORT.sortOrder);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState('');
  const [selectedItem, setSelectedItem] = useState<MyPropertyItem | null>(null);
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
      if (sequence === requestSequence.current) setError(getMvoErrorMessage(reason));
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [limit, page, personId, search, section, sortBy, sortOrder]);

  useEffect(() => { void load(); }, [load]);
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
      if (!detail || (detail.view === 'my-stock' && detail.action === 'refresh')) void load();
    }
    window.addEventListener(TOOLBAR_EVENT, refresh);
    window.addEventListener('mvo:refresh-accounting-cards', refresh);
    return () => {
      window.removeEventListener(TOOLBAR_EVENT, refresh);
      window.removeEventListener('mvo:refresh-accounting-cards', refresh);
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
      setToast(`Не вдалося експортувати CSV: ${getMvoErrorMessage(reason)}`);
    } finally {
      setExporting(false);
    }
  }

  return <section className="grid min-w-0 gap-4">
    <PageHeader
      action={personId ? <div className="flex flex-wrap gap-2">
        <a className="btn btn-primary" href={actionLinks.transfer}>Передати майно</a>
        <a className="btn btn-secondary" href={actionLinks.issue}>Видати майно</a>
      </div> : undefined}
      description="Переглядайте майно, яке знаходиться у вас або було передане іншим МВО."
      icon="box"
      title="Моє майно"
    />

    <form className="my-stock-toolbar" onSubmit={(event) => {
      event.preventDefault();
      setPage(1);
      setSearch(normalizedPropertySearch(searchDraft));
    }}>
      <label className="my-stock-toolbar__search">
        <span>Пошук майна</span>
        <Input
          placeholder="Код, назва, обліковий власник або утримувач"
          type="search"
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
        />
      </label>
      <div className="my-stock-toolbar__actions">
        <Button disabled={loading && !searchDraft} variant="outline" type="button" onClick={() => {
          setSearchDraft('');
          setSearch('');
          setPage(1);
        }}>Очистити</Button>
        <Button disabled={exporting || !personId} variant="outline" type="button" onClick={() => setExportOpen(true)}>
          {exporting ? 'Формування CSV…' : 'Експортувати CSV'}
        </Button>
        <Button disabled={loading} icon="refresh" variant="outline" type="button" onClick={() => void load()}>
          Оновити
        </Button>
      </div>
    </form>

    <div className="grid gap-2">
      <nav aria-label="Склад майна" className="flex flex-wrap gap-2">
        {tabs.map((item) => <Button
          aria-current={section === item.id ? 'page' : undefined}
          key={item.id}
          variant={section === item.id ? 'primary' : 'outline'}
          type="button"
          onClick={() => {
            setSection(item.id);
            setPage(1);
            if (!myPropertySortOptions(item.id).some((option) => option.value === sortBy)) setSortBy('name');
          }}
        >{item.label}</Button>)}
      </nav>
      <p className="text-sm text-[var(--color-text-secondary)]">{MY_PROPERTY_SECTION_DESCRIPTIONS[section]}</p>
    </div>

    <div className="my-stock-sort-bar">
      <strong>Знайдено записів: {data?.pagination.total ?? 0}</strong>
      <label><span>Сортувати за</span><Select value={sortBy} onChange={(event) => {
        setSortBy(event.target.value as MyPropertySortBy); setPage(1);
      }}>{myPropertySortOptions(section).map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</Select></label>
      <label><span>Порядок</span><Select value={sortOrder} onChange={(event) => {
        setSortOrder(event.target.value as SortOrder); setPage(1);
      }}><option value="asc">За зростанням</option><option value="desc">За спаданням</option></Select></label>
    </div>

    {error ? <ErrorState message={error} /> : null}

    <DataTable
      ariaLabel={MY_PROPERTY_SECTION_LABELS[section]}
      columns={myStockColumns(section)}
      emptyMessage={search ? 'За вказаним запитом майно не знайдено' : myStockEmptyMessage(section)}
      loading={loading}
      rows={(data?.items ?? []).map((item) => myStockRow(item, section, setSelectedItem, (href) => router.push(href)))}
      tableClassName={`my-stock-table my-stock-table--${section.toLocaleLowerCase()}`}
    />
    <Pagination
      limit={data?.pagination.limit ?? limit}
      page={data?.pagination.page ?? page}
      total={data?.pagination.total ?? 0}
      totalPages={data?.pagination.totalPages ?? 0}
      onLimitChange={(nextLimit) => { setLimit(Math.min(nextLimit, 100)); setPage(1); }}
      onPage={setPage}
    />

    {exportOpen ? <MyStockExportModal
      currentSection={section}
      loading={exporting}
      search={normalizedPropertySearch(searchDraft)}
      onClose={() => { if (!exporting) setExportOpen(false); }}
      onExport={(scope) => void exportCsv(scope)}
    /> : null}
    {selectedItem ? <MyPropertyDetailsModal item={selectedItem} onClose={() => setSelectedItem(null)} /> : null}
    {toast ? <Toast message={toast} tone="error" onClose={() => setToast('')} /> : null}
  </section>;
}

function myStockColumns(section: MyPropertySection): DataTableColumn[] {
  const common = [
    { label: 'Код', className: 'my-stock-table__code' },
    { label: 'Назва', className: 'my-stock-table__name' },
    { label: 'Одиниця', className: 'my-stock-table__unit' },
    { label: 'Кількість', className: 'my-stock-table__quantity', numeric: true },
  ];
  if (section === 'ASSIGNED_OUT') {
    return [...common, { label: 'У кого знаходиться', className: 'my-stock-table__person' }, { label: 'Дата передачі', className: 'my-stock-table__date' }, { label: 'Дії', actions: true, className: 'my-stock-table__actions' }];
  }
  if (section === 'ASSIGNED_TO_ME') {
    return [...common, { label: 'Від кого отримано', className: 'my-stock-table__person' }, { label: 'Дії', actions: true, className: 'my-stock-table__actions' }];
  }
  return [...common, { label: 'Дії', actions: true, className: 'my-stock-table__actions' }];
}

function myStockEmptyMessage(section: MyPropertySection) {
  if (section === 'ASSIGNED_OUT') return 'Ви ще не передавали майно іншим МВО.';
  if (section === 'ASSIGNED_TO_ME') return 'Інші МВО ще не передавали вам майно.';
  return 'У вас немає майна, доступного для передачі або видачі.';
}

function myStockRow(item: MyPropertyItem, section: MyPropertySection, onView: (item: MyPropertyItem) => void, onNavigate: (href: string) => void) {
  const links = propertyActionLinks(item);
  const common = [
    item.inventoryItem.externalCode,
    <span className="my-stock-table__name-text" key="name" title={item.inventoryItem.name}>{item.inventoryItem.name}</span>,
    item.inventoryItem.unitOfMeasure ?? '—',
    formatQuantity(item.quantity),
  ];
  if (section === 'ASSIGNED_OUT') {
    return [...common,
      `${item.currentCustodian.personnelNumber} — ${item.currentCustodian.fullName}`,
      new Date(item.updatedAt).toLocaleDateString('uk-UA'),
      <div className="my-stock-actions" key="actions">
        <Button aria-label={`Переглянути ${item.inventoryItem.name}`} size="compact" title="Переглянути майно" variant="outline" type="button" onClick={() => onView(item)}>Переглянути</Button>
      </div>,
    ];
  }
  const actions = <div className="my-stock-actions" key="actions">
    {item.canAssign ? <Button aria-label={`Передати ${item.inventoryItem.name}`} icon="transfer" size="compact" title="Передати майно" type="button" onClick={() => onNavigate(links.transfer)}>Передати</Button> : null}
    {item.canIssue ? <Button aria-label={`Видати ${item.inventoryItem.name}`} size="compact" title="Видати майно" variant="outline" type="button" onClick={() => onNavigate(links.issue)}>Видати</Button> : null}
  </div>;
  if (section === 'ASSIGNED_TO_ME') {
    return [...common, `${item.accountingOwner.personnelNumber} — ${item.accountingOwner.fullName}`, actions];
  }
  return [...common, actions];
}
