'use client';

import type {
  AdminEntityType,
  Management,
  ResponsiblePerson,
  Service,
  Unit,
} from '@/lib/types';
import { Button, Card, StatusBadge } from '@/components/ui';
import { ADMIN_ENTITY_TYPES } from '@/features/admin/admin-entity-types';
import { personDisplayName } from '@/features/responsible-persons/persons-model';
import {
  peopleForManagement,
  peopleForService,
  peopleForUnit,
  type OrgForm,
} from './organization-model';

function EntityActions({
  active,
  canDelete,
  canWrite,
  deleteLabel,
  onCreateChild,
  onDelete,
  onEdit,
  onToggle,
}: {
  active: boolean;
  canDelete: boolean;
  canWrite: boolean;
  deleteLabel: string;
  onCreateChild?: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onToggle: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {canWrite ? (
        <>
          <Button variant="ghost" type="button" onClick={onEdit}>
            Редагувати
          </Button>
          <Button variant="outline" type="button" onClick={onToggle}>
            {active ? 'Деактивувати' : 'Активувати'}
          </Button>
          {onCreateChild ? (
            <Button variant="outline" type="button" onClick={onCreateChild}>
              Створити дочірній елемент
            </Button>
          ) : null}
        </>
      ) : null}
      {canDelete ? (
        <Button variant="danger" type="button" onClick={onDelete}>
          {deleteLabel}
        </Button>
      ) : null}
    </div>
  );
}

