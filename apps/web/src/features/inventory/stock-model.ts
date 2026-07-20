import type {
  StockBalance,
  StockBalancesQuery,
  UserRole,
} from '@/lib/types';
import { addQuantities, isPositiveQuantity } from './quantity-format';

export type StockFilterDraft = Omit<
  StockBalancesQuery,
  'page' | 'limit'
> & { onlyProblematic?: boolean };

export const DEFAULT_STOCK_FILTERS: StockFilterDraft = {
  onlyPositive: true,
  onlyProblematic: false,
};

export function stockQueryFromFilters(
  filters: StockFilterDraft,
  forcedResponsiblePersonId?: string,
): StockBalancesQuery {
  return {
    search: filters.search?.trim() || undefined,
    managementId: filters.managementId || undefined,
    serviceId: filters.serviceId || undefined,
    unitId: filters.unitId || undefined,
    responsiblePersonId:
      forcedResponsiblePersonId || filters.responsiblePersonId || undefined,
    inventoryItemId: filters.inventoryItemId || undefined,
    // Backend legacy `onlyPositive` currently checks only the direct bucket.
    // Fetch all owner rows and apply positivity to totalAccountedQuantity below,
    // so a fully assigned position is not hidden.
    onlyPositive: false,
  };
}

export function filterProblematicBalances(
  balances: StockBalance[],
  onlyProblematic?: boolean,
) {
  return onlyProblematic
    ? balances.filter((balance) => !isPositiveQuantity(balance.totalAccountedQuantity ?? balance.quantity))
    : balances;
}

export function filterVisibleBalances(
  balances: StockBalance[],
  filters: Pick<StockFilterDraft, 'onlyPositive' | 'onlyProblematic'>,
) {
  if (filters.onlyProblematic) return filterProblematicBalances(balances, true);
  if (filters.onlyPositive) {
    return balances.filter((balance) =>
      isPositiveQuantity(balance.totalAccountedQuantity ?? balance.quantity),
    );
  }
  return balances;
}

export function paginateBalances(
  balances: StockBalance[],
  page: number,
  limit: number,
) {
  const safeLimit = Math.min(100, Math.max(1, limit));
  const totalPages = Math.ceil(balances.length / safeLimit);
  const safePage = Math.min(Math.max(1, page), Math.max(1, totalPages));
  return {
    items: balances.slice((safePage - 1) * safeLimit, safePage * safeLimit),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: balances.length,
      totalPages,
    },
  };
}

export function stockSummary(balances: StockBalance[]) {
  const positive = balances.filter((balance) =>
    isPositiveQuantity(balance.quantity),
  );
  const updatedAt = balances.reduce<string | null>(
    (latest, balance) =>
      !latest || balance.updatedAt > latest ? balance.updatedAt : latest,
    null,
  );
  return {
    responsiblePersons: new Set(
      positive.map((balance) => balance.responsiblePerson.id),
    ).size,
    positions: new Set(balances.map((balance) => balance.inventoryItem.id)).size,
    totalQuantity: addQuantities(balances.map((balance) => balance.totalAccountedQuantity ?? balance.quantity)),
    problematic: balances.length - positive.length,
    updatedAt,
  };
}

export function stockScope(
  role: UserRole,
  ownResponsiblePersonId: string | null,
  selectedResponsiblePersonId?: string,
) {
  return role === 'MVO'
    ? ownResponsiblePersonId ?? '__no_mvo_person__'
    : selectedResponsiblePersonId;
}

export function mvoStockActionLinks(responsiblePersonId: string) {
  const source = encodeURIComponent(responsiblePersonId);
  return {
    transfer: `/transfers?create=ASSIGNMENT&sourceResponsiblePersonId=${source}`,
    issue: `/transfers?create=ISSUE&sourceResponsiblePersonId=${source}`,
  };
}

export function allowsDirectBalanceEditing() {
  return false;
}
