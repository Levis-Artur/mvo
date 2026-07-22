import {
  Prisma,
  StockDocumentStatus,
  StockDocumentType,
  StockTransactionType,
} from '@prisma/client';
import { InventoryItemsService } from './inventory-items.service';

const person = {
  id: '11111111-1111-4111-8111-111111111111',
  lastName: 'Левіс',
  firstName: 'Артур',
  middleName: null,
  personnelNumber: '003',
  management: { id: 'management-1', name: 'Управління А' },
  service: { id: 'service-1', name: 'Служба А' },
  unit: { id: 'unit-1', name: 'Підрозділ А' },
};

const destination = {
  ...person,
  id: '22222222-2222-4222-8222-222222222222',
  personnelNumber: '004',
  lastName: 'Луцик',
};

const item = {
  id: '33333333-3333-4333-8333-333333333333',
  externalCode: 'KB-1',
  name: 'Клавіатура',
  unitOfMeasure: 'шт',
  isActive: true,
  reviewStatus: 'VERIFIED',
};

function transaction(
  type: StockTransactionType,
  before: string,
  after: string,
  occurredAt: string,
) {
  return {
    id: `${type}-id`,
    type,
    quantity: new Prisma.Decimal(new Prisma.Decimal(after).minus(before).abs()),
    balanceBefore: new Prisma.Decimal(before),
    balanceAfter: new Prisma.Decimal(after),
    occurredAt: new Date(occurredAt),
    createdAt: new Date(occurredAt),
    sourceDocument: null,
    responsiblePerson: person,
    importBatch: null,
    document: null,
  };
}

function prismaMock() {
  return {
    inventoryItem: { findFirst: jest.fn().mockResolvedValue(item) },
    stockBalance: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'balance-a',
          quantity: new Prisma.Decimal(8),
          updatedAt: new Date('2026-07-22T12:00:00.000Z'),
          responsiblePerson: person,
        },
        {
          id: 'balance-b',
          quantity: new Prisma.Decimal(5),
          updatedAt: new Date('2026-07-22T13:00:00.000Z'),
          responsiblePerson: destination,
        },
      ]),
    },
    stockTransaction: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    stockDocument: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    importBatch: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
  };
}