function UnitSection({
  unit,
  people,
  canWrite,
  canDelete,
  onEdit,
  onToggle,
  onDelete,
  onEditPerson,
  onTogglePerson,
  onDeletePerson,
}: {
  unit: Unit;
  people: ResponsiblePerson[];
  canWrite: boolean;
  canDelete: boolean;
  onEdit: (form: OrgForm) => void;
  onToggle: (type: 'unit', entity: Unit) => void;
  onDelete: (type: AdminEntityType, id: string) => void;
  onEditPerson: (person: ResponsiblePerson) => void;
  onTogglePerson: (person: ResponsiblePerson) => void;
  onDeletePerson: (person: ResponsiblePerson) => void;
}) {
  const unitPeople = peopleForUnit(people, unit.id);
  return (
    <details className="organization-node" open>
      <summary>
        <span className="min-w-0">
          <strong>{unit.name}</strong>{' '}
          <span className="font-mono text-xs text-[var(--color-text-secondary)]">
            {unit.code}
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-2">
          <span>{unitPeople.length} МВО</span>
          <StatusBadge tone={unit.isActive ? 'success' : 'neutral'}>
            {unit.isActive ? 'Активний' : 'Неактивний'}
          </StatusBadge>
        </span>
      </summary>
      <div className="organization-node__body">
        <EntityActions
          active={unit.isActive}
          canDelete={canDelete}
          canWrite={canWrite}
          deleteLabel="Видалити підрозділ"
          onDelete={() => onDelete(ADMIN_ENTITY_TYPES.unit, unit.id)}
          onEdit={() => onEdit({ type: 'unit', serviceId: unit.serviceId, data: unit })}
          onToggle={() => onToggle('unit', unit)}
        />
        {unitPeople.length ? (
          <ul className="organization-people">
            {unitPeople.map((person) => (
              <li key={person.id}>
                <span>
                  <strong>{person.personnelNumber}</strong> — {personDisplayName(person)}
                </span>
                <span className="flex flex-wrap gap-1">
                  <StatusBadge tone={person.isActive ? 'success' : 'neutral'}>
                    {person.isActive ? 'Активний' : 'Неактивний'}
                  </StatusBadge>
                  {canWrite ? (
                    <>
                      <Button variant="ghost" type="button" onClick={() => onEditPerson(person)}>
                        Редагувати
                      </Button>
                      <Button variant="outline" type="button" onClick={() => onTogglePerson(person)}>
                        {person.isActive ? 'Деактивувати' : 'Активувати'}
                      </Button>
                    </>
                  ) : null}
                  {canDelete ? (
                    <Button variant="danger" type="button" onClick={() => onDeletePerson(person)}>
                      Видалити
                    </Button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--color-text-secondary)]">
            У підрозділі немає МВО.
          </p>
        )}
      </div>
    </details>
  );
}

function ServiceSection({
  service,
  people,
  canWrite,
  canDelete,
  onEdit,
  onToggle,
  onDelete,
  onEditPerson,
  onTogglePerson,
  onDeletePerson,
}: {
  service: Service;
  people: ResponsiblePerson[];
  canWrite: boolean;
  canDelete: boolean;
  onEdit: (form: OrgForm) => void;
  onToggle: (type: 'service' | 'unit', entity: Service | Unit) => void;
  onDelete: (type: AdminEntityType, id: string) => void;
  onEditPerson: (person: ResponsiblePerson) => void;
  onTogglePerson: (person: ResponsiblePerson) => void;
  onDeletePerson: (person: ResponsiblePerson) => void;
}) {
  const servicePeople = peopleForService(people, service.id);
  const withoutUnit = servicePeople.filter((person) => !person.unitId);
  return (
    <details className="organization-node" open>
      <summary>
        <span className="min-w-0">
          <strong>{service.name}</strong>{' '}
          <span className="font-mono text-xs text-[var(--color-text-secondary)]">
            {service.code}
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-2">
          <span>{service.units?.length ?? 0} підрозділів</span>
          <span>{servicePeople.length} МВО</span>
          <StatusBadge tone={service.isActive ? 'success' : 'neutral'}>
            {service.isActive ? 'Активна' : 'Неактивна'}
          </StatusBadge>
        </span>
      </summary>
      <div className="organization-node__body">
        <EntityActions
          active={service.isActive}
          canDelete={canDelete}
          canWrite={canWrite}
          deleteLabel="Видалити службу"
          onCreateChild={() => onEdit({ type: 'unit', serviceId: service.id })}
          onDelete={() => onDelete(ADMIN_ENTITY_TYPES.service, service.id)}
          onEdit={() =>
            onEdit({
              type: 'service',
              managementId: service.managementId,
              data: service,
            })
          }
          onToggle={() => onToggle('service', service)}
        />
        {withoutUnit.length ? (
          <div className="organization-unassigned">
            <strong>МВО без підрозділу</strong>
            {withoutUnit.map((person) => (
              <span key={person.id}>
                {person.personnelNumber} — {personDisplayName(person)}
              </span>
            ))}
          </div>
        ) : null}
        <div className="grid gap-2">
          {(service.units ?? []).map((unit) => (
            <UnitSection
              key={unit.id}
              canDelete={canDelete}
              canWrite={canWrite}
              people={people}
              unit={unit}
              onDelete={onDelete}
              onDeletePerson={onDeletePerson}
              onEdit={onEdit}
              onEditPerson={onEditPerson}
              onToggle={onToggle}
              onTogglePerson={onTogglePerson}
            />
          ))}
        </div>
      </div>
    </details>
  );
}

export function OrganizationHierarchy({
  managements,
  people,
  canWrite,
  canDelete,
  onEdit,
  onToggle,
  onDelete,
  onEditPerson,
  onTogglePerson,
  onDeletePerson,
}: {
  managements: Management[];
  people: ResponsiblePerson[];
  canWrite: boolean;
  canDelete: boolean;
  onEdit: (form: OrgForm) => void;
  onToggle: (
    type: 'management' | 'service' | 'unit',
    entity: Management | Service | Unit,
  ) => void;
  onDelete: (type: AdminEntityType, id: string) => void;
  onEditPerson: (person: ResponsiblePerson) => void;
  onTogglePerson: (person: ResponsiblePerson) => void;
  onDeletePerson: (person: ResponsiblePerson) => void;
}) {
  return (
    <div className="grid min-w-0 gap-3">
      {managements.map((management) => {
        const managementPeople = peopleForManagement(people, management.id);
        return (
          <Card key={management.id} title={management.name}>
            <div className="grid gap-3">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-mono">{management.code}</span>
                  <span>{management.services?.length ?? 0} служб</span>
                  <span>{managementPeople.length} МВО</span>
                  <StatusBadge tone={management.isActive ? 'success' : 'neutral'}>
                    {management.isActive ? 'Активне' : 'Неактивне'}
                  </StatusBadge>
                </div>
                <EntityActions
                  active={management.isActive}
                  canDelete={canDelete}
                  canWrite={canWrite}
                  deleteLabel="Видалити управління"
                  onCreateChild={() =>
                    onEdit({ type: 'service', managementId: management.id })
                  }
                  onDelete={() =>
                    onDelete(ADMIN_ENTITY_TYPES.management, management.id)
                  }
                  onEdit={() =>
                    onEdit({ type: 'management', data: management })
                  }
                  onToggle={() => onToggle('management', management)}
                />
              </div>
              <div className="grid gap-2">
                {(management.services ?? []).map((service) => (
                  <ServiceSection
                    key={service.id}
                    canDelete={canDelete}
                    canWrite={canWrite}
                    people={people}
                    service={service}
                    onDelete={onDelete}
                    onDeletePerson={onDeletePerson}
                    onEdit={onEdit}
                    onEditPerson={onEditPerson}
                    onToggle={onToggle}
                    onTogglePerson={onTogglePerson}
                  />
                ))}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
