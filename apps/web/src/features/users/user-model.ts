import type { ResponsiblePerson, Service, UserRole, UserSummary } from '../../lib/types';

const baseServiceLabels: Record<string, string> = {
  IT: 'ІТ',
  MTZ: 'МТЗ',
  UATZ: 'УАТЗ',
};

const baseServiceOrder = ['IT', 'MTZ', 'UATZ'];

export function serviceCodeLabel(code: string) {
  return baseServiceLabels[code] ?? code;
}

export function serviceCodesForScope(
  services: Service[],
  managementId: string | null,
) {
  const uniqueCodes = [
    ...new Set(
      services
        .filter(
          (service) =>
            service.isActive &&
            (!managementId || service.managementId === managementId),
        )
        .map((service) => service.code),
    ),
  ];

  return uniqueCodes.sort((left, right) => {
    const leftIndex = baseServiceOrder.indexOf(left);
    const rightIndex = baseServiceOrder.indexOf(right);
    if (leftIndex >= 0 || rightIndex >= 0) {
      if (leftIndex < 0) return 1;
      if (rightIndex < 0) return -1;
      return leftIndex - rightIndex;
    }
    return left.localeCompare(right, 'uk-UA');
  });
}

export type UserUiAccess = { visible: boolean; readOnly: boolean; destructive: boolean };

export function userUiAccess(role: UserRole): UserUiAccess {
  if (role === 'OWNER') return { visible: true, readOnly: false, destructive: true };
  if (role === 'DPP_ADMIN') return { visible: true, readOnly: false, destructive: false };
  if (role === 'AUDITOR') return { visible: true, readOnly: true, destructive: false };
  return { visible: false, readOnly: true, destructive: false };
}

export function filterUsers(users: UserSummary[], search: string, role: string, status: string) {
  const normalized = search.trim().toLocaleLowerCase('uk-UA');
  return users.filter((user) => {
    const person = user.responsiblePerson;
    const text = [user.username, person?.externalAccountingCode, person?.personnelNumber, person?.lastName, person?.firstName, person?.middleName]
      .filter(Boolean).join(' ').toLocaleLowerCase('uk-UA');
    return (!normalized || text.includes(normalized)) && (!role || user.role === role) &&
      (!status || (status === 'active' ? user.isActive : !user.isActive));
  });
}

export function indexResponsiblePersons(persons: ResponsiblePerson[]) {
  return new Map(persons.map((person) => [person.id, person]));
}

export function safeUserPresentation(user: UserSummary) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    twoFactorEnabled: user.twoFactorEnabled,
    failedLoginAttempts: user.failedLoginAttempts,
    lockedUntil: user.lockedUntil,
    lastLoginAt: user.lastLoginAt ?? null,
    responsiblePersonId: user.responsiblePersonId,
  };
}
