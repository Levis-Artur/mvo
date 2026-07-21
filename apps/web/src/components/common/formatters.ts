import { ApiError } from '../../lib/api-client';
import type { CreateResponsiblePersonDto, ImportType, ResponsiblePerson, UserSummary } from '@/lib/types';

export function importTypeLabel(type: ImportType) {
  return type === 'INITIAL_BALANCE' ? 'Початкові залишки' : 'Надходження';
}

export function fullName(person: ResponsiblePerson) {
  return [person.lastName, person.firstName, person.middleName].filter(Boolean).join(' ');
}

export function responsiblePersonShortName(person: Pick<ResponsiblePerson, 'lastName' | 'firstName' | 'middleName' | 'personnelNumber'>) {
  return `${[person.lastName, person.firstName, person.middleName].filter(Boolean).join(' ')} · ${person.personnelNumber}`;
}

export function formatDateTime(value?: string | null) {
  if (!value) return 'Немає даних';
  return new Intl.DateTimeFormat('uk-UA', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function isUserLocked(user: UserSummary) {
  return user.lockedUntil ? new Date(user.lockedUntil) > new Date() : false;
}

export function normalizePersonForm(form: CreateResponsiblePersonDto): CreateResponsiblePersonDto {
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
  if (reason instanceof ApiError) return reason.message;
  if (reason instanceof Error && /[А-Яа-яІіЇїЄє]/.test(reason.message)) {
    return reason.message;
  }
  return 'Не вдалося виконати запит. Перевірте з’єднання із сервером.';
}

export function getMvoErrorMessage(reason: unknown) {
  const message = getErrorMessage(reason);
  const normalized = message.toLocaleLowerCase('uk-UA');

  if ((reason instanceof ApiError && reason.status === 403) || /forbidden|доступ заборонено/.test(normalized)) {
    return 'Ви не маєте доступу до цієї операції.';
  }
  if (/limit must not be greater than 100|limit.*100/.test(normalized)) {
    return 'Не вдалося завантажити дані. Натисніть «Оновити».';
  }
  if (/source balance not found|invalid sourcekind|assigned bucket unavailable|record not found/.test(normalized)) {
    return 'Ця позиція вже була змінена. Оновіть список і повторіть спробу.';
  }
  if (/insufficient|недостатн|exceed.*available|перевищ.*залиш/.test(normalized)) {
    return 'Недостатньо майна для цієї операції.';
  }
  if (/file.*too large|payload too large|maximum.*size|перевищ.*розмір/.test(normalized)) {
    return 'Файл накладної перевищує допустимий розмір.';
  }
  if (/attachment.*required|photo.*required|потрібно додати.*фото|без.*вкладенн/.test(normalized)) {
    return 'Спочатку додайте фото або PDF накладної.';
  }
  return message;
}

export { ApiError };
