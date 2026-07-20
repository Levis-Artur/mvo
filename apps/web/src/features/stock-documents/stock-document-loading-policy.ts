import type { StockDocumentType, UserRole } from '@/lib/types';

export function shouldLoadGlobalResponsiblePersons(role: UserRole) {
  return role !== 'MVO';
}

export function canUseGlobalResponsiblePersonFilters(role: UserRole) {
  return role !== 'MVO';
}

export function formLoadPolicy(type: StockDocumentType) {
  return {
    transferTargets: type === 'ASSIGNMENT',
    availableSources: type === 'ASSIGNMENT' || type === 'ISSUE',
  };
}
