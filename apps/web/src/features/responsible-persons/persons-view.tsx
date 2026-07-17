'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { responsiblePersonsService as apiClient } from './responsible-persons.service';
import { useAuth } from '@/app/ui/auth-context';
import { can } from '@/lib/authz';
import type {
  Management,
  ResponsiblePerson,
  ResponsiblePersonsQuery,
  Service,
  Unit,
  UserSummary,
} from '@/lib/types';
import { getErrorMessage } from '@/components/common';
import { PageHeader } from '@/components/layout/page-header';
import {
  Button,
  ErrorState,
  FilterBar,
  Pagination,
  Select,
  Toast,
} from '@/components/ui';
import { getToolbarDetail, TOOLBAR_EVENT } from '@/components/layout/toolbar-events';
import { PersonsTable } from './persons-table';
import { CreateMvoAccountModal } from './create-mvo-account-modal';
import { PersonForm } from './person-form';
import { PersonDetailsModal } from './person-details-modal';
import { DestructiveActionModal } from '@/features/admin/destructive-action-modal';
import { canShowDestructiveActions } from '@/features/admin/destructive-actions';
import { ADMIN_ENTITY_TYPES } from '@/features/admin/admin-entity-types';
import {
  applyPersonFilters,
  EMPTY_PERSON_FILTERS,
  servicesForManagement,
  unitsForService,
  usersByResponsiblePerson,
  type PersonFilterDraft,
} from './persons-model';

const INITIAL_QUERY: ResponsiblePersonsQuery = { page: 1, limit: 20 };

