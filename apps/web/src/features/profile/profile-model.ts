import type { AuthUser, ResponsiblePerson } from '../../lib/types';
import { roleLabels } from '../../lib/authz';

export function profilePresentation(user: AuthUser, person: ResponsiblePerson | null) {
  return {
    username: user.username,
    role: roleLabels[user.role],
    responsiblePerson: person ? `${person.personnelNumber} — ${[person.lastName, person.firstName, person.middleName].filter(Boolean).join(' ')}` : 'Не прив’язано',
    management: person?.management.name ?? 'Не визначено',
    service: person?.service.name ?? 'Не визначено',
    unit: person?.unit?.name ?? 'Не визначено',
  };
}
