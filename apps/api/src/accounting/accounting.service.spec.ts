import {
  AccountingExportState,
  Prisma,
  StockDocumentStatus,
  StockDocumentType,
  UserRole,
} from '@prisma/client';
import { AccountingService } from './accounting.service';

const sourceId = '11111111-1111-4111-8111-111111111111';
const destinationId = '22222222-2222-4222-8222-222222222222';
const documentId = '33333333-3333-4333-8333-333333333333';

function transferRow(
  index = 0,
  status: StockDocumentStatus = StockDocumentStatus.POSTED,
) {
  const person = (id: string, number: string, lastName: string) => ({
    id,
    personnelNumber: number,
    lastName,
    firstName: 'Тест',
    middleName: null,
    management: { id: `${number}000000-0000-4000-8000-000000000000`, name: `Управління ${number}` },
  });
  return {
    id: `44444444-4444-4444-8444-${String(index).padStart(12, '0')}`,
    documentId,
    inventoryItemId: '55555555-5555-4555-8555-555555555555',
    quantity: new Prisma.Decimal(index + 1),
    createdAt: new Date(),
    inventoryItem: {
      id: '55555555-5555-4555-8555-555555555555',
      externalCode: `KB-${index}`,
      name: `Клавіатура ${index}`,
      unitOfMeasure: 'шт',
    },
    document: {
      id: documentId,
      documentNumber: 'MVO-7',
      displayNumber: 7,
      documentDate: new Date('2026-07-21T00:00:00.000Z'),
      type: StockDocumentType.MVO_TRANSFER,
      status,
      accountingExportState: AccountingExportState.NOT_EXPORTED,
      sourceResponsiblePersonId: sourceId,
      destinationResponsiblePersonId: destinationId,
      postedAt: status === StockDocumentStatus.POSTED ? new Date('2026-07-21T12:00:00.000Z') : null,
      sourceResponsiblePerson: person(sourceId, '001', 'Левіс'),
      destinationResponsiblePerson: person(destinationId, '003', 'Луцик'),
    },
  };
}

function harness(rows = [transferRow()]) {
  const tx = {
    accountingTransferExportBatch: {
      create: jest.fn().mockResolvedValue({ id: '66666666-6666-4666-8666-666666666666' }),
    },
    stockDocument: { updateMany: jest.fn() },
    securityEvent: { create: jest.fn() },
  };
  const prisma = {
    stockDocumentLine: {
      findMany: jest.fn().mockResolvedValue(rows),
      count: jest.fn().mockResolvedValue(rows.length),
    },
    accountingTransferExportBatch: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  return { service: new AccountingService(prisma as never), prisma, tx };
}

const actor = {
  id: '77777777-7777-4777-8777-777777777777',
  username: 'accountant',
  role: UserRole.ACCOUNTANT,
  isActive: true,
  mustChangePassword: false,
  responsiblePersonId: null,
};

describe('AccountingService', () => {
  it('lists only MVO_TRANSFER lines with all supported filters', async () => {
    const h = harness();
    const result = await h.service.listTransfers({
      page: 1,
      limit: 20,
      sourceResponsiblePersonId: sourceId,
      destinationResponsiblePersonId: destinationId,
      status: StockDocumentStatus.POSTED,
      documentNumber: 'MVO-7',
    });
    expect(h.prisma.stockDocumentLine.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ document: expect.objectContaining({ type: StockDocumentType.MVO_TRANSFER }) }),
      take: 20,
    }));
    expect(result.items[0]).toEqual(expect.objectContaining({ documentNumber: 'MVO-7', quantity: '1' }));
  });

  it('exports every filtered row, not only the first page, and saves a batch', async () => {
    const rows = Array.from({ length: 150 }, (_, index) => transferRow(index));
    const h = harness(rows);
    const result = await h.service.exportTransfers({ status: StockDocumentStatus.POSTED }, actor, { requestId: 'request-1' });
    expect(h.prisma.stockDocumentLine.findMany).toHaveBeenCalledWith(expect.not.objectContaining({ take: expect.anything() }));
    expect(result.csv).toContain('Клавіатура 149');
    expect(h.tx.accountingTransferExportBatch.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ rowCount: 150 }) }));
    expect(h.tx.stockDocument.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: StockDocumentStatus.POSTED }),
      data: { accountingExportState: AccountingExportState.EXPORTED },
    }));
    expect(h.prisma).not.toHaveProperty('stockBalance');
    expect(h.prisma).not.toHaveProperty('importBatch');
  });

  it('keeps cancelled documents visibly cancelled instead of marking them active', async () => {
    const h = harness([transferRow(0, StockDocumentStatus.CANCELLED)]);
    const result = await h.service.exportTransfers({}, actor, {});
    expect(result.csv).toContain('Скасовано');
    expect(h.tx.stockDocument.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: StockDocumentStatus.POSTED }),
    }));
  });

  it('re-downloads the immutable rows of an existing batch', async () => {
    const h = harness();
    h.prisma.accountingTransferExportBatch.findUnique.mockResolvedValue({
      id: 'batch-id',
      filename: 'mvo-transfers.csv',
      rows: [{
        ...transferRow().document,
        documentId,
        documentLineId: transferRow().id,
        documentNumber: 'MVO-7',
        documentDate: new Date('2026-07-21T00:00:00.000Z'),
        sourcePersonnelNumber: '001',
        sourceFullName: 'Левіс Тест',
        sourceManagementName: 'Управління 001',
        destinationPersonnelNumber: '003',
        destinationFullName: 'Луцик Тест',
        destinationManagementName: 'Управління 003',
        inventoryCode: 'KB-1',
        inventoryName: 'Клавіатура',
        unitOfMeasure: 'шт',
        quantity: new Prisma.Decimal(2),
        documentStatus: StockDocumentStatus.POSTED,
        rowOrder: 0,
      }],
    });
    const result = await h.service.downloadExportBatch('batch-id');
    expect(result.filename).toBe('mvo-transfers.csv');
    expect(result.csv).toContain('Левіс Тест');
    expect(result.csv).not.toContain(documentId);
  });
});
