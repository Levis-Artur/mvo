import type {
  InventoryItem,
  InventoryItemsQuery,
  UserRole,
} from '@/lib/types';

export type InventoryFilterDraft = {
  search: string;
  reviewStatus: '' | 'VERIFIED' | 'NEEDS_REVIEW';
  isActive: '' | 'true' | 'false';
};

export const EMPTY_INVENTORY_FILTERS: InventoryFilterDraft = {
  search: '',
  reviewStatus: '',
  isActive: '',
};

export function inventoryQueryFromFilters(
  filters: InventoryFilterDraft,
  page: number,
  limit: number,
): InventoryItemsQuery {
  return {
    search: filters.search.trim() || undefined,
    reviewStatus: filters.reviewStatus || undefined,
    isActive:
      filters.isActive === '' ? undefined : filters.isActive === 'true',
    page,
    limit: Math.min(100, limit),
  };
}

export function inventoryItemStatuses(item: InventoryItem) {
  return {
    active: item.isActive ? 'Активна' : 'Архівна',
    needsReview:
      item.reviewStatus === 'NEEDS_REVIEW'
        ? 'Потребує перевірки'
        : 'Перевірена',
    used: (item.responsiblePersonsCount ?? 0) > 0,
  };
}

export function inventoryRoleAccess(role?: UserRole) {
  return {
    canWrite: role === 'OWNER' || role === 'DPP_ADMIN',
    canDelete: role === 'OWNER',
  };
}

export function inventoryViewState(
  loading: boolean,
  error: string,
  itemCount: number,
) {
  if (loading) return 'loading';
  if (error) return 'error';
  if (itemCount === 0) return 'empty';
  return 'rows';
}
