import type {
  Management,
  ResponsiblePerson,
  Service,
  Unit,
  UserRole,
} from '@/lib/types';

export type OrgForm =
  | { type: 'management'; data?: Management }
  | { type: 'service'; managementId: string; data?: Service }
  | { type: 'unit'; serviceId: string; data?: Unit };

export function organizationRoleAccess(role?: UserRole) {
  return {
    readOnly: role === 'AUDITOR',
    canWrite: role === 'OWNER' || role === 'DPP_ADMIN',
    canDelete: role === 'OWNER',
  };
}

export function allOrganizationServices(managements: Management[]) {
  return managements.flatMap((management) => management.services ?? []);
}

export function peopleForManagement(
  people: ResponsiblePerson[],
  managementId: string,
) {
  return people.filter((person) => person.managementId === managementId);
}

export function peopleForService(people: ResponsiblePerson[], serviceId: string) {
  return people.filter((person) => person.serviceId === serviceId);
}

export function peopleForUnit(people: ResponsiblePerson[], unitId: string) {
  return people.filter((person) => person.unitId === unitId);
}

export function organizationSummary(
  managements: Management[],
  people: ResponsiblePerson[],
) {
  return managements.map((management) => ({
    id: management.id,
    services: management.services?.length ?? 0,
    units:
      management.services?.reduce(
        (total, service) => total + (service.units?.length ?? 0),
        0,
      ) ?? 0,
    people: peopleForManagement(people, management.id).length,
  }));
}

export function organizationFormError(reason: unknown) {
  return reason instanceof Error
    ? reason.message
    : 'Сталася невідома помилка під час збереження';
}

export async function refreshAfterOrganizationMutation(
  refresh: () => Promise<void> | void,
) {
  await refresh();
}
