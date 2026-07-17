import type {
  ResponsiblePerson,
  ResponsiblePersonsQuery,
  Service,
  Unit,
  UserRole,
  UserSummary,
} from '@/lib/types';

export type PersonFilterDraft = Pick<
  ResponsiblePersonsQuery,
  'search' | 'managementId' | 'serviceId' | 'unitId' | 'isActive'
>;

export const EMPTY_PERSON_FILTERS: PersonFilterDraft = {};

export function applyPersonFilters(
  draft: PersonFilterDraft,
  limit: number,
): ResponsiblePersonsQuery {
  return {
    search: draft.search?.trim() || undefined,
    managementId: draft.managementId || undefined,
    serviceId: draft.serviceId || undefined,
    unitId: draft.unitId || undefined,
    isActive: draft.isActive,
    page: 1,
    limit,
  };
}

export function servicesForManagement(
  services: Service[],
  managementId?: string,
) {
  return managementId
    ? services.filter((service) => service.managementId === managementId)
    : services;
}

export function unitsForService(units: Unit[], serviceId?: string) {
  return serviceId
    ? units.filter((unit) => unit.serviceId === serviceId)
    : units;
}

export function usersByResponsiblePerson(users: UserSummary[]) {
  return new Map(
    users.flatMap((user) =>
      user.responsiblePersonId ? [[user.responsiblePersonId, user] as const] : [],
    ),
  );
}

export function personRoleAccess(role?: UserRole) {
  return {
    readOnly: role === 'AUDITOR',
    canWrite: role === 'OWNER' || role === 'DPP_ADMIN',
    canDelete: role === 'OWNER',
    canCreateAccount: role === 'OWNER' || role === 'DPP_ADMIN',
  };
}

export function personDisplayName(person: ResponsiblePerson) {
  return [person.lastName, person.firstName, person.middleName]
    .filter(Boolean)
    .join(' ');
}
