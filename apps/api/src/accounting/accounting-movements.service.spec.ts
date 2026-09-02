import {
  ImportStatus,
  ImportType,
  Prisma,
  StockDocumentStatus,
  StockDocumentType,
  StockTransactionType,
} from '@prisma/client';
import { AccountingMovementsService } from './accounting-movements.service';

const person = {
  id: '11111111-1111-4111-8111-111111111111',
  externalAccountingCode: '0057',
  lastName: 'Жигульський',
  firstName: 'Андрій',
  middleName: 'Васильович',
};

const destination = {
  ...person,
  id: '22222222-2222-4222-8222-222222222222',
  externalAccountingCode: '0061',
  lastName: 'Левіс',
};

const inventoryItem = {
  id: '33333333-3333-4333-8333-333333333333',
  externalCode: 'KB-1',
  name: 'Клавіатура',
  unitOfMeasure: 'шт.',
};

function movement(overrides: Record<string, unknown> = {}) {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    type: StockTransactionType.IMPORT_RECEIPT,
    responsiblePersonId: person.id,
    inventoryItemId: inventoryItem.id,
    quantity: new Prisma.Decimal(10),
    balanceBefore: new Prisma.Decimal(0),
    balanceAfter: new Prisma.Decimal(10),
    occurredAt: new Date('2026-08-07T22:30:00.000Z'),
    comment: null,
    sourceDocument: 'оборотна-відомість.csv',
    importBatchId: '55555555-5555-4555-8555-555555555555',
    importRowId: null,
    documentId: null,
    documentLineId: null,
    accountingModel: null,
    bucketKind: null,
    accountingOwnerResponsiblePersonId: null,
    sourceCustodianResponsiblePersonId: null,
    destinationCustodianResponsiblePersonId: null,
    reversalOfTransactionId: null,
    createdAt: new Date('2026-08-07T22:30:00.000Z'),
    responsiblePerson: person,
    inventoryItem,
    importBatch: {
      id: '55555555-5555-4555-8555-555555555555',
      originalFilename: 'оборотна-відомість.csv',
      status: ImportStatus.COMPLETED,
      type: ImportType.RECEIPT,
      createdAt: new Date('2026-08-07T22:00:00.000Z'),
      completedAt: new Date('2026-08-07T22:30:00.000Z'),
    },
    document: null,
    ...overrides,
  };
}

function documentMovement(
  type: StockDocumentType,
  transactionType: StockTransactionType,
  status = StockDocumentStatus.POSTED,
) {
  return movement({
    type: transactionType,
    quantity: new Prisma.Decimal(2),
    balanceBefore: new Prisma.Decimal(10),
    balanceAfter: new Prisma.Decimal(8),
    importBatchId: null,
    importBatch: null,
    documentId: '66666666-6666-4666-8666-666666666666',
    document: {
      id: '66666666-6666-4666-8666-666666666666',
      displayNumber: 7,
      documentDate: new Date('2026-08-07T00:00:00.000Z'),
      type,
      status,
      recipientName: type === StockDocumentType.ISSUE ? 'Склад отримувача' : null,
      sourceTransferId: null,
      sourceResponsiblePerson: person,
      destinationResponsiblePerson:
        type === StockDocumentType.MVO_TRANSFER ? destination : null,
      sourceTransfer: null,
      attachments:
        type === StockDocumentType.ISSUE ? [{ id: 'attachment-id' }] : [],
    },
  });
}

function harness(items = [movement()]) {
  const prisma = {
    stockTransaction: {
      findMany: jest.fn().mockResolvedValue(items),
      count: jest.fn().mockResolvedValue(items.length),
      findFirst: jest.fn(),
    },
    stockDocument: { findUnique: jest.fn() },
    importBatch: { findUnique: jest.fn() },
    securityEvent: { findFirst: jest.fn() },
  };
  return {
    service: new AccountingMovementsService(prisma as never),
    prisma,
  };
}

