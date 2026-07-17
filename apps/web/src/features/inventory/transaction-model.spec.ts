import type { StockTransaction } from '@/lib/types';
import {
  DEFAULT_TRANSACTION_FILTERS,
  filterTransactions,
  paginateTransactions,
  transactionApiQuery,
  transactionDetails,
} from './transaction-model';

const transaction: StockTransaction = {
  id: 'tx-1', type: 'RECEIPT', quantity: '2.50', balanceBefore: '1', balanceAfter: '3.50',
  occurredAt: '2026-01-02T10:00:00.000Z', sourceDocument: 'Накладна 7', comment: 'Тест',
  importBatchId: null, createdAt: '2026-01-02T10:00:00.000Z',
  responsiblePerson: { id: 'person-1', fullName: 'Левіс Артур Сергійович', personnelNumber: '003' },
  inventoryItem: { id: 'item-1', externalCode: '100', name: 'Папір', unitOfMeasure: 'пач.' },
};

describe('transaction presentation model', () => {
  it('builds only API-supported filters', () => {
    expect(transactionApiQuery({ ...DEFAULT_TRANSACTION_FILTERS, type: 'RECEIPT', document: '7', status: 'POSTED' }))
      .toEqual({ responsiblePersonId: undefined, inventoryItemId: undefined, type: 'RECEIPT', dateFrom: undefined, dateTo: undefined });
  });

  it('filters the journal by document', () => {
    expect(filterTransactions([transaction], { ...DEFAULT_TRANSACTION_FILTERS, document: 'накладна' })).toHaveLength(1);
    expect(filterTransactions([transaction], { ...DEFAULT_TRANSACTION_FILTERS, document: 'акт' })).toHaveLength(0);
  });

  it('keeps page size within the backend maximum', () => {
    expect(paginateTransactions([transaction], 1, 500).pagination.limit).toBe(100);
  });

  it('exposes only available non-secret transaction fields in details', () => {
    const details = transactionDetails(transaction);
    expect(details).toMatchObject({ id: 'tx-1', quantity: '2.50', comment: 'Тест' });
    expect(details).not.toHaveProperty('passwordHash');
    expect(details).not.toHaveProperty('requestId');
  });
});