describe('InventoryItemsService accounting card', () => {
  it('uses only actual StockBalance rows for current balances and totals', async () => {
    const prisma = prismaMock();
    const service = new InventoryItemsService(prisma as never);

    const result = await service.accountingCard(item.id, {
      movementPage: 1,
      movementLimit: 20,
      documentPage: 1,
      documentLimit: 20,
    });

    expect(result.currentBalances).toHaveLength(2);
    expect(result.totals).toEqual({
      currentQuantity: '13',
      responsiblePersons: 2,
    });
    expect((prisma as Record<string, unknown>).custodyBalance).toBeUndefined();
  });

  it('keeps transfer and later CSV receipt as independent chronological movements', async () => {
    const prisma = prismaMock();
    const transfer = {
      ...transaction(
        StockTransactionType.MVO_TRANSFER_OUT,
        '10',
        '8',
        '2026-07-22T11:00:00.000Z',
      ),
      document: {
        id: 'document-1',
        displayNumber: 7,
        documentNumber: 'MVO-7',
        recipientName: null,
        sourceResponsiblePerson: person,
        destinationResponsiblePerson: destination,
        createdByUser: { username: 'mvo-a' },
        postedByUser: { username: 'mvo-a' },
        cancelledByUser: null,
      },
    };
    const receipt = {
      ...transaction(
        StockTransactionType.IMPORT_RECEIPT,
        '0',
        '5',
        '2026-07-22T12:00:00.000Z',
      ),
      responsiblePerson: destination,
      importBatch: {
        id: 'import-1',
        originalFilename: 'прихід.csv',
        type: 'RECEIPT',
        status: 'COMPLETED',
      },
    };
    prisma.stockTransaction.findMany.mockResolvedValue([receipt, transfer]);
    prisma.stockTransaction.count.mockResolvedValue(2);
    const service = new InventoryItemsService(prisma as never);

    const result = await service.accountingCard(item.id, {
      movementPage: 1,
      movementLimit: 20,
      documentPage: 1,
      documentLimit: 20,
    });

    expect(result.movements.items.map((movement) => movement.typeLabel)).toEqual([
      'Прихід за CSV',
      'Передача між МВО',
    ]);
    expect(result.movements.items[0]).toEqual(
      expect.objectContaining({ quantity: '5', to: expect.stringContaining('004') }),
    );
    expect(result.movements.items[1]).toEqual(
      expect.objectContaining({ quantity: '-2', to: expect.stringContaining('004') }),
    );
    expect(prisma.stockTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      }),
    );
  });

  it('shows cancellation as a separate movement and never exposes technical buckets', async () => {
    const prisma = prismaMock();
    prisma.stockTransaction.findMany.mockResolvedValue([
      {
        ...transaction(
          StockTransactionType.MVO_TRANSFER_REVERSAL,
          '8',
          '10',
          '2026-07-22T13:00:00.000Z',
        ),
        document: {
          id: 'document-1',
          displayNumber: 7,
          documentNumber: 'MVO-7',
          recipientName: null,
          sourceResponsiblePerson: person,
          destinationResponsiblePerson: destination,
          createdByUser: { username: 'mvo-a' },
          postedByUser: { username: 'mvo-a' },
          cancelledByUser: { username: 'owner' },
        },
      },
    ]);
    prisma.stockTransaction.count.mockResolvedValue(1);
    const service = new InventoryItemsService(prisma as never);

    const result = await service.accountingCard(item.id, {
      movementPage: 1,
      movementLimit: 20,
      documentPage: 1,
      documentLimit: 20,
    });

    expect(result.movements.items[0]).toEqual(
      expect.objectContaining({
        typeLabel: 'Скасування передачі',
        quantity: '2',
        user: 'owner',
      }),
    );
    expect(JSON.stringify(result)).not.toMatch(/bucketKind|DIRECT|ASSIGNED/);
  });

  it('returns stock documents with attachments and human labels', async () => {
    const prisma = prismaMock();
    prisma.stockDocument.findMany.mockResolvedValue([
      {
        id: 'document-1',
        displayNumber: 9,
        documentNumber: 'ISSUE-9',
        documentDate: new Date('2026-07-22T10:00:00.000Z'),
        postedAt: new Date('2026-07-22T10:05:00.000Z'),
        cancelledAt: null,
        createdAt: new Date('2026-07-22T09:00:00.000Z'),
        type: StockDocumentType.ISSUE,
        status: StockDocumentStatus.POSTED,
        recipientName: 'Микула',
        sourceResponsiblePerson: person,
        destinationResponsiblePerson: null,
        createdByUser: { username: 'mvo-a' },
        postedByUser: { username: 'mvo-a' },
        cancelledByUser: null,
        lines: [{ inventoryItemId: item.id, quantity: new Prisma.Decimal(1) }],
        attachments: [
          {
            id: 'attachment-1',
            originalFileName: 'накладна.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 100,
            createdAt: new Date('2026-07-22T09:30:00.000Z'),
          },
        ],
      },
    ]);
    prisma.stockDocument.count.mockResolvedValue(1);
    const service = new InventoryItemsService(prisma as never);

    const result = await service.accountingCard(item.id, {
      movementPage: 1,
      movementLimit: 20,
      documentPage: 1,
      documentLimit: 20,
    });

    expect(result.documents.items[0]).toEqual(
      expect.objectContaining({
        title: '№ 9',
        typeLabel: 'Видача',
        statusLabel: 'Проведено',
        attachments: [expect.objectContaining({ originalFileName: 'накладна.pdf' })],
      }),
    );
  });
});
