'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { organizationService as apiClient } from './organization.service';
import { useAuth } from '@/app/ui/auth-context';
import { can } from '@/lib/authz';
import type {
  AdminEntityType,
  Management,
  ResponsiblePerson,
  Service,
  Unit,
} from '@/lib/types';
import { getErrorMessage } from '@/components/common';
import { PageHeader } from '@/components/layout/page-header';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  Toast,
} from '@/components/ui';
import { fetchAllPages } from '@/lib/fetch-all-pages';
import { getToolbarDetail, TOOLBAR_EVENT } from '@/components/layout/toolbar-events';
import { DestructiveActionModal } from '@/features/admin/destructive-action-modal';
import { canShowDestructiveActions } from '@/features/admin/destructive-actions';
import { ADMIN_ENTITY_TYPES } from '@/features/admin/admin-entity-types';
import { PersonForm } from '@/features/responsible-persons/person-form';
import { OrganizationFormModal } from './organization-form-modal';
import { OrganizationHierarchy } from './organization-hierarchy';
import { organizationSummary, type OrgForm } from './organization-model';

export function StructureView() {
  const { user } = useAuth();
  const canWriteStructure = can(user, 'write', 'organization');
  const canDelete = canShowDestructiveActions(user?.role);
  const [managements, setManagements] = useState<Management[]>([]);
  const [people, setPeople] = useState<ResponsiblePerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [orgForm, setOrgForm] = useState<OrgForm | null>(null);
  const [personForm, setPersonForm] = useState<ResponsiblePerson | null>(null);
  const [deleting, setDeleting] = useState<{
    type: AdminEntityType;
    id: string;
  } | null>(null);
  const [toast, setToast] = useState('');

  const summary = useMemo(
    () => organizationSummary(managements, people),
    [managements, people],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [nextManagements, nextPeople] = await Promise.all([
        apiClient.managements(),
        fetchAllPages((pagination) =>
          apiClient.responsiblePersons({ ...pagination }),
        ),
      ]);
      setManagements(nextManagements);
      setPeople(nextPeople);
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
      if (detail.action === 'create-management' && canWriteStructure) {
        setOrgForm({ type: 'management' });
      }
      if (detail.action === 'refresh') void load();
    }
    window.addEventListener(TOOLBAR_EVENT, handleToolbar);
    return () => window.removeEventListener(TOOLBAR_EVENT, handleToolbar);
  }, [canWriteStructure, load]);

  const toggleStructure = useCallback(
    async (
      type: 'management' | 'service' | 'unit',
      entity: Management | Service | Unit,
    ) => {
      setError('');
      try {
        if (type === 'management') {
          await apiClient.updateManagement(entity.id, {
            isActive: !entity.isActive,
          });
        } else if (type === 'service') {
          await apiClient.updateService(entity.id, {
            isActive: !entity.isActive,
          });
        } else {
          await apiClient.updateUnit(entity.id, { isActive: !entity.isActive });
        }
        await load();
        setToast(entity.isActive ? 'Запис деактивовано.' : 'Запис активовано.');
      } catch (reason) {
        setError(getErrorMessage(reason));
      }
    },
    [load],
  );

  const togglePerson = useCallback(
    async (person: ResponsiblePerson) => {
      setError('');
      try {
        await apiClient.updateResponsiblePerson(person.id, {
          isActive: !person.isActive,
        });
        await load();
        setToast(person.isActive ? 'МВО деактивовано.' : 'МВО активовано.');
      } catch (reason) {
        setError(getErrorMessage(reason));
      }
    },
    [load],
  );

  const totalServices = summary.reduce((total, item) => total + item.services, 0);
  const totalUnits = summary.reduce((total, item) => total + item.units, 0);

  return (
    <section className="grid min-w-0 gap-4">
      <PageHeader
        action={
          <div className="flex flex-wrap gap-2">
            <Button icon="refresh" variant="outline" type="button" onClick={() => void load()}>
              Оновити
            </Button>
            {canWriteStructure ? (
              <Button type="button" onClick={() => setOrgForm({ type: 'management' })}>
                Створити управління
              </Button>
            ) : null}
          </div>
        }
        description="Управління, служби, підрозділи та закріплені МВО."
        icon="structure"
        title="Організаційна структура"
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card title="Управління">
          <p className="text-2xl font-bold">{managements.length}</p>
        </Card>
        <Card title="Служби">
          <p className="text-2xl font-bold">{totalServices}</p>
        </Card>
        <Card title="Підрозділи">
          <p className="text-2xl font-bold">{totalUnits}</p>
        </Card>
        <Card title="МВО">
          <p className="text-2xl font-bold">{people.length}</p>
        </Card>
      </div>

      {error ? <ErrorState message={error} /> : null}
      {loading ? <LoadingState label="Завантаження організаційної структури…" /> : null}
      {!loading && !error && managements.length === 0 ? (
        <EmptyState message="Організаційну структуру ще не створено." />
      ) : null}
      {!loading && managements.length ? (
        <OrganizationHierarchy
          canDelete={canDelete}
          canWrite={canWriteStructure}
          managements={managements}
          people={people}
          onDelete={(type, id) => setDeleting({ type, id })}
          onDeletePerson={(person) =>
            setDeleting({
              type: ADMIN_ENTITY_TYPES.responsiblePerson,
              id: person.id,
            })
          }
          onEdit={setOrgForm}
          onEditPerson={setPersonForm}
          onToggle={(type, entity) => void toggleStructure(type, entity)}
          onTogglePerson={(person) => void togglePerson(person)}
        />
      ) : null}

      {orgForm ? (
        <OrganizationFormModal
          form={orgForm}
          managements={managements}
          onClose={() => setOrgForm(null)}
          onSaved={() => {
            setOrgForm(null);
            void load();
          }}
        />
      ) : null}
      {personForm ? (
        <PersonForm
          person={personForm}
          onClose={() => setPersonForm(null)}
          onSaved={() => {
            setPersonForm(null);
            void load();
          }}
        />
      ) : null}
      {deleting ? (
        <DestructiveActionModal
          entityId={deleting.id}
          entityType={deleting.type}
          onClose={() => setDeleting(null)}
          onDeleted={async () => {
            await load();
            setToast('Запис структури видалено.');
          }}
        />
      ) : null}
      {toast ? <Toast message={toast} onClose={() => setToast('')} /> : null}
    </section>
  );
}
