import type { UserRole } from '@/lib/types';

export function shouldLoadGlobalResponsiblePersons(role: UserRole) {
  return role !== 'MVO';
}

export function canUseGlobalResponsiblePersonFilters(role: UserRole) {
  return role !== 'MVO';
}
