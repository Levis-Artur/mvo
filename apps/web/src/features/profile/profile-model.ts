import type { AuthUser, ResponsiblePerson } from '../../lib/types';
import { roleLabels } from '../../lib/authz';

export function profilePresentation(user: AuthUser, person: ResponsiblePerson | null) {
  return {
    username: user.username,
    role: roleLabels[user.role],
    personnelNumber: person?.personnelNumber ?? 'Не визначено',
    fullName: person ? [person.lastName, person.firstName, person.middleName].filter(Boolean).join(' ') : 'Не визначено',
    responsiblePerson: person ? `${person.personnelNumber} — ${[person.lastName, person.firstName, person.middleName].filter(Boolean).join(' ')}` : 'Не прив’язано',
    management: person?.management.name ?? 'Не визначено',
    service: person?.service.name ?? 'Не визначено',
    unit: person?.unit?.name ?? 'Не визначено',
    accountState: user.isActive ? 'Активний' : 'Неактивний',
  };
}
