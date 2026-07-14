'use client';

import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, ApiError } from '@/lib/api-client';
import type {
  CreateManagementDto,
  CreateResponsiblePersonDto,
  CreateServiceDto,
  CreateUnitDto,
  DashboardStats,
  ImportBatch,
  ImportRow,
  ImportType,
  InventoryItem,
  Management,
  ResponsiblePerson,
  ResponsiblePersonsQuery,
  Service,
  StockBalance,
  StockTransaction,
  Unit,
} from '@/lib/types';

type View =
  | 'home'
  | 'persons'
  | 'structure'
  | 'stock'
  | 'nomenclature'
  | 'imports'
  | 'transactions';
type NavItem = {
  id: View;
  label: string;
  group: string;
  marker: string;
  href: string;
};
type TopNavItem = {
  label: string;
  href?: string;
  view?: View;
  exact?: boolean;
  disabled?: boolean;
};
type ToolbarActionId =
  | 'create'
  | 'create-management'
  | 'create-receipt'
  | 'new-import'
  | 'refresh'
  | 'focus-filter';
type ToolbarEventDetail = {
  view: View;
  action: ToolbarActionId;
};
type ToolbarAction = {
  label: string;
  id?: ToolbarActionId;
  primary?: boolean;
  disabled?: boolean;
  title?: string;
};
type OrgForm =
  | { type: 'management'; data?: Management }
  | { type: 'service'; managementId: string; data?: Service }
  | { type: 'unit'; serviceId: string; data?: Unit };

const TOOLBAR_EVENT = 'mvo:toolbar-action';
const UNIMPLEMENTED_TITLE = 'Функція ще не реалізована';

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Головна', group: 'Головна', marker: '⌂', href: '/' },
  {
    id: 'persons',
    label: 'МВО',
    group: 'Довідники',
    marker: '□',
    href: '/persons',
  },
  {
    id: 'structure',
    label: 'Організаційна структура',
    group: 'Довідники',
    marker: '◇',
    href: '/structure',
  },
  {
    id: 'nomenclature',
    label: 'Номенклатура',
    group: 'Довідники',
    marker: '▤',
    href: '/nomenclature',
  },
  {
    id: 'stock',
    label: 'Залишки',
    group: 'Облік майна',
    marker: '≡',
    href: '/stock',
  },
  {
    id: 'imports',
    label: 'Імпорт',
    group: 'Документи',
    marker: '+',
    href: '/imports',
  },
  {
    id: 'transactions',
    label: 'Журнал операцій',
    group: 'Звіти',
    marker: '↺',
    href: '/transactions',
  },
];

const TOP_NAV_ITEMS: TopNavItem[] = [
  ...NAV_ITEMS.map((item) => ({
    label: item.label,
    href: item.href,
    view: item.id,
    exact: item.id === 'home',
  })),
  { label: 'Адміністрування', disabled: true },
];

function getViewHref(view: View) {
  return NAV_ITEMS.find((item) => item.id === view)?.href ?? '/';
}

function emitToolbarAction(view: View, action: ToolbarActionId) {
  window.dispatchEvent(
    new CustomEvent<ToolbarEventDetail>(TOOLBAR_EVENT, {
      detail: { view, action },
    }),
  );
}

function getToolbarDetail(event: Event) {
  if (!(event instanceof CustomEvent)) {
    return null;
  }

  return event.detail as ToolbarEventDetail;
}

function focusFirstField() {
  const field = document.querySelector<HTMLInputElement | HTMLSelectElement>(
    'main input, main select',
  );

  field?.focus();
}

const emptyPersonForm: CreateResponsiblePersonDto = {
  lastName: '',
  firstName: '',
  middleName: '',
  personnelNumber: '',
  position: '',
  phone: '',
  email: '',
  managementId: '',
  serviceId: '',
  unitId: '',
  appointmentOrderNumber: '',
  appointmentDate: '',
  isActive: true,
};