export function PersonsView() {
  const { user } = useAuth();
  const canWritePersons = can(user, 'write', 'responsiblePersons');
  const canCreateMvoUser =
    can(user, 'write', 'users') || can(user, 'write', 'mvoUsers');
  const canDelete = canShowDestructiveActions(user?.role);

  const [managements, setManagements] = useState<Management[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [persons, setPersons] = useState<ResponsiblePerson[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [accountsAvailable, setAccountsAvailable] = useState(false);
  const [stockPresence, setStockPresence] = useState<Record<string, boolean>>({});
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [filters, setFilters] = useState<ResponsiblePersonsQuery>(INITIAL_QUERY);
  const [draftFilters, setDraftFilters] =
    useState<PersonFilterDraft>(EMPTY_PERSON_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingPerson, setEditingPerson] = useState<ResponsiblePerson | null>(null);
  const [detailsPerson, setDetailsPerson] = useState<ResponsiblePerson | null>(null);
  const [accountPerson, setAccountPerson] = useState<ResponsiblePerson | null>(null);
  const [isFormOpen, setFormOpen] = useState(false);
  const [deletingPerson, setDeletingPerson] = useState<ResponsiblePerson | null>(null);
  const [toast, setToast] = useState('');

  const accounts = useMemo(() => usersByResponsiblePerson(users), [users]);
  const visibleServices = useMemo(
    () => servicesForManagement(services, draftFilters.managementId),
    [draftFilters.managementId, services],
  );
  const visibleUnits = useMemo(
    () => unitsForService(units, draftFilters.serviceId),
    [draftFilters.serviceId, units],
  );

  const loadReferenceData = useCallback(async () => {
    try {
      const [nextManagements, nextServices, nextUnits] = await Promise.all([
        apiClient.managements(),
        apiClient.services(),
        apiClient.units(),
      ]);
      setManagements(nextManagements);
      setServices(nextServices);
      setUnits(nextUnits);
    } catch (reason) {
      setError(getErrorMessage(reason));
    }
  }, []);

  const loadAccounts = useCallback(async () => {
    if (!canCreateMvoUser) {
      setAccountsAvailable(false);
      return;
    }
    try {
      setUsers(await apiClient.users());
      setAccountsAvailable(true);
    } catch {
      setAccountsAvailable(false);
    }
  }, [canCreateMvoUser]);

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

  const refresh = useCallback(async () => {
    await Promise.all([loadReferenceData(), loadAccounts(), loadPersons()]);
  }, [loadAccounts, loadPersons, loadReferenceData]);

  useEffect(() => {
    void loadReferenceData();
    void loadAccounts();
  }, [loadAccounts, loadReferenceData]);

  useEffect(() => {
    void loadPersons();
  }, [loadPersons]);

  useEffect(() => {
    function handleToolbar(event: Event) {
      const detail = getToolbarDetail(event);
      if (detail?.view !== 'persons') return;
      if (detail.action === 'create' && canWritePersons) {
        setEditingPerson(null);
        setFormOpen(true);
      }
      if (detail.action === 'refresh') void refresh();
    }
    window.addEventListener(TOOLBAR_EVENT, handleToolbar);
    return () => window.removeEventListener(TOOLBAR_EVENT, handleToolbar);
  }, [canWritePersons, refresh]);

  const toggleActive = useCallback(
    async (person: ResponsiblePerson) => {
      setError('');
      try {
        await apiClient.updateResponsiblePerson(person.id, {
          isActive: !person.isActive,
        });
        await loadPersons();
        setToast(person.isActive ? 'МВО деактивовано.' : 'МВО активовано.');
      } catch (reason) {
        setError(getErrorMessage(reason));
      }
    },
    [loadPersons],
  );

  function openEdit(person: ResponsiblePerson) {
    setDetailsPerson(null);
    setEditingPerson(person);
    setFormOpen(true);
  }

  return (
    <section className="grid min-w-0 gap-4">
      <PageHeader
        action={
          <div className="flex flex-wrap gap-2">
            <Button icon="refresh" variant="outline" type="button" onClick={() => void refresh()}>
              Оновити
            </Button>
            {canWritePersons ? (
              <Button
                type="button"
                onClick={() => {
                  setEditingPerson(null);
                  setFormOpen(true);
                }}
              >
                Додати МВО
              </Button>
            ) : null}
          </div>
        }
        description="Реєстр матеріально відповідальних осіб та їх організаційна належність."
        icon="people"
        title="МВО"
      />

      <FilterBar
        loading={loading}
        search={draftFilters.search ?? ''}
        onApply={() =>
          setFilters(applyPersonFilters(draftFilters, pagination.limit))
        }
        onRefresh={() => void refresh()}
        onReset={() => {
          setDraftFilters(EMPTY_PERSON_FILTERS);
          setFilters({ page: 1, limit: pagination.limit });
        }}
        onSearchChange={(search) =>
          setDraftFilters((current) => ({ ...current, search }))
        }
      >
        <label className="filter-bar__field">
          <span>Управління</span>
          <Select
            value={draftFilters.managementId ?? ''}
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                managementId: event.target.value || undefined,
                serviceId: undefined,
                unitId: undefined,
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
        </label>
        <label className="filter-bar__field">
          <span>Служба</span>
          <Select
            value={draftFilters.serviceId ?? ''}
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                serviceId: event.target.value || undefined,
                unitId: undefined,
              }))
            }
          >
            <option value="">Усі служби</option>
            {visibleServices.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="filter-bar__field">
          <span>Підрозділ</span>
          <Select
            value={draftFilters.unitId ?? ''}
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                unitId: event.target.value || undefined,
              }))
            }
          >
            <option value="">Усі підрозділи</option>
            {visibleUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="filter-bar__field">
          <span>Активність</span>
          <Select
            value={
              draftFilters.isActive === undefined
                ? ''
                : String(draftFilters.isActive)
            }
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                isActive:
                  event.target.value === ''
                    ? undefined
                    : event.target.value === 'true',
              }))
            }
          >
            <option value="">Усі статуси</option>
            <option value="true">Активні</option>
            <option value="false">Неактивні</option>
          </Select>
        </label>
      </FilterBar>

      {error ? <ErrorState message={error} /> : null}
      <PersonsTable
        accounts={accounts}
        accountsAvailable={accountsAvailable}
        canCreateAccount={canCreateMvoUser}
        canDelete={canDelete}
        canEdit={canWritePersons}
        loading={loading}
        persons={persons}
        stockPresence={stockPresence}
        onCreateAccount={setAccountPerson}
        onDelete={setDeletingPerson}
        onEdit={openEdit}
        onToggleActive={(person) => void toggleActive(person)}
        onView={setDetailsPerson}
      />
      <Pagination
        limit={pagination.limit}
        page={pagination.page}
        total={pagination.total}
        totalPages={pagination.totalPages}
        onLimitChange={(limit) =>
          setFilters((current) => ({ ...current, limit, page: 1 }))
        }
        onPage={(page) => setFilters((current) => ({ ...current, page }))}
      />

      {detailsPerson ? (
        <PersonDetailsModal
          account={accounts.get(detailsPerson.id)}
          accountLookupAvailable={accountsAvailable}
          canCreateAccount={canCreateMvoUser}
          canDelete={canDelete}
          canEdit={canWritePersons}
          person={detailsPerson}
          onClose={() => setDetailsPerson(null)}
          onCreateAccount={() => {
            setDetailsPerson(null);
            setAccountPerson(detailsPerson);
          }}
          onDelete={() => {
            setDetailsPerson(null);
            setDeletingPerson(detailsPerson);
          }}
          onEdit={() => openEdit(detailsPerson)}
          onStockPresence={(personId, hasStock) =>
            setStockPresence((current) => ({ ...current, [personId]: hasStock }))
          }
          onToggleActive={() => {
            setDetailsPerson(null);
            void toggleActive(detailsPerson);
          }}
        />
      ) : null}
      {isFormOpen ? (
        <PersonForm
          person={editingPerson}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            void refresh();
          }}
        />
      ) : null}
      {accountPerson ? (
        <CreateMvoAccountModal
          person={accountPerson}
          onClose={() => {
            setAccountPerson(null);
            void loadAccounts();
          }}
        />
      ) : null}
      {deletingPerson ? (
        <DestructiveActionModal
          entityId={deletingPerson.id}
          entityType={ADMIN_ENTITY_TYPES.responsiblePerson}
          onClose={() => setDeletingPerson(null)}
          onDeleted={async () => {
            await loadPersons();
            setToast('МВО видалено.');
          }}
        />
      ) : null}
      {toast ? (
        <Toast message={toast} onClose={() => setToast('')} />
      ) : null}
    </section>
  );
}
