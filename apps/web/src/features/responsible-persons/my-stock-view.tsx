'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/app/ui/auth-context';
import { getErrorMessage } from '@/components/common';
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
import {
  DEFAULT_MY_PROPERTY_SORT,
  downloadFileInBrowser,
  exportSection,
  MY_PROPERTY_SECTION_LABELS,
  MY_PROPERTY_SORT_LABELS,
  normalizedPropertySearch,
  propertyActionLinks,
} from './my-stock-model';
import { responsiblePersonsService } from './responsible-persons.service';

const tabs = (Object.entries(MY_PROPERTY_SECTION_LABELS) as [MyPropertySection, string][])
  .map(([id, label]) => ({ id, label }));

export function MyStockView() {
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
      if (sequence === requestSequence.current) setError(getErrorMessage(reason));
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
      setToast(`Не вдалося експортувати CSV: ${getErrorMessage(reason)}`);
    } finally {
      setExporting(false);
    }
  }

  return <section className="grid min-w-0 gap-4">
    <PageHeader
      action={personId ? <div className="flex flex-wrap gap-2">
        <a className="btn btn-primary" href={actionLinks.transfer}>Передати</a>
        <a className="btn btn-outline" href={actionLinks.issue}>Видати</a>
      </div> : undefined}
      description="Прямий залишок і майно, закріплене за фактичними утримувачами."
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

    <nav aria-label="Склад майна" className="flex flex-wrap gap-2">
      {tabs.map((item) => <Button
        aria-current={section === item.id ? 'page' : undefined}
        key={item.id}
        variant={section === item.id ? 'primary' : 'outline'}
        type="button"
        onClick={() => { setSection(item.id); setPage(1); }}
      >{item.label}</Button>)}
    </nav>

    <div className="my-stock-sort-bar">
      <strong>Знайдено записів: {data?.pagination.total ?? 0}</strong>
      <label><span>Сортувати за</span><Select value={sortBy} onChange={(event) => {
        setSortBy(event.target.value as MyPropertySortBy); setPage(1);
      }}>{Object.entries(MY_PROPERTY_SORT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></label>
      <label><span>Порядок</span><Select value={sortOrder} onChange={(event) => {
        setSortOrder(event.target.value as SortOrder); setPage(1);
      }}><option value="asc">За зростанням</option><option value="desc">За спаданням</option></Select></label>
    </div>

    {error ? <ErrorState message={error} /> : null}

    <DataTable
      ariaLabel={MY_PROPERTY_SECTION_LABELS[section]}
      columns={[
        { label: 'Код' }, { label: 'Назва', className: 'my-stock-table__name' }, { label: 'Одиниця' },
        { label: 'Обліковий власник', className: 'my-stock-table__person' },
        { label: 'Фактичний утримувач', className: 'my-stock-table__person' },
        { label: 'Тип' }, { label: 'Кількість', numeric: true },
        { label: 'Доступно для передачі' }, { label: 'Доступно для видачі' },
        { label: 'Оновлено' }, { label: 'Дії', actions: true },
      ]}
      emptyMessage={search
        ? 'За вказаним запитом майно не знайдено'
        : 'У цьому розділі майна немає.'}
      loading={loading}
      rows={(data?.items ?? []).map(myStockRow)}
      tableClassName="my-stock-table"
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
    {toast ? <Toast message={toast} tone="error" onClose={() => setToast('')} /> : null}
  </section>;
}

function myStockRow(item: MyPropertyItem) {
  const links = propertyActionLinks(item);
  return [
    item.inventoryItem.externalCode,
    item.inventoryItem.name,
    item.inventoryItem.unitOfMeasure ?? '—',
    `${item.accountingOwner.personnelNumber} — ${item.accountingOwner.fullName}`,
    `${item.currentCustodian.personnelNumber} — ${item.currentCustodian.fullName}`,
    <StatusBadge key="kind" tone={item.sourceKind === 'DIRECT' ? 'success' : 'info'}>
      {item.sourceKind === 'DIRECT' ? 'Прямий залишок' : 'Закріплене майно'}
    </StatusBadge>,
    formatQuantity(item.quantity),
    item.canAssign ? 'Так' : 'Ні',
    item.canIssue ? 'Так' : 'Ні',
    new Date(item.updatedAt).toLocaleString('uk-UA'),
    item.canAssign || item.canIssue ? <div className="flex flex-wrap justify-end gap-1" key="actions">
      {item.canAssign ? <a className="btn btn-ghost" href={links.transfer}>Передати</a> : null}
      {item.canIssue ? <a className="btn btn-ghost" href={links.issue}>Видати</a> : null}
    </div> : 'Лише перегляд',
  ];
}
