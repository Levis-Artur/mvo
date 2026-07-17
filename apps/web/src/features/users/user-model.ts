import type { ResponsiblePerson, UserRole, UserSummary } from '../../lib/types';

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
    const text = [user.username, person?.personnelNumber, person?.lastName, person?.firstName, person?.middleName]
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
    failedLoginAttempts: user.failedLoginAttempts,
    lockedUntil: user.lockedUntil,
    lastLoginAt: user.lastLoginAt ?? null,
    responsiblePersonId: user.responsiblePersonId,
  };
}