export function MvoApp({
  initialView = 'home',
  initialImportId,
}: {
  initialView?: View;
  initialImportId?: string;
}) {
  const router = useRouter();
  const [view, setView] = useState<View>(initialView);
  const [apiState, setApiState] = useState<
    'checking' | 'available' | 'unavailable'
  >('checking');
  const topNavRef = useRef<HTMLElement | null>(null);
  const currentPage = NAV_ITEMS.find((item) => item.id === view);

  useEffect(() => {
    const activeItem =
      topNavRef.current?.querySelector<HTMLElement>('[data-active="true"]');

    activeItem?.scrollIntoView({
      block: 'nearest',
      inline: 'center',
    });
  }, [view]);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/health`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((response) => setApiState(response.ok ? 'available' : 'unavailable'))
      .catch(() => {
        if (!controller.signal.aborted) {
          setApiState('unavailable');
        }
      });

    return () => controller.abort();
  }, []);

  function selectView(nextView: View) {
    setView(nextView);
    router.push(getViewHref(nextView));
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--app-background)] text-[var(--text-primary)]">
      <header className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="flex h-10 items-center justify-between gap-3 px-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="grid h-6 w-8 place-items-center rounded border border-[var(--border)] bg-[var(--toolbar-background)] text-[11px] font-semibold text-[var(--primary)]">
              MVO
            </div>
            <p className="truncate text-sm font-semibold">Облік майна МВО</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
            <span className="hidden sm:inline">Користувач: Адміністратор</span>
            <span
              className={
                apiState === 'available'
                  ? 'text-[var(--success)]'
                  : apiState === 'checking'
                    ? 'text-[var(--warning)]'
                    : 'text-[var(--danger)]'
              }
            >
              API:{' '}
              {apiState === 'available'
                ? 'доступний'
                : apiState === 'checking'
                  ? 'перевірка'
                  : 'недоступний'}
            </span>
            <button
              className="btn btn-ghost !min-h-7 !w-auto !px-2 disabled:cursor-not-allowed disabled:opacity-55"
              disabled
              title={UNIMPLEMENTED_TITLE}
              type="button"
            >
              Довідка
            </button>
          </div>
        </div>
        <nav
          ref={topNavRef}
          className="compact-scrollbar flex h-9 items-end gap-1 overflow-x-auto whitespace-nowrap border-t border-[var(--border-light)] bg-[var(--toolbar-background)] px-2 text-sm"
        >
          {TOP_NAV_ITEMS.map((item) => (
            <TopNavButton
              key={item.label}
              item={item}
              active={item.view === view}
              onSelect={selectView}
            />
          ))}
        </nav>
        <PageToolbar currentView={view} />
      </header>

      <div className="flex min-h-0 flex-1 flex-col bg-[var(--workspace-background)]">
        <main className="compact-scrollbar min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          {view === 'home' ? <DashboardView onNavigate={selectView} /> : null}
          {view === 'persons' ? <PersonsView /> : null}
          {view === 'structure' ? <StructureView /> : null}
          {view === 'stock' ? <StockView /> : null}
          {view === 'nomenclature' ? <NomenclatureView /> : null}
          {view === 'imports' ? (
            <ImportsView initialImportId={initialImportId} />
          ) : null}
          {view === 'transactions' ? <TransactionsView /> : null}
        </main>
      </div>
      <StatusBar apiState={apiState} currentPage={currentPage?.label ?? 'Головна'} />
    </div>
  );
}

function TopNavButton({
  item,
  active,
  onSelect,
}: {
  item: TopNavItem;
  active: boolean;
  onSelect: (view: View) => void;
}) {
  return (
    <button
      className={`h-9 shrink-0 border px-3 text-[13px] transition ${
        active
          ? 'border-[var(--border)] border-b-[var(--workspace-background)] bg-[var(--workspace-background)] font-semibold text-[var(--text-primary)]'
          : item.disabled
            ? 'cursor-not-allowed border-transparent bg-transparent text-[var(--text-muted)]'
            : 'border-transparent bg-transparent text-[var(--text-secondary)] hover:border-[var(--border-light)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]'
      }`}
      data-active={active ? 'true' : undefined}
      disabled={item.disabled}
      title={item.disabled ? UNIMPLEMENTED_TITLE : undefined}
      type="button"
      onClick={() => item.view && onSelect(item.view)}
    >
      {item.label}
    </button>
  );
}

function PageToolbar({ currentView }: { currentView: View }) {
  const actions = getToolbarActions(currentView);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="relative border-t border-[var(--border-light)] bg-[var(--toolbar-background)] px-2 py-1">
      <div className="hidden min-h-9 items-center gap-1 overflow-x-auto sm:flex">
        {actions.map((action) => (
          <ToolbarButton
            key={action.label}
            action={action}
            currentView={currentView}
          />
        ))}
      </div>
      <div className="sm:hidden">
        <button
          className="btn btn-outline !min-h-7 !w-auto"
          type="button"
          onClick={() => setOpen((value) => !value)}
        >
          Дії
        </button>
        {open ? (
          <div className="absolute left-2 right-2 top-[calc(100%-0.25rem)] z-40 grid gap-1 rounded-md border border-[var(--border)] bg-white p-1 shadow-lg">
            {actions.map((action) => (
              <ToolbarButton
                key={action.label}
                action={action}
                currentView={currentView}
                onDone={() => setOpen(false)}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ToolbarButton({
  action,
  currentView,
  onDone,
}: {
  action: ToolbarAction;
  currentView: View;
  onDone?: () => void;
}) {
  return (
    <button
      className={`${action.primary ? 'btn btn-primary' : 'btn btn-outline'} !min-h-7 !w-auto disabled:cursor-not-allowed disabled:opacity-55`}
      disabled={action.disabled}
      title={action.disabled ? (action.title ?? UNIMPLEMENTED_TITLE) : action.title}
      type="button"
      onClick={() => {
        if (action.id) {
          emitToolbarAction(currentView, action.id);
          onDone?.();
        }
      }}
    >
      {action.label}
    </button>
  );
}

function getToolbarActions(view: View): ToolbarAction[] {
  const unavailable = { disabled: true, title: UNIMPLEMENTED_TITLE };

  const byView: Record<View, ToolbarAction[]> = {
    home: [{ label: 'Оновити дані', id: 'refresh', primary: true }],
    persons: [
      { label: 'Створити', id: 'create', primary: true },
      { label: 'Редагувати', ...unavailable },
      { label: 'Оновити', id: 'refresh' },
    ],
    structure: [
      { label: 'Створити управління', id: 'create-management', primary: true },
      { label: 'Створити підрозділ', ...unavailable },
      { label: 'Оновити', id: 'refresh' },
    ],
    nomenclature: [
      { label: 'Створити', id: 'create', primary: true },
      { label: 'Редагувати', ...unavailable },
      { label: 'Оновити', id: 'refresh' },
    ],
    stock: [
      { label: 'Фільтр', id: 'focus-filter', primary: true },
      { label: 'Оновити', id: 'refresh' },
      { label: 'Експорт', ...unavailable },
      { label: 'Друк', ...unavailable },
    ],
    imports: [
      { label: 'Новий імпорт', id: 'new-import', primary: true },
      { label: 'Оновити', id: 'refresh' },
    ],
    transactions: [
      { label: 'Фільтр', ...unavailable },
      { label: 'Оновити', id: 'refresh', primary: true },
      { label: 'Експорт', ...unavailable },
    ],
  };

  return byView[view];
}

function StatusBar({
  apiState,
  currentPage,
}: {
  apiState: 'checking' | 'available' | 'unavailable';
  currentPage: string;
}) {
  return (
    <footer className="flex h-7 items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--toolbar-background)] px-3 text-xs text-[var(--text-secondary)]">
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-[var(--success)]">Система готова</span>
        <span className="hidden sm:inline">Розділ: {currentPage}</span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span>
          API:{' '}
          {apiState === 'available'
            ? 'доступний'
            : apiState === 'checking'
              ? 'перевірка'
              : 'недоступний'}
        </span>
        <span className="hidden sm:inline">Версія: 0.1.0</span>
        <span className="hidden md:inline">Користувач: Адміністратор</span>
      </div>
    </footer>
  );
}

function DashboardView({ onNavigate }: { onNavigate: (view: View) => void }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setStats(await apiClient.dashboardStats());
    } catch {
      setStats(null);
      setError(
        'Не вдалося отримати показники dashboard. Перевірте доступність backend API.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    function handleToolbar(event: Event) {
      const detail = getToolbarDetail(event);
      if (detail?.view === 'home' && detail.action === 'refresh') {
        void loadStats();
      }
    }

    window.addEventListener(TOOLBAR_EVENT, handleToolbar);
    return () => window.removeEventListener(TOOLBAR_EVENT, handleToolbar);
  }, [loadStats]);

  const cards = [
    ['Активні МВО', stats?.activeResponsiblePersons],
    ['Управління', stats?.managements],
    ['Служби', stats?.services],
    ['Підрозділи', stats?.units],
    ['Номенклатура', stats?.inventoryItems],
    ['Потребують перевірки', stats?.inventoryItemsNeedsReview],
    ['МВО із залишками', stats?.responsiblePersonsWithStock],
    ['Проведені імпорти', stats?.completedImports],
    ['Імпорти з помилками', stats?.importsWithErrors],
    ['Розбіжності надходжень', stats?.recentReceiptDiscrepancies],
  ];

  return (
    <section className="grid gap-3">
      <PageHeader
        title="Головна"
        description="Поточний стан організаційної структури та реєстру МВО."
      />
      {error ? <ErrorMessage message={error} /> : null}
      <div className="erp-panel grid gap-px overflow-hidden bg-[var(--border-light)] sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(([label, value]) => (
          <div
            key={label}
            className="bg-white px-3 py-2"
          >
            <p className="truncate text-xs font-medium text-[var(--text-secondary)]">
              {label}
            </p>
            <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-[var(--primary)]">
              {loading ? (
                <span className="block h-6 w-16 animate-pulse rounded bg-[var(--border-light)]" />
              ) : (
                value ?? 0
              )}
            </p>
          </div>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="erp-panel p-3">
          <SectionTitle
            title="Потребують уваги"
            description="Короткий список контрольних показників для щоденної перевірки."
          />
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <Stat
              label="Номенклатура на перевірці"
              value={stats?.inventoryItemsNeedsReview ?? 0}
            />
            <Stat
              label="Імпорти з помилками"
              value={stats?.importsWithErrors ?? 0}
            />
            <Stat
              label="Розбіжності"
              value={stats?.recentReceiptDiscrepancies ?? 0}
            />
          </div>
        </div>
        <div className="erp-panel p-3">
          <SectionTitle
            title="Швидкі дії"
            description="Основні робочі розділи системи."
          />
          <div className="mt-3 grid gap-1.5">
            <button
              className="btn btn-outline justify-start"
              type="button"
              onClick={() => {
                window.sessionStorage.setItem('mvo:open-import-upload', '1');
                onNavigate('imports');
              }}
            >
              Новий імпорт
            </button>
            <button
              className="btn btn-outline justify-start"
              type="button"
              onClick={() => onNavigate('persons')}
            >
              Реєстр МВО
            </button>
            <button
              className="btn btn-outline justify-start"
              type="button"
              onClick={() => onNavigate('stock')}
            >
              Переглянути залишки
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function PersonsView() {
  const [managements, setManagements] = useState<Management[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [persons, setPersons] = useState<ResponsiblePerson[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [filters, setFilters] = useState<ResponsiblePersonsQuery>({
    page: 1,
    limit: 20,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingPerson, setEditingPerson] = useState<ResponsiblePerson | null>(
    null,
  );
  const [isFormOpen, setFormOpen] = useState(false);

  const loadFilters = useCallback(async () => {
    const [nextManagements, nextServices] = await Promise.all([
      apiClient.managements(),
      apiClient.services(
        filters.managementId ? { managementId: filters.managementId } : {},
      ),
    ]);

    setManagements(nextManagements);
    setServices(nextServices);
  }, [filters.managementId]);

  const loadPersons = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.responsiblePersons(filters);
      setPersons(response.items);
      setPagination(response.pagination);
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadFilters().catch((reason: unknown) => setError(getErrorMessage(reason)));
  }, [loadFilters]);

  useEffect(() => {
    void loadPersons();
  }, [loadPersons]);

  useEffect(() => {
    function handleToolbar(event: Event) {
      const detail = getToolbarDetail(event);
      if (detail?.view !== 'persons') return;

      if (detail.action === 'create') {
        setEditingPerson(null);
        setFormOpen(true);
      }

      if (detail.action === 'refresh') {
        void loadFilters();
        void loadPersons();
      }
    }

    window.addEventListener(TOOLBAR_EVENT, handleToolbar);
    return () => window.removeEventListener(TOOLBAR_EVENT, handleToolbar);
  }, [loadFilters, loadPersons]);

  return (
    <section className="grid gap-3">
      <PageHeader
        title="МВО"
        description="Реєстр матеріально відповідальних осіб."
        action={
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => {
              setEditingPerson(null);
              setFormOpen(true);
            }}
          >
            Додати МВО
          </button>
        }
      />

      <div className="erp-toolbar p-2">
        <div className="grid gap-2 md:grid-cols-4">
          <input
            className="input"
            placeholder="Пошук"
            value={filters.search ?? ''}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                search: event.target.value,
                page: 1,
              }))
            }
          />
          <Select
            value={filters.managementId ?? ''}
            onChange={(managementId) =>
              setFilters((current) => ({
                ...current,
                managementId,
                serviceId: undefined,
                unitId: undefined,
                page: 1,
              }))
            }
          >
            <option value="">Усі управління</option>
            {managements.map((management) => (
              <option key={management.id} value={management.id}>
                {management.name}
              </option>
            ))}
          </Select>
          <Select
            value={filters.serviceId ?? ''}
            onChange={(serviceId) =>
              setFilters((current) => ({
                ...current,
                serviceId,
                unitId: undefined,
                page: 1,
              }))
            }
          >
            <option value="">Усі служби</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </Select>
          <Select
            value={
              filters.isActive === undefined ? '' : String(filters.isActive)
            }
            onChange={(value) =>
              setFilters((current) => ({
                ...current,
                isActive: value === '' ? undefined : value === 'true',
                page: 1,
              }))
            }
          >
            <option value="">Усі статуси</option>
            <option value="true">Активні</option>
            <option value="false">Неактивні</option>
          </Select>
        </div>
      </div>

      {error ? <ErrorMessage message={error} /> : null}
      {loading ? <LoadingMessage /> : null}
      {!loading ? (
        <PersonsTable
          persons={persons}
          onEdit={(person) => {
            setEditingPerson(person);
            setFormOpen(true);
          }}
        />
      ) : null}
      <PaginationControls
        page={pagination.page}
        totalPages={pagination.totalPages}
        total={pagination.total}
        onPage={(page) => setFilters((current) => ({ ...current, page }))}
      />

      {isFormOpen ? (
        <PersonForm
          person={editingPerson}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            void loadFilters();
            void loadPersons();
          }}
        />
      ) : null}
    </section>
  );
}

function PersonsTable({
  persons,
  onEdit,
}: {
  persons: ResponsiblePerson[];
  onEdit: (person: ResponsiblePerson) => void;
}) {
  if (persons.length === 0) {
    return <EmptyState message="МВО не знайдено." />;
  }

  return (
    <div className="app-card overflow-hidden">
      <div className="hidden overflow-x-auto md:block">
        <table className="data-table">
          <thead>
            <tr>
              {[
                'ПІП',
                'Табельний номер',
                'Управління',
                'Служба',
                'Підрозділ',
                'Статус',
                'Дії',
              ].map((header) => (
                <th key={header} className="px-4 py-3">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {persons.map((person) => (
              <tr key={person.id}>
                <td className="px-4 py-3 font-medium">{fullName(person)}</td>
                <td className="px-4 py-3">{person.personnelNumber}</td>
                <td className="max-w-64 px-4 py-3">{person.management.name}</td>
                <td className="px-4 py-3">{person.service.name}</td>
                <td className="px-4 py-3">{person.unit?.name ?? '-'}</td>
                <td className="px-4 py-3">
                  <StatusBadge active={person.isActive} />
                </td>
                <td className="px-4 py-3">
                  <button
                    className="btn btn-ghost !min-h-0 !w-fit !p-0"
                    type="button"
                    onClick={() => onEdit(person)}
                  >
                    Редагувати
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 p-3 md:hidden">
        {persons.map((person) => (
          <div
            key={person.id}
            className="rounded-md border border-slate-200 p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-words font-semibold">{fullName(person)}</p>
                <p className="text-sm text-slate-500">
                  {person.personnelNumber}
                </p>
              </div>
              <StatusBadge active={person.isActive} />
            </div>
            <dl className="mt-3 grid gap-2 text-sm">
              <InfoRow label="Управління" value={person.management.name} />
              <InfoRow label="Служба" value={person.service.name} />
              <InfoRow label="Підрозділ" value={person.unit?.name ?? '-'} />
            </dl>
            <button
              className="mt-3 btn btn-ghost !min-h-0 !w-fit !p-0"
              type="button"
              onClick={() => onEdit(person)}
            >
              Редагувати
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function PersonForm({
  person,
  onClose,
  onSaved,
}: {
  person: ResponsiblePerson | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<CreateResponsiblePersonDto>(() =>
    person
      ? {
          lastName: person.lastName,
          firstName: person.firstName,
          middleName: person.middleName ?? '',
          personnelNumber: person.personnelNumber,
          position: person.position ?? '',
          phone: person.phone ?? '',
          email: person.email ?? '',
          managementId: person.managementId,
          serviceId: person.serviceId,
          unitId: person.unitId ?? '',
          appointmentOrderNumber: person.appointmentOrderNumber ?? '',
          appointmentDate: person.appointmentDate
            ? person.appointmentDate.slice(0, 10)
            : '',
          isActive: person.isActive,
        }
      : emptyPersonForm,
  );
  const [managements, setManagements] = useState<Management[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [personTab, setPersonTab] = useState<
    'general' | 'stock' | 'operations'
  >('general');

  useEffect(() => {
    apiClient
      .managements()
      .then(setManagements)
      .catch((reason: unknown) => setError(getErrorMessage(reason)));
  }, []);

  useEffect(() => {
    if (!form.managementId) {
      setServices([]);
      return;
    }

    apiClient
      .services({ managementId: form.managementId })
      .then(setServices)
      .catch((reason: unknown) => setError(getErrorMessage(reason)));
  }, [form.managementId]);

  useEffect(() => {
    if (!form.serviceId) {
      setUnits([]);
      return;
    }

    apiClient
      .units({ serviceId: form.serviceId })
      .then(setUnits)
      .catch((reason: unknown) => setError(getErrorMessage(reason)));
  }, [form.serviceId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');

    const payload: CreateResponsiblePersonDto = normalizePersonForm(form);

    try {
      if (person) {
        await apiClient.updateResponsiblePerson(person.id, payload);
      } else {
        await apiClient.createResponsiblePerson(payload);
      }
      onSaved();
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={person ? 'Редагувати МВО' : 'Додати МВО'} onClose={onClose}>
      {person ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {[
            ['general', 'Загальні дані'],
            ['stock', 'Залишки'],
            ['operations', 'Операції'],
          ].map(([id, label]) => (
            <button
              key={id}
              className={`rounded-md px-3 py-2 text-sm font-semibold ${
                personTab === id
                  ? 'bg-[var(--primary)] text-white'
                  : 'border border-slate-300 text-slate-700'
              }`}
              type="button"
              onClick={() =>
                setPersonTab(id as 'general' | 'stock' | 'operations')
              }
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
      {personTab === 'general' ? (
        <form className="grid gap-3" onSubmit={submit}>
          {error ? <ErrorMessage message={error} /> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Прізвище">
              <input
                required
                className="input"
                value={form.lastName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    lastName: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Ім’я">
              <input
                required
                className="input"
                value={form.firstName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    firstName: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="По батькові">
              <input
                className="input"
                value={form.middleName ?? ''}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    middleName: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Табельний номер">
              <input
                required
                className="input"
                value={form.personnelNumber}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    personnelNumber: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Посада">
              <input
                className="input"
                value={form.position ?? ''}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    position: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Телефон">
              <input
                className="input"
                value={form.phone ?? ''}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Email">
              <input
                className="input"
                type="email"
                value={form.email ?? ''}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Управління">
              <Select
                required
                value={form.managementId}
                onChange={(managementId) =>
                  setForm((current) => ({
                    ...current,
                    managementId,
                    serviceId: '',
                    unitId: '',
                  }))
                }
              >
                <option value="">Оберіть управління</option>
                {managements.map((management) => (
                  <option key={management.id} value={management.id}>
                    {management.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Служба">
              <Select
                required
                value={form.serviceId}
                onChange={(serviceId) =>
                  setForm((current) => ({ ...current, serviceId, unitId: '' }))
                }
              >
                <option value="">Оберіть службу</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Підрозділ">
              <Select
                value={form.unitId ?? ''}
                onChange={(unitId) =>
                  setForm((current) => ({ ...current, unitId }))
                }
              >
                <option value="">Без підрозділу</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Номер наказу">
              <input
                className="input"
                value={form.appointmentOrderNumber ?? ''}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    appointmentOrderNumber: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Дата призначення">
              <input
                className="input"
                type="date"
                value={form.appointmentDate ?? ''}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    appointmentDate: event.target.value,
                  }))
                }
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              checked={form.isActive ?? true}
              type="checkbox"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  isActive: event.target.checked,
                }))
              }
            />
            Активний запис
          </label>
          <FormActions saving={saving} onClose={onClose} />
        </form>
      ) : null}
      {person && personTab === 'stock' ? (
        <PersonStockTab personId={person.id} />
      ) : null}
      {person && personTab === 'operations' ? (
        <PersonOperationsTab personId={person.id} />
      ) : null}
    </Modal>
  );
}

function PersonStockTab({ personId }: { personId: string }) {
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient
      .getResponsiblePersonStockBalances(personId, { limit: 50 })
      .then((response) => setBalances(response.items))
      .catch((reason: unknown) => setError(getErrorMessage(reason)));
  }, [personId]);

  if (error) return <ErrorMessage message={error} />;

  return (
    <SimpleTable
      headers={['Код', 'Найменування', 'Кількість', 'Од.']}
      rows={balances.map((balance) => [
        balance.inventoryItem.externalCode,
        balance.inventoryItem.name,
        balance.quantity,
        balance.inventoryItem.unitOfMeasure ?? '-',
      ])}
    />
  );
}

function PersonOperationsTab({ personId }: { personId: string }) {
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient
      .getResponsiblePersonStockTransactions(personId, { limit: 50 })
      .then((response) => setTransactions(response.items))
      .catch((reason: unknown) => setError(getErrorMessage(reason)));
  }, [personId]);

  if (error) return <ErrorMessage message={error} />;

  return (
    <SimpleTable
      headers={[
        'Дата',
        'Тип',
        'Позиція',
        'Кількість',
        'Було',
        'Стало',
        'Джерело',
      ]}
      rows={transactions.map((transaction) => [
        new Date(transaction.occurredAt).toLocaleDateString('uk-UA'),
        transaction.type,
        transaction.inventoryItem.name,
        transaction.quantity,
        transaction.balanceBefore,
        transaction.balanceAfter,
        transaction.sourceDocument ?? '-',
      ])}
    />
  );
}

function StructureView() {
  const [managements, setManagements] = useState<Management[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [orgForm, setOrgForm] = useState<OrgForm | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setManagements(await apiClient.managements());
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function handleToolbar(event: Event) {
      const detail = getToolbarDetail(event);
      if (detail?.view !== 'structure') return;

      if (detail.action === 'create-management') {
        setOrgForm({ type: 'management' });
      }

      if (detail.action === 'refresh') {
        void load();
      }
    }

    window.addEventListener(TOOLBAR_EVENT, handleToolbar);
    return () => window.removeEventListener(TOOLBAR_EVENT, handleToolbar);
  }, [load]);

  return (
    <section className="grid gap-3">
      <PageHeader
        title="Організаційна структура"
        description="Управління, служби та підрозділи."
        action={
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => setOrgForm({ type: 'management' })}
          >
            Створити управління
          </button>
        }
      />
      {error ? <ErrorMessage message={error} /> : null}
      {loading ? <LoadingMessage /> : null}
      {!loading && managements.length === 0 ? (
        <EmptyState message="Організаційну структуру ще не створено." />
      ) : null}
      <div className="grid min-h-[420px] gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="erp-panel overflow-hidden">
          <div className="border-b border-[var(--border)] bg-[var(--toolbar-background)] px-2 py-1.5 text-xs font-semibold">
            Дерево структури
          </div>
          <div className="compact-scrollbar max-h-[560px] overflow-auto p-2 text-[13px]">
            {managements.map((management) => (
              <div key={management.id} className="grid gap-1">
                <button
                  className="flex h-8 items-center justify-between gap-2 rounded px-2 text-left hover:bg-[var(--hover-row)]"
                  type="button"
                  onClick={() =>
                    setOrgForm({ type: 'management', data: management })
                  }
                >
                  <span className="truncate">▾ {management.name}</span>
                  <StatusBadge active={management.isActive} />
                </button>
                <div className="ml-4 border-l border-[var(--border)] pl-2">
                  <button
                    className="btn btn-ghost !min-h-7 !w-fit !px-0"
                    type="button"
                    onClick={() =>
                      setOrgForm({
                        type: 'service',
                        managementId: management.id,
                      })
                    }
                  >
                    + служба
                  </button>
                  {management.services?.map((service) => (
                    <div key={service.id}>
                      <button
                        className="flex h-8 w-full items-center justify-between gap-2 rounded px-2 text-left hover:bg-[var(--hover-row)]"
                        type="button"
                        onClick={() =>
                          setOrgForm({
                            type: 'service',
                            managementId: management.id,
                            data: service,
                          })
                        }
                      >
                        <span className="truncate">▾ {service.name}</span>
                        <span className="font-mono text-xs text-[var(--text-secondary)]">
                          {service.code}
                        </span>
                      </button>
                      <div className="ml-4 border-l border-[var(--border-light)] pl-2">
                        <button
                          className="btn btn-ghost !min-h-7 !w-fit !px-0"
                          type="button"
                          onClick={() =>
                            setOrgForm({
                              type: 'unit',
                              serviceId: service.id,
                            })
                          }
                        >
                          + підрозділ
                        </button>
                        {service.units?.map((unit) => (
                          <button
                            key={unit.id}
                            className="flex h-8 w-full items-center justify-between gap-2 rounded px-2 text-left hover:bg-[var(--hover-row)]"
                            type="button"
                            onClick={() =>
                              setOrgForm({
                                type: 'unit',
                                serviceId: service.id,
                                data: unit,
                              })
                            }
                          >
                            <span className="truncate">{unit.name}</span>
                            <span className="font-mono text-xs text-[var(--text-secondary)]">
                              {unit.code}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <SimpleTable
          headers={['Тип', 'Назва', 'Код', 'Статус']}
          rows={managements.flatMap((management) => [
            [
              'Управління',
              management.name,
              management.code,
              <StatusBadge key={`${management.id}-status`} active={management.isActive} />,
            ],
            ...(management.services ?? []).flatMap((service) => [
              [
                'Служба',
                service.name,
                service.code,
                <StatusBadge key={`${service.id}-status`} active={service.isActive} />,
              ],
              ...(service.units ?? []).map((unit) => [
                'Підрозділ',
                unit.name,
                unit.code,
                <StatusBadge key={`${unit.id}-status`} active={unit.isActive} />,
              ]),
            ]),
          ])}
        />
      </div>
      {orgForm ? (
        <OrgFormModal
          form={orgForm}
          onClose={() => setOrgForm(null)}
          onSaved={() => {
            setOrgForm(null);
            void load();
          }}
        />
      ) : null}
    </section>
  );
}

function OrgFormModal({
  form,
  onClose,
  onSaved,
}: {
  form: OrgForm;
  onClose: () => void;
  onSaved: () => void;
}) {
  const title =
    form.type === 'management'
      ? form.data
        ? 'Редагувати управління'
        : 'Створити управління'
      : form.type === 'service'
        ? form.data
          ? 'Редагувати службу'
          : 'Створити службу'
        : form.data
          ? 'Редагувати підрозділ'
          : 'Створити підрозділ';
  const [name, setName] = useState(form.data?.name ?? '');
  const [shortName, setShortName] = useState(
    form.type === 'management' ? (form.data?.shortName ?? '') : '',
  );
  const [code, setCode] = useState(form.data?.code ?? '');
  const [isActive, setActive] = useState(form.data?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      if (form.type === 'management') {
        const payload: CreateManagementDto = {
          name,
          shortName: shortName || null,
          code,
          isActive,
        };
        if (form.data) {
          await apiClient.updateManagement(form.data.id, payload);
        } else {
          await apiClient.createManagement(payload);
        }
      } else if (form.type === 'service') {
        const payload: CreateServiceDto = {
          name,
          code,
          managementId: form.managementId,
          isActive,
        };
        if (form.data) {
          await apiClient.updateService(form.data.id, payload);
        } else {
          await apiClient.createService(payload);
        }
      } else {
        const payload: CreateUnitDto = {
          name,
          code,
          serviceId: form.serviceId,
          isActive,
        };
        if (form.data) {
          await apiClient.updateUnit(form.data.id, payload);
        } else {
          await apiClient.createUnit(payload);
        }
      }
      onSaved();
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form className="grid gap-3" onSubmit={submit}>
        {error ? <ErrorMessage message={error} /> : null}
        <Field label="Назва">
          <input
            required
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        {form.type === 'management' ? (
          <Field label="Коротка назва">
            <input
              className="input"
              value={shortName}
              onChange={(event) => setShortName(event.target.value)}
            />
          </Field>
        ) : null}
        <Field label="Код">
          <input
            required
            className="input"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            checked={isActive}
            type="checkbox"
            onChange={(event) => setActive(event.target.checked)}
          />
          Активний запис
        </label>
        <FormActions saving={saving} onClose={onClose} />
      </form>
    </Modal>
  );
}

function NomenclatureView() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [filters, setFilters] = useState({
    search: '',
    reviewStatus: '',
    isActive: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.inventoryItems({
        search: filters.search,
        reviewStatus:
          filters.reviewStatus === ''
            ? undefined
            : (filters.reviewStatus as 'VERIFIED' | 'NEEDS_REVIEW'),
        isActive:
          filters.isActive === '' ? undefined : filters.isActive === 'true',
        page: pagination.page,
        limit: pagination.limit,
      });
      setItems(response.items);
      setPagination(response.pagination);
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.limit]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function handleToolbar(event: Event) {
      const detail = getToolbarDetail(event);
      if (detail?.view !== 'nomenclature') return;

      if (detail.action === 'create') {
        setFormOpen(true);
      }

      if (detail.action === 'refresh') {
        void load();
      }
    }

    window.addEventListener(TOOLBAR_EVENT, handleToolbar);
    return () => window.removeEventListener(TOOLBAR_EVENT, handleToolbar);
  }, [load]);

  return (
    <section className="grid gap-3">
      <PageHeader
        title="Номенклатура"
        description="Централізований довідник позицій майна."
        action={
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => setFormOpen(true)}
          >
            Додати позицію
          </button>
        }
      />
      <div className="erp-toolbar p-2">
        <div className="grid gap-2 md:grid-cols-3">
          <input
            className="input"
            placeholder="Пошук за кодом або назвою"
            value={filters.search}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                search: event.target.value,
              }))
            }
          />
          <Select
            value={filters.reviewStatus}
            onChange={(reviewStatus) =>
              setFilters((current) => ({ ...current, reviewStatus }))
            }
          >
            <option value="">Усі статуси перевірки</option>
            <option value="NEEDS_REVIEW">Потребують перевірки</option>
            <option value="VERIFIED">Перевірені</option>
          </Select>
          <Select
            value={filters.isActive}
            onChange={(isActive) =>
              setFilters((current) => ({ ...current, isActive }))
            }
          >
            <option value="">Усі записи</option>
            <option value="true">Активні</option>
            <option value="false">Неактивні</option>
          </Select>
        </div>
      </div>
      {error ? <ErrorMessage message={error} /> : null}
      {loading ? <LoadingMessage /> : null}
      {!loading ? (
        <SimpleTable
          headers={[
            'Код',
            'Найменування',
            'Од.',
            'Категорія',
            'Перевірка',
            'МВО',
            'Залишок',
          ]}
          rows={items.map((item) => [
            item.externalCode,
            item.name,
            item.unitOfMeasure ?? '-',
            item.category ?? '-',
            item.reviewStatus === 'NEEDS_REVIEW'
              ? 'Потребує перевірки'
              : 'Перевірено',
            String(item.responsiblePersonsCount ?? 0),
            item.totalQuantity ?? '0',
          ])}
        />
      ) : null}
      <PaginationControls
        page={pagination.page}
        totalPages={pagination.totalPages}
        total={pagination.total}
        onPage={(page) => setPagination((current) => ({ ...current, page }))}
      />
      {formOpen ? (
        <InventoryItemForm
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            void load();
          }}
        />
      ) : null}
    </section>
  );
}

function InventoryItemForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    externalCode: '',
    name: '',
    unitOfMeasure: '',
    category: '',
    description: '',
    reviewStatus: 'VERIFIED' as 'VERIFIED' | 'NEEDS_REVIEW',
    isActive: true,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiClient.createInventoryItem({
        ...form,
        unitOfMeasure: form.unitOfMeasure || null,
        category: form.category || null,
        description: form.description || null,
      });
      onSaved();
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Додати номенклатуру" onClose={onClose}>
      <form className="grid gap-3" onSubmit={submit}>
        {error ? <ErrorMessage message={error} /> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Зовнішній код">
            <input
              required
              className="input"
              value={form.externalCode}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  externalCode: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Найменування">
            <input
              required
              className="input"
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
            />
          </Field>
          <Field label="Одиниця виміру">
            <input
              className="input"
              value={form.unitOfMeasure}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  unitOfMeasure: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Категорія">
            <input
              className="input"
              value={form.category}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  category: event.target.value,
                }))
              }
            />
          </Field>
        </div>
        <Field label="Опис">
          <textarea
            className="input min-h-24"
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
          />
        </Field>
        <Field label="Статус перевірки">
          <Select
            value={form.reviewStatus}
            onChange={(reviewStatus) =>
              setForm((current) => ({
                ...current,
                reviewStatus: reviewStatus as 'VERIFIED' | 'NEEDS_REVIEW',
              }))
            }
          >
            <option value="VERIFIED">Перевірено</option>
            <option value="NEEDS_REVIEW">Потребує перевірки</option>
          </Select>
        </Field>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                isActive: event.target.checked,
              }))
            }
          />
          Активний запис
        </label>
        <FormActions saving={saving} onClose={onClose} />
      </form>
    </Modal>
  );
}

function StockView() {
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [persons, setPersons] = useState<ResponsiblePerson[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [filters, setFilters] = useState({
    search: '',
    responsiblePersonId: '',
    onlyPositive: true,
  });
  const [manualOpen, setManualOpen] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [balanceResponse, personsResponse, itemsResponse] =
        await Promise.all([
          apiClient.stockBalances({
            ...filters,
            responsiblePersonId: filters.responsiblePersonId || undefined,
            page: pagination.page,
            limit: pagination.limit,
          }),
          apiClient.responsiblePersons({ limit: 100 }),
          apiClient.inventoryItems({ limit: 100 }),
        ]);
      setBalances(balanceResponse.items);
      setPagination(balanceResponse.pagination);
      setPersons(personsResponse.items);
      setItems(itemsResponse.items);
    } catch (reason) {
      setError(getErrorMessage(reason));
    }
  }, [filters, pagination.page, pagination.limit]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function handleToolbar(event: Event) {
      const detail = getToolbarDetail(event);
      if (detail?.view !== 'stock') return;

      if (detail.action === 'focus-filter') {
        focusFirstField();
      }

      if (detail.action === 'refresh') {
        void load();
      }
    }

    window.addEventListener(TOOLBAR_EVENT, handleToolbar);
    return () => window.removeEventListener(TOOLBAR_EVENT, handleToolbar);
  }, [load]);

  return (
    <section className="grid gap-3">
      <PageHeader
        title="Залишки"
        description="Поточні залишки майна за МВО."
        action={
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => setManualOpen(true)}
          >
            Додати надходження вручну
          </button>
        }
      />
      <div className="erp-toolbar p-2">
        <div className="grid gap-2 md:grid-cols-3">
          <input
            className="input"
            placeholder="Пошук"
            value={filters.search}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                search: event.target.value,
              }))
            }
          />
          <Select
            value={filters.responsiblePersonId}
            onChange={(responsiblePersonId) =>
              setFilters((current) => ({ ...current, responsiblePersonId }))
            }
          >
            <option value="">Усі МВО</option>
            {persons.map((person) => (
              <option key={person.id} value={person.id}>
                {fullName(person)}
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={filters.onlyPositive}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  onlyPositive: event.target.checked,
                }))
              }
            />
            Лише позитивні залишки
          </label>
        </div>
      </div>
      {error ? <ErrorMessage message={error} /> : null}
      <SimpleTable
        headers={['МВО', 'Код', 'Найменування', 'Од.', 'Залишок', 'Дії']}
        rows={balances.map((balance) => [
          balance.responsiblePerson.fullName,
          balance.inventoryItem.externalCode,
          balance.inventoryItem.name,
          balance.inventoryItem.unitOfMeasure ?? '-',
          balance.quantity,
          'Переглянути історію',
        ])}
      />
      <PaginationControls
        page={pagination.page}
        totalPages={pagination.totalPages}
        total={pagination.total}
        onPage={(page) => setPagination((current) => ({ ...current, page }))}
      />
      {manualOpen ? (
        <ManualReceiptForm
          persons={persons}
          items={items}
          onClose={() => setManualOpen(false)}
          onSaved={() => {
            setManualOpen(false);
            void load();
          }}
        />
      ) : null}
    </section>
  );
}

function ManualReceiptForm({
  persons,
  items,
  onClose,
  onSaved,
}: {
  persons: ResponsiblePerson[];
  items: InventoryItem[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    responsiblePersonId: '',
    inventoryItemId: '',
    quantity: '',
    occurredAt: new Date().toISOString().slice(0, 10),
    sourceDocument: '',
    comment: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiClient.manualReceipt({
        ...form,
        sourceDocument: form.sourceDocument || undefined,
        comment: form.comment || undefined,
      });
      onSaved();
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Додати надходження вручну" onClose={onClose}>
      <form className="grid gap-3" onSubmit={submit}>
        {error ? <ErrorMessage message={error} /> : null}
        <Field label="МВО">
          <Select
            required
            value={form.responsiblePersonId}
            onChange={(responsiblePersonId) =>
              setForm((current) => ({ ...current, responsiblePersonId }))
            }
          >
            <option value="">Оберіть МВО</option>
            {persons.map((person) => (
              <option key={person.id} value={person.id}>
                {fullName(person)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Номенклатура">
          <Select
            required
            value={form.inventoryItemId}
            onChange={(inventoryItemId) =>
              setForm((current) => ({ ...current, inventoryItemId }))
            }
          >
            <option value="">Оберіть позицію</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.externalCode} — {item.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Кількість">
            <input
              required
              className="input"
              value={form.quantity}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  quantity: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Дата">
            <input
              required
              type="date"
              className="input"
              value={form.occurredAt}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  occurredAt: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Документ">
            <input
              className="input"
              value={form.sourceDocument}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  sourceDocument: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Коментар">
            <input
              className="input"
              value={form.comment}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  comment: event.target.value,
                }))
              }
            />
          </Field>
        </div>
        <FormActions saving={saving} onClose={onClose} />
      </form>
    </Modal>
  );
}

function ImportsView({ initialImportId }: { initialImportId?: string }) {
  const router = useRouter();
  const [imports, setImports] = useState<ImportBatch[]>([]);
  const [selected, setSelected] = useState<ImportBatch | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [persons, setPersons] = useState<ResponsiblePerson[]>([]);
  const [rowFilters, setRowFilters] = useState({
    search: '',
    status: '',
    page: 1,
    limit: 20,
  });
  const [rowPagination, setRowPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [mappings, setMappings] = useState<
    Record<string, { responsiblePersonId: string; save: boolean }>
  >({});
  const [error, setError] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [response, personsResponse] = await Promise.all([
        apiClient.imports({ limit: 50 }),
        apiClient.responsiblePersons({ isActive: true, limit: 100 }),
      ]);
      setImports(response.items);
      setPersons(personsResponse.items);
    } catch (reason) {
      setError(getErrorMessage(reason));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadImport = useCallback(
    async (id: string) => {
      const [batch, response] = await Promise.all([
        apiClient.getImportBatch(id),
        apiClient.getImportRows(id, {
          search: rowFilters.search,
          status: rowFilters.status || undefined,
          page: rowFilters.page,
          limit: rowFilters.limit,
        }),
      ]);
      setSelected(batch);
      setRows(response.items);
      setRowPagination(response.pagination);
    },
    [rowFilters],
  );

  useEffect(() => {
    if (initialImportId) {
      loadImport(initialImportId).catch((reason: unknown) =>
        setError(getErrorMessage(reason)),
      );
    }
  }, [initialImportId, loadImport]);

  async function openImport(importBatch: ImportBatch) {
    router.push(`/imports/${importBatch.id}`);
    await loadImport(importBatch.id);
  }

  const reloadSelected = useCallback(async () => {
    if (!selected) return;
    await loadImport(selected.id);
    await load();
  }, [load, loadImport, selected]);

  useEffect(() => {
    if (window.sessionStorage.getItem('mvo:open-import-upload') === '1') {
      window.sessionStorage.removeItem('mvo:open-import-upload');
      setUploadOpen(true);
    }
  }, []);

  useEffect(() => {
    function handleToolbar(event: Event) {
      const detail = getToolbarDetail(event);
      if (detail?.view !== 'imports') return;

      if (detail.action === 'new-import') {
        setUploadOpen(true);
      }

      if (detail.action === 'refresh') {
        void load();
        void reloadSelected();
      }
    }

    window.addEventListener(TOOLBAR_EVENT, handleToolbar);
    return () => window.removeEventListener(TOOLBAR_EVENT, handleToolbar);
  }, [load, reloadSelected]);

  async function saveMappings() {
    if (!selected) return;
    const payload = Object.entries(mappings)
      .filter(([, value]) => value.responsiblePersonId)
      .map(([counterpartyRaw, value]) => ({
        counterpartyRaw,
        responsiblePersonId: value.responsiblePersonId,
        saveExternalAccountingName: value.save,
      }));

    if (payload.length === 0) return;

    await apiClient.updateImportMappings(selected.id, { mappings: payload });
    setMappings({});
    await reloadSelected();
  }

  async function validateSelected() {
    if (!selected) return;
    await apiClient.validateImport(selected.id);
    await reloadSelected();
  }

  async function commitSelected() {
    if (!selected) return;
    setSelected(await apiClient.commitImport(selected.id));
    setConfirmOpen(false);
    await reloadSelected();
  }

  async function cancelSelected() {
    if (!selected) return;
    await apiClient.cancelImport(selected.id);
    await reloadSelected();
  }

  const missingCounterparties = Array.from(
    new Set(
      rows
        .filter(
          (row) =>
            !row.responsiblePerson &&
            row.status !== 'SKIPPED' &&
            row.counterpartyRaw,
        )
        .map((row) => row.counterpartyRaw),
    ),
  );

  const canCommit =
    selected?.status === 'VALIDATED' &&
    (selected.preview?.errorRows ?? 1) === 0;

  async function refreshRowsWithFilters(nextFilters = rowFilters) {
    if (!selected) return;
    const response = await apiClient.getImportRows(selected.id, {
      search: nextFilters.search,
      status: nextFilters.status || undefined,
      page: nextFilters.page,
      limit: nextFilters.limit,
    });
    setRows(response.items);
    setRowPagination(response.pagination);
  }

  return (
    <section className="grid gap-3">
      <PageHeader
        title="Імпорт"
        description="Завантаження початкових залишків і нових надходжень."
        action={
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => setUploadOpen(true)}
          >
            Новий імпорт
          </button>
        }
      />
      {error ? <ErrorMessage message={error} /> : null}
      <SimpleTable
        headers={[
          'Файл',
          'Тип',
          'Статус',
          'Рядків',
          'Помилки',
          'Попередження',
          'Проведено',
        ]}
        rows={imports.map((item) => [
          <span
            key={item.id}
            className="block max-w-72 truncate"
            title={item.originalFilename}
          >
            {item.originalFilename}
          </span>,
          importTypeLabel(item.type),
          <StatusPill key={`${item.id}-status`} status={item.status} />,
          String(item.totalRows),
          String(item.errorRows),
          String(item.warningRows),
          String(item.importedRows),
        ])}
        onRowClick={(index) => void openImport(imports[index])}
      />
      {selected ? (
        <div className="app-card grid gap-4 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h3
                className="truncate text-lg font-semibold"
                title={selected.originalFilename}
              >
                {selected.originalFilename}
              </h3>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[var(--text-secondary)]">
                <span>{importTypeLabel(selected.type)}</span>
                <StatusPill status={selected.status} />
                <span>
                  {selected.encoding} · {selected.delimiter}
                </span>
              </p>
            </div>
            <button
              className="btn btn-ghost !min-h-0 !w-fit !p-0"
              type="button"
              onClick={() => router.push('/imports')}
            >
              Повернутися до імпортів
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-5">
            <Stat label="Всього" value={selected.totalRows} />
            <Stat
              label="Валідні"
              value={selected.preview?.validRows ?? selected.validRows}
            />
            <Stat
              label="Попередження"
              value={selected.preview?.warningRows ?? selected.warningRows}
            />
            <Stat
              label="Помилки"
              value={selected.preview?.errorRows ?? selected.errorRows}
            />
            <Stat
              label="Нові позиції"
              value={selected.preview?.newItems ?? 0}
            />
            <Stat
              label="Пропущені"
              value={selected.preview?.skippedRows ?? selected.skippedRows}
            />
            <Stat
              label="Проведені"
              value={selected.preview?.importedRows ?? selected.importedRows}
            />
          </div>
          {(selected.preview?.errorRows ?? selected.errorRows) > 0 ||
          (selected.preview?.warningRows ?? selected.warningRows) > 0 ? (
            <Alert
              tone={
                (selected.preview?.errorRows ?? selected.errorRows) > 0
                  ? 'danger'
                  : 'warning'
              }
              title="Потрібна увага перед проведенням"
              message={`Помилки: ${
                selected.preview?.errorRows ?? selected.errorRows
              }. Попередження: ${
                selected.preview?.warningRows ?? selected.warningRows
              }.`}
            />
          ) : null}
          {missingCounterparties.length > 0 ? (
            <div className="grid gap-3 rounded-lg border border-amber-700/20 bg-amber-50/70 p-4">
              <div>
                <p className="text-sm font-semibold text-[var(--warning)]">
                  Зіставлення контрагентів із МВО
                </p>
                <p className="mt-1 text-sm text-amber-900/80">
                  Оберіть МВО для контрагентів, які не були знайдені автоматично.
                </p>
              </div>
              {missingCounterparties.map((counterparty) => (
                <div
                  key={counterparty}
                  className="grid gap-2 rounded-lg border border-amber-700/10 bg-white p-3 md:grid-cols-[1fr_1fr_auto]"
                >
                  <p className="break-words text-sm font-medium">
                    {counterparty}
                  </p>
                  <Select
                    value={mappings[counterparty]?.responsiblePersonId ?? ''}
                    onChange={(responsiblePersonId) =>
                      setMappings((current) => ({
                        ...current,
                        [counterparty]: {
                          responsiblePersonId,
                          save: current[counterparty]?.save ?? true,
                        },
                      }))
                    }
                  >
                    <option value="">Оберіть МВО</option>
                    {persons.map((person) => (
                      <option key={person.id} value={person.id}>
                        {fullName(person)} · {person.personnelNumber}
                      </option>
                    ))}
                  </Select>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      checked={mappings[counterparty]?.save ?? true}
                      type="checkbox"
                      onChange={(event) =>
                        setMappings((current) => ({
                          ...current,
                          [counterparty]: {
                            responsiblePersonId:
                              current[counterparty]?.responsiblePersonId ?? '',
                            save: event.target.checked,
                          },
                        }))
                      }
                    />
                    Зберегти
                  </label>
                </div>
              ))}
              <button
                className="btn btn-primary !w-fit"
                type="button"
                onClick={() => void saveMappings()}
              >
                Зберегти зіставлення
              </button>
            </div>
          ) : null}
          <div className="grid gap-2 md:grid-cols-3">
            <input
              className="input"
              placeholder="Пошук у рядках"
              value={rowFilters.search}
              onChange={(event) =>
                setRowFilters((current) => ({
                  ...current,
                  search: event.target.value,
                  page: 1,
                }))
              }
            />
            <Select
              value={rowFilters.status}
              onChange={(status) =>
                setRowFilters((current) => ({ ...current, status, page: 1 }))
              }
            >
              <option value="">Усі статуси</option>
              <option value="VALID">Валідні</option>
              <option value="WARNING">Попередження</option>
              <option value="ERROR">Помилки</option>
              <option value="SKIPPED">Пропущені</option>
              <option value="IMPORTED">Проведені</option>
            </Select>
            <button
              className="btn btn-outline"
              type="button"
              onClick={() => void refreshRowsWithFilters()}
            >
              Застосувати
            </button>
          </div>
          <SimpleTable
            headers={[
              '№',
              'Контрагент',
              'МВО',
              'Код',
              'Назва',
              'Од.',
              'Кількість',
              'Поточний',
              'Кінцевий файл',
              'Розбіжність',
              'Статус',
              'Повідомлення',
            ]}
            rows={rows.map((row) => [
              String(row.rowNumber),
              row.counterpartyRaw,
              row.responsiblePerson
                ? `${row.responsiblePerson.lastName} ${row.responsiblePerson.firstName}`
                : '-',
              row.nomenclatureCodeRaw,
              row.itemNameRaw,
              row.unitOfMeasureRaw ?? '-',
              row.parsedQuantity ?? '-',
              row.systemBalance ?? '-',
              row.fileEndingBalance ?? '-',
              row.balanceDifference ?? '-',
              row.status,
              row.message ?? '-',
            ])}
          />
          <PaginationControls
            page={rowPagination.page}
            totalPages={rowPagination.totalPages}
            total={rowPagination.total}
            onPage={(page) => {
              const next = { ...rowFilters, page };
              setRowFilters(next);
              void refreshRowsWithFilters(next);
            }}
          />
          <div className="flex flex-wrap gap-2">
            <button
              className="btn btn-outline"
              type="button"
              onClick={() => void validateSelected()}
            >
              Перевірити повторно
            </button>
            <button
              className="btn btn-primary"
              disabled={!canCommit}
              type="button"
              onClick={() => setConfirmOpen(true)}
            >
              Провести імпорт
            </button>
            <button
              className="btn btn-outline"
              disabled={selected.status === 'COMPLETED'}
              type="button"
              onClick={() => void cancelSelected()}
            >
              Скасувати імпорт
            </button>
          </div>
        </div>
      ) : null}
      {uploadOpen ? (
        <ImportUploadModal
          onClose={() => setUploadOpen(false)}
          onSaved={(batch) => {
            setUploadOpen(false);
            router.push(`/imports/${batch.id}`);
            void load();
            void loadImport(batch.id);
          }}
        />
      ) : null}
      {confirmOpen && selected ? (
        <Modal
          title="Підтвердити проведення імпорту"
          onClose={() => setConfirmOpen(false)}
        >
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Stat
                label="Нові позиції"
                value={selected.preview?.newItems ?? 0}
              />
              <Stat
                label="Операцій"
                value={
                  (selected.preview?.validRows ?? selected.validRows) +
                  (selected.preview?.warningRows ?? selected.warningRows)
                }
              />
              <Stat label="МВО" value={selected.preview?.matchedPersons ?? 0} />
              <Stat
                label="Попередження"
                value={selected.preview?.warningRows ?? selected.warningRows}
              />
              <Stat
                label="Пропущені"
                value={selected.preview?.skippedRows ?? selected.skippedRows}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="btn btn-outline"
                type="button"
                onClick={() => setConfirmOpen(false)}
              >
                Скасувати
              </button>
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => void commitSelected()}
              >
                Провести
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}

function ImportUploadModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (batch: ImportBatch) => void;
}) {
  const [importType, setImportType] = useState<ImportType>('INITIAL_BALANCE');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    setSaving(true);
    setError('');
    try {
      onSaved(await apiClient.uploadImport(file, importType));
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Новий імпорт" onClose={onClose}>
      <form className="grid gap-3" onSubmit={submit}>
        {error ? <ErrorMessage message={error} /> : null}
        <Field label="Режим">
          <Select
            value={importType}
            onChange={(value) => setImportType(value as ImportType)}
          >
            <option value="INITIAL_BALANCE">Початкові залишки</option>
            <option value="RECEIPT">Нові надходження</option>
          </Select>
        </Field>
        <p className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-sm text-[var(--text-secondary)]">
          {importType === 'INITIAL_BALANCE'
            ? 'Буде використано колонку «Кількість кін.»'
            : 'Буде використано колонку «Кількість Дт». Колонка «Кількість кін.» використовується лише для звірки.'}
        </p>
        <input
          required
          className="input"
          type="file"
          accept=".csv,.tsv"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        <FormActions saving={saving} onClose={onClose} />
      </form>
    </Modal>
  );
}

function TransactionsView() {
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await apiClient.stockTransactions({
        page: pagination.page,
        limit: pagination.limit,
      });
      setTransactions(response.items);
      setPagination(response.pagination);
    } catch (reason) {
      setError(getErrorMessage(reason));
    }
  }, [pagination.page, pagination.limit]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function handleToolbar(event: Event) {
      const detail = getToolbarDetail(event);
      if (detail?.view !== 'transactions') return;

      if (detail.action === 'refresh') {
        void load();
      }
    }

    window.addEventListener(TOOLBAR_EVENT, handleToolbar);
    return () => window.removeEventListener(TOOLBAR_EVENT, handleToolbar);
  }, [load]);

  return (
    <section className="grid gap-3">
      <PageHeader
        title="Журнал операцій"
        description="Операції із залишками доступні лише для перегляду."
      />
      {error ? <ErrorMessage message={error} /> : null}
      <SimpleTable
        headers={[
          'Дата',
          'Тип',
          'МВО',
          'Позиція',
          'Кількість',
          'Було',
          'Стало',
          'Джерело',
        ]}
        rows={transactions.map((item) => [
          new Date(item.occurredAt).toLocaleDateString('uk-UA'),
          item.type,
          item.responsiblePerson.fullName,
          item.inventoryItem.name,
          item.quantity,
          item.balanceBefore,
          item.balanceAfter,
          item.sourceDocument ?? '-',
        ])}
      />
      <PaginationControls
        page={pagination.page}
        totalPages={pagination.totalPages}
        total={pagination.total}
        onPage={(page) => setPagination((current) => ({ ...current, page }))}
      />
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-h-16 rounded border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2">
      <p className="truncate text-xs font-medium text-[var(--text-secondary)]">
        {label}
      </p>
      <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-[var(--primary)]">
        {value}
      </p>
    </div>
  );
}

function SimpleTable({
  headers,
  rows,
  onRowClick,
}: {
  headers: string[];
  rows: React.ReactNode[][];
  onRowClick?: (index: number) => void;
}) {
  if (rows.length === 0) {
    return <EmptyState message="Дані відсутні." />;
  }

  return (
    <div className="erp-panel overflow-hidden">
      <div className="compact-scrollbar max-h-[560px] overflow-auto">
        <table className="data-table">
          <thead>
            <tr>
              {headers.map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={`${row.map((cell) => String(cell)).join('-')}-${index}`}
                className={onRowClick ? 'cursor-pointer' : ''}
                onClick={() => onRowClick?.(index)}
              >
                {row.map((cell, cellIndex) => (
                  <td
                    key={`${String(cell)}-${cellIndex}`}
                    className="max-w-80 break-words"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-[var(--border)] bg-[var(--toolbar-background)] px-2 py-1 text-xs text-[var(--text-secondary)]">
        Записів у таблиці: {rows.length}
      </div>
    </div>
  );
}

function importTypeLabel(type: ImportType) {
  return type === 'INITIAL_BALANCE' ? 'Початкові залишки' : 'Надходження';
}

function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="erp-panel flex flex-col gap-2 border-l-4 border-l-[var(--primary)] px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
          {title}
        </h2>
        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}

function SectionTitle({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div>
      <h3 className="text-base font-semibold text-[var(--text-primary)]">
        {title}
      </h3>
      {description ? (
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-950/35 p-2 sm:p-4">
      <div className="mx-auto my-2 flex max-h-[calc(100vh-1rem)] w-full max-w-3xl flex-col rounded-md border border-[var(--border)] bg-white shadow-lg sm:my-6">
        <div className="flex h-10 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--toolbar-background)] px-3">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button
            aria-label="Закрити"
            className="btn btn-outline !min-h-7 !w-auto !px-2"
            type="button"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="compact-scrollbar min-h-0 overflow-y-auto p-3">
          {children}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1 text-[13px] font-medium text-[var(--text-primary)] sm:grid-cols-[150px_minmax(0,1fr)] sm:items-center">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Select({
  value,
  onChange,
  children,
  required,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <select
      className="input"
      required={required}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {children}
    </select>
  );
}

function FormActions({
  saving,
  onClose,
}: {
  saving: boolean;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col-reverse gap-2 border-t border-[var(--border)] bg-[var(--surface-muted)] px-0 pt-3 sm:flex-row sm:justify-end">
      <button
        className="btn btn-outline"
        type="button"
        onClick={onClose}
      >
        Скасувати
      </button>
      <button
        className="btn btn-primary"
        disabled={saving}
        type="submit"
      >
        {saving ? 'Збереження...' : 'Зберегти'}
      </button>
    </div>
  );
}

function PaginationControls({
  page,
  totalPages,
  total,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const canGoBack = page > 1;
  const canGoForward = totalPages > 0 && page < totalPages;

  return (
    <div className="erp-panel flex flex-col gap-2 bg-[var(--toolbar-background)] px-2 py-1.5 text-xs sm:flex-row sm:items-center sm:justify-between">
      <span className="text-[var(--text-secondary)]">
        Записів: {total}. Сторінка {page} з {totalPages || 1}
      </span>
      <div className="flex gap-2">
        <button
          className="btn btn-outline !w-auto"
          disabled={!canGoBack}
          type="button"
          onClick={() => onPage(page - 1)}
        >
          Назад
        </button>
        <button
          className="btn btn-outline !w-auto"
          disabled={!canGoForward}
          type="button"
          onClick={() => onPage(page + 1)}
        >
          Далі
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${
        active
          ? 'border-green-700/15 bg-green-50 text-[var(--success)]'
          : 'border-slate-200 bg-[var(--surface-muted)] text-[var(--text-secondary)]'
      }`}
    >
      {active ? 'Активний' : 'Неактивний'}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const tone =
    normalized.includes('error') || normalized.includes('failed')
      ? 'danger'
      : normalized.includes('warning') || normalized.includes('partial')
        ? 'warning'
        : normalized.includes('completed') || normalized.includes('valid')
          ? 'success'
          : normalized.includes('uploaded')
            ? 'info'
            : 'neutral';

  const toneClass = {
    success: 'border-green-700/15 bg-green-50 text-[var(--success)]',
    warning: 'border-amber-700/15 bg-amber-50 text-[var(--warning)]',
    danger: 'border-red-700/15 bg-red-50 text-[var(--danger)]',
    info: 'border-sky-700/15 bg-sky-50 text-[var(--info)]',
    neutral: 'border-slate-200 bg-[var(--surface-muted)] text-[var(--text-secondary)]',
  }[tone];

  return (
    <span
      className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClass}`}
    >
      {status}
    </span>
  );
}

function Alert({
  tone,
  title,
  message,
}: {
  tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  title: string;
  message: string;
}) {
  const toneClass = {
    success: 'border-green-700/15 bg-green-50 text-[var(--success)]',
    warning: 'border-amber-700/15 bg-amber-50 text-[var(--warning)]',
    danger: 'border-red-700/15 bg-red-50 text-[var(--danger)]',
    info: 'border-sky-700/15 bg-sky-50 text-[var(--info)]',
    neutral: 'border-slate-200 bg-[var(--surface-muted)] text-[var(--text-primary)]',
  }[tone];

  return (
    <div className={`rounded-lg border p-4 text-sm ${toneClass}`}>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 opacity-85">{message}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-medium text-[var(--text-secondary)]">{label}</dt>
      <dd className="break-words text-[var(--text-primary)]">{value}</dd>
    </div>
  );
}

function LoadingMessage() {
  return (
    <div className="app-card p-4 text-sm text-[var(--text-secondary)]">
      Завантаження даних...
    </div>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-700/15 bg-red-50 p-4 text-sm text-[var(--danger)]">
      <p className="font-semibold">Помилка</p>
      <p className="mt-1">{message}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="app-card p-6 text-center text-sm text-[var(--text-secondary)]">
      {message}
    </div>
  );
}

function fullName(person: ResponsiblePerson) {
  return [person.lastName, person.firstName, person.middleName]
    .filter(Boolean)
    .join(' ');
}

function normalizePersonForm(
  form: CreateResponsiblePersonDto,
): CreateResponsiblePersonDto {
  return {
    ...form,
    middleName: form.middleName || null,
    position: form.position || null,
    phone: form.phone || null,
    email: form.email || null,
    unitId: form.unitId || null,
    appointmentOrderNumber: form.appointmentOrderNumber || null,
    appointmentDate: form.appointmentDate || null,
  };
}

function getErrorMessage(reason: unknown) {
  if (reason instanceof ApiError) {
    return reason.message;
  }

  if (reason instanceof Error) {
    return reason.message;
  }

  return 'Сталася невідома помилка';
}