describe('AccountingMovementsService', () => {
  it('serializes an import as a positive receipt with the accounting MVO code', async () => {
    const h = harness();
    const result = await h.service.list({ page: 1, limit: 25 });

    expect(result.items[0]).toEqual(expect.objectContaining({
      operationType: 'IMPORT',
      operationLabel: 'Надходження',
      quantity: '+10',
      direction: 'Бухгалтерія → 0057 — Жигульський Андрій Васильович',
      statusLabel: 'Проведено',
    }));
    expect(result.items[0].responsiblePerson.externalAccountingCode).toBe('0057');
  });

  it.each([
    [StockDocumentType.MVO_TRANSFER, StockTransactionType.MVO_TRANSFER_OUT, 'MVO_TRANSFER', 'Передача МВО', '-2'],
    [StockDocumentType.ISSUE, StockTransactionType.ISSUE_OUT, 'ISSUE', 'Видача', '-2'],
  ])('serializes %s/%s as %s', async (documentType, transactionType, operationType, operationLabel, quantity) => {
    const h = harness([documentMovement(documentType, transactionType)]);
    const result = await h.service.list({ page: 1, limit: 25 });

    expect(result.items[0]).toEqual(expect.objectContaining({
      operationType,
      operationLabel,
      quantity,
      documentLabel: '№ 7',
    }));
    if (operationType === 'ISSUE') {
      expect(result.items[0]).toEqual(
        expect.objectContaining({
          transferredTo: null,
          issuedTo: 'Склад отримувача',
          relatedDocument: null,
          hasAttachment: true,
        }),
      );
    }
  });

  it('uses inclusive dateTo, server-side filters, newest-first sorting and pagination', async () => {
    const h = harness([]);
    await h.service.list({
      page: 2,
      limit: 50,
      dateFrom: '2026-08-01',
      dateTo: '2026-08-07',
      operationType: 'MVO_TRANSFER',
      responsiblePersonId: person.id,
      destinationResponsiblePersonId: destination.id,
      mvoCode: '0057',
      inventoryCode: 'KB',
      inventoryName: 'клав',
      transferRecipient: '0061',
      issueRecipient: 'Склад',
      status: 'POSTED',
      search: '№ 7',
    });

    const call = h.prisma.stockTransaction.findMany.mock.calls[0][0];
    expect(call.skip).toBe(50);
    expect(call.take).toBe(50);
    expect(call.orderBy).toEqual([
      { occurredAt: 'desc' },
      { createdAt: 'desc' },
      { id: 'desc' },
    ]);
    expect(JSON.stringify(call.where)).toContain('2026-08-07T23:59:59.999Z');
    expect(JSON.stringify(call.where)).toContain('0057');
    expect(JSON.stringify(call.where)).toContain('MVO_TRANSFER_OUT');
    expect(JSON.stringify(call.where)).toContain('"displayNumber":7');
    expect(JSON.stringify(call.where)).toContain('0061');
    expect(JSON.stringify(call.where)).toContain('Склад');
  });

  it('exports every filtered row with UTF-8 BOM and does not mutate data', async () => {
    const h = harness([movement()]);
    const result = await h.service.exportCsv({ mvoCode: '0057' });

    expect(result.csv.startsWith('\uFEFF')).toBe(true);
    expect(result.csv).toContain('"Надходження"');
    expect(result.csv).toContain('"Є підтверджуючий документ"');
    expect(result.csv).toContain('"0057"');
    expect(result.csv).toContain('\r\n');
    expect(h.prisma.stockTransaction.findMany).toHaveBeenCalledWith(
      expect.not.objectContaining({ skip: expect.anything(), take: expect.anything() }),
    );
    expect(Object.keys(h.prisma)).toEqual([
      'stockTransaction',
      'stockDocument',
      'importBatch',
      'securityEvent',
    ]);
  });

  it('returns the transfer to child ISSUE chain and counts only POSTED issues', async () => {
    const h = harness([]);
    h.prisma.stockDocument.findUnique.mockResolvedValue({
      id: '66666666-6666-4666-8666-666666666666',
      displayNumber: 7,
      documentDate: new Date('2026-08-07T00:00:00.000Z'),
      type: StockDocumentType.MVO_TRANSFER,
      status: StockDocumentStatus.POSTED,
      sourceTransferId: null,
      recipientName: null,
      recipientUnit: null,
      basis: null,
      note: null,
      sourceResponsiblePerson: person,
      destinationResponsiblePerson: destination,
      sourceTransfer: null,
      createdByUser: { id: 'user-id', username: 'mvo-a' },
      lines: [
        {
          inventoryItem,
          quantity: new Prisma.Decimal(10),
          note: null,
          issueLines: [
            {
              quantity: new Prisma.Decimal(6),
              document: {
                id: 'posted-issue',
                status: StockDocumentStatus.POSTED,
              },
            },
            {
              quantity: new Prisma.Decimal(2),
              document: {
                id: 'cancelled-issue',
                status: StockDocumentStatus.CANCELLED,
              },
            },
          ],
        },
      ],
      attachments: [],
      issues: [
        {
          id: 'posted-issue',
          displayNumber: 8,
          documentDate: new Date('2026-08-08T00:00:00.000Z'),
          status: StockDocumentStatus.POSTED,
          recipientName: 'Одержувач',
          createdByUser: { id: 'user-id', username: 'mvo-a' },
          lines: [
            {
              inventoryItem,
              quantity: new Prisma.Decimal(6),
            },
          ],
          attachments: [
            {
              id: 'attachment-id',
              documentId: 'posted-issue',
              originalFileName: 'накладна.pdf',
              mimeType: 'application/pdf',
              sizeBytes: 100,
              sha256: 'hash',
              uploadedByUserId: 'user-id',
              createdAt: new Date('2026-08-08T00:00:00.000Z'),
            },
          ],
        },
        {
          id: 'cancelled-issue',
          displayNumber: 9,
          documentDate: new Date('2026-08-09T00:00:00.000Z'),
          status: StockDocumentStatus.CANCELLED,
          recipientName: 'Інший одержувач',
          createdByUser: { id: 'user-id', username: 'mvo-a' },
          lines: [
            {
              inventoryItem,
              quantity: new Prisma.Decimal(2),
            },
          ],
          attachments: [],
        },
      ],
    });

    const details = await h.service.detailsByDocumentId(
      '66666666-6666-4666-8666-666666666666',
    );

    expect(details.lines[0]).toEqual(
      expect.objectContaining({
        quantity: '10',
        issuedQuantity: '6',
        availableToIssue: '4',
      }),
    );
    expect(details.issues).toEqual([
      expect.objectContaining({ id: 'posted-issue', quantity: '6' }),
      expect.objectContaining({
        id: 'cancelled-issue',
        status: StockDocumentStatus.CANCELLED,
      }),
    ]);
  });
});
