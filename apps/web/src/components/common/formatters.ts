import { ApiError } from '@/lib/api-client';
import type { CreateResponsiblePersonDto, ImportType, ResponsiblePerson, UserSummary } from '@/lib/types';

export function importTypeLabel(type: ImportType) {
  return type === 'INITIAL_BALANCE' ? 'РџРѕС‡Р°С‚РєРѕРІС– Р·Р°Р»РёС€РєРё' : 'РќР°РґС…РѕРґР¶РµРЅРЅСЏ';
}

export function fullName(person: ResponsiblePerson) {
  return [person.lastName, person.firstName, person.middleName]
    .filter(Boolean)
    .join(' ');
}

export function responsiblePersonShortName(
  person: Pick<
    ResponsiblePerson,
    'lastName' | 'firstName' | 'middleName' | 'personnelNumber'
  >,
) {
  return `${[person.lastName, person.firstName, person.middleName]
    .filter(Boolean)
    .join(' ')} В· ${person.personnelNumber}`;
}

export function formatDateTime(value?: string | null) {
  if (!value) {
    return 'РќРµРјР°С” РґР°РЅРёС…';
  }

  return new Intl.DateTimeFormat('uk-UA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function isUserLocked(user: UserSummary) {
  return user.lockedUntil ? new Date(user.lockedUntil) > new Date() : false;
}

export function normalizePersonForm(
  form: CreateResponsiblePersonDto,
): CreateResponsiblePersonDto {
  return {
    ...form,
    middleName: form.middleName || null,
    position: form.position || null,
    phone: form.phone || null,
    email: form.email || null,
    unitId: form.unitId || null,
    appointmentOrderNumber: form.appointmentOrderNumber || null,
    appointmentDate: form.appointmentDate || null,
  };
}

export function getErrorMessage(reason: unknown) {
  if (reason instanceof ApiError) {
    return reason.message;
  }

  if (reason instanceof Error) {
    return reason.message;
  }

  return 'РЎС‚Р°Р»Р°СЃСЏ РЅРµРІС–РґРѕРјР° РїРѕРјРёР»РєР°';
}

export { ApiError };


