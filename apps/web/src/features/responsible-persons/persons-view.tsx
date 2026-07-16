'use client';

import { useCallback, useEffect, useState } from 'react';
import { responsiblePersonsService as apiClient } from './responsible-persons.service';
import { useAuth } from '@/app/ui/auth-context';
import { can } from '@/lib/authz';
import type { Management, ResponsiblePerson, ResponsiblePersonsQuery, Service } from '@/lib/types';
import {
  ErrorMessage,
  LoadingMessage,
  PageHeader,
  PaginationControls,
  Select,
  Toast,
  getErrorMessage,
} from '@/components/common';
import { getToolbarDetail, TOOLBAR_EVENT } from '@/components/layout/toolbar-events';


import { PersonsTable } from './persons-table';
import { CreateMvoAccountModal } from './create-mvo-account-modal';
import { PersonForm } from './person-form';
import { DestructiveActionModal } from '@/features/admin/destructive-action-modal';
import { canShowDestructiveActions } from '@/features/admin/destructive-actions';
import { ADMIN_ENTITY_TYPES } from '@/features/admin/admin-entity-types';

export function PersonsView() {
  const { user } = useAuth();
  const canWritePersons = can(user, 'write', 'responsiblePersons');
  const canCreateMvoUser =
    can(user, 'write', 'users') || can(user, 'write', 'mvoUsers');
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
  const [accountPerson, setAccountPerson] = useState<ResponsiblePerson | null>(
    null,
  );
  const [isFormOpen, setFormOpen] = useState(false);
  const [deletingPerson, setDeletingPerson] = useState<ResponsiblePerson | null>(null);
  const [toast, setToast] = useState('');
  const canDelete = canShowDestructiveActions(user?.role);

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

      if (detail.action === 'create' && canWritePersons) {
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
  }, [canWritePersons, loadFilters, loadPersons]);

  return (
    <section className="grid gap-3">
      <PageHeader
        title="МВО"
        description="Реєстр матеріально відповідальних осіб."
        action={
          canWritePersons ? (
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
          ) : undefined
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
          canDelete={canDelete}
          persons={persons}
          canEdit={canWritePersons}
          canCreateAccount={canCreateMvoUser}
          onEdit={(person) => {
            setEditingPerson(person);
            setFormOpen(true);
          }}
          onCreateAccount={setAccountPerson}
          onDelete={setDeletingPerson}
          onDeactivate={(person) => {
            void apiClient
              .updateResponsiblePerson(person.id, { isActive: false })
              .then(loadPersons)
              .then(() => setToast('МВО деактивовано.'))
              .catch((reason: unknown) => setError(getErrorMessage(reason)));
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
      {accountPerson ? (
        <CreateMvoAccountModal
          person={accountPerson}
          onClose={() => setAccountPerson(null)}
        />
      ) : null}
      {deletingPerson ? (
        <DestructiveActionModal
          entityType={ADMIN_ENTITY_TYPES.responsiblePerson}
          entityId={deletingPerson.id}
          onClose={() => setDeletingPerson(null)}
          onDeleted={async () => {
            await loadPersons();
            setToast('МВО видалено.');
          }}
        />
      ) : null}
      {toast ? <Toast message={toast} onClose={() => setToast('')} /> : null}
    </section>
  );
}


