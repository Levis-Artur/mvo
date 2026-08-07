import {
  AccountingExportState,
  Prisma,
  StockDocumentStatus,
  StockDocumentType,
  StockTransactionType,
} from '@prisma/client';
import { AccountingOverviewService } from './accounting-overview.service';

describe('AccountingOverviewService', () => {
  it('returns accounting metrics and the ten most recent operations', async () => {
    const prisma = {
      responsiblePerson: { count: jest.fn().mockResolvedValue(12) },
      inventoryItem: { count: jest.fn().mockResolvedValue(34) },
      importBatch: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'import-id',
          originalFilename: 'залишки.csv',
          status: 'COMPLETED',
          createdAt: new Date('2026-08-02T10:00:00.000Z'),
          completedAt: new Date('2026-08-02T10:05:00.000Z'),
        }),
      },
      stockDocument: { count: jest.fn().mockResolvedValue(3) },
      stockTransaction: {
        count: jest.fn().mockResolvedValue(9),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'transaction-id',
            type: StockTransactionType.IMPORT_RECEIPT,
            quantity: new Prisma.Decimal(5),
            occurredAt: new Date('2026-08-03T10:00:00.000Z'),
            sourceDocument: 'залишки.csv',
            comment: null,
            document: null,
            responsiblePerson: {
              personnelNumber: '001',
              externalAccountingCode: 'MVO-001',
              lastName: 'Тестовий',
              firstName: 'Користувач',
              middleName: null,
            },
            inventoryItem: {
              externalCode: 'KB-1',
              name: 'Клавіатура',
              unitOfMeasure: 'шт.',
            },
          },
        ]),
      },
    };
    const service = new AccountingOverviewService(prisma as never);

    const result = await service.overview(
      new Date('2026-08-07T12:00:00.000Z'),
    );

    expect(result.metrics).toEqual({
      activeResponsiblePersons: 12,
      inventoryItems: 34,
      unexportedTransfers: 3,
      currentMonthTransactions: 9,
    });
    expect(result.lastImport?.originalFilename).toBe('залишки.csv');
    expect(result.recentOperations).toHaveLength(1);
    expect(prisma.stockDocument.count).toHaveBeenCalledWith({
      where: {
        type: StockDocumentType.MVO_TRANSFER,
        status: StockDocumentStatus.POSTED,
        accountingExportState: AccountingExportState.NOT_EXPORTED,
      },
    });
    expect(prisma.stockTransaction.count).toHaveBeenCalledWith({
      where: {
        occurredAt: { gte: new Date('2026-08-01T00:00:00.000Z') },
      },
    });
    expect(prisma.stockTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 }),
    );
  });
});
