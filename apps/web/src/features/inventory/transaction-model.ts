import type { StockTransaction, StockTransactionsQuery, StockTransactionType } from '@/lib/types';

export type TransactionFilterDraft = {
  dateFrom: string;
  dateTo: string;
  type: '' | StockTransactionType;
  responsiblePersonId: string;
  inventoryItemId: string;
  document: string;
  user: string;
  status: '' | 'POSTED';
};

export const DEFAULT_TRANSACTION_FILTERS: TransactionFilterDraft = {
  dateFrom: '', dateTo: '', type: '', responsiblePersonId: '',
  inventoryItemId: '', document: '', user: '', status: '',
};

const labels: Record<StockTransactionType, string> = {
  INITIAL_BALANCE: 'Початковий залишок',
  RECEIPT: 'Надходження',
  MANUAL_RECEIPT: 'Ручне надходження',
  ADJUSTMENT_INCREASE: 'Коригування: збільшення',
  ADJUSTMENT_DECREASE: 'Коригування: зменшення',
};

export const transactionTypeLabel = (type: StockTransactionType) => labels[type];
export const transactionDirection = (type: StockTransactionType) =>
  type === 'ADJUSTMENT_DECREASE' ? 'Зменшення' : 'Збільшення';
export const transactionSource = (item: StockTransaction) =>
  item.sourceDocument || (item.importBatchId ? `Імпорт ${item.importBatchId}` : 'Системна операція');

export function transactionApiQuery(filters: TransactionFilterDraft): Omit<StockTransactionsQuery, 'page' | 'limit'> {
  return {
    responsiblePersonId: filters.responsiblePersonId || undefined,
    inventoryItemId: filters.inventoryItemId || undefined,
    type: filters.type || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
  };
}

export function filterTransactions(items: StockTransaction[], filters: TransactionFilterDraft) {
  const document = filters.document.trim().toLocaleLowerCase('uk-UA');
  return items.filter((item) => {
    if (filters.status && filters.status !== 'POSTED') return false;
    if (filters.user.trim()) return false; // The API contract does not expose an operation author.
    return !document || transactionSource(item).toLocaleLowerCase('uk-UA').includes(document);
  });
}

export function paginateTransactions(items: StockTransaction[], page: number, limit: number) {
  const safeLimit = Math.min(100, Math.max(1, limit));
  const totalPages = Math.ceil(items.length / safeLimit);
  const safePage = totalPages ? Math.min(Math.max(1, page), totalPages) : 1;
  return {
    items: items.slice((safePage - 1) * safeLimit, safePage * safeLimit),
    pagination: { page: safePage, limit: safeLimit, total: items.length, totalPages },
  };
}

export function transactionDetails(item: StockTransaction) {
  return {
    id: item.id,
    occurredAt: item.occurredAt,
    type: item.type,
    responsiblePerson: item.responsiblePerson,
    inventoryItem: item.inventoryItem,
    quantity: item.quantity,
    balanceBefore: item.balanceBefore,
    balanceAfter: item.balanceAfter,
    sourceDocument: item.sourceDocument,
    importBatchId: item.importBatchId,
    comment: item.comment,
    createdAt: item.createdAt,
  };
}
