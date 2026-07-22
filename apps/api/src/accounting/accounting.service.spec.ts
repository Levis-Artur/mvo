import { ConflictException, InternalServerErrorException } from '@nestjs/common';
import {
  AccountingExportState,
  Prisma,
  StockDocumentStatus,
  StockDocumentType,
  UserRole,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import {
  ACCOUNTING_TRANSFER_EXPORT_FORMAT_V1,
  ACCOUNTING_TRANSFER_EXPORT_FORMAT_V2,
  buildAccountingTransferCsvV1,
  buildAccountingTransferCsvV2,
} from './accounting-transfer.csv';
import { AccountingService } from './accounting.service';

const sourceId = '11111111-1111-4111-8111-111111111111';
const destinationId = '22222222-2222-4222-8222-222222222222';
const documentId = '33333333-3333-4333-8333-333333333333';
const batchId = '66666666-6666-4666-8666-666666666666';

const actor = {
  id: '77777777-7777-4777-8777-777777777777',
  username: 'accountant',
  role: UserRole.ACCOUNTANT,
  isActive: true,
  mustChangePassword: false,
  responsiblePersonId: null,
};

function person(id: string, number: string, lastName: string) {
  return {
    id,
    personnelNumber: number,
    lastName,
    firstName: 'Тест',
    middleName: null,
    management: {
      id: `${number}000000-0000-4000-8000-000000000000`,
      name: `Управління ${number}`,
    },
  };
}

function line(
  index = 0,
  inventoryItemId = '55555555-5555-4555-8555-555555555555',
) {
  return {
    id: `44444444-4444-4444-8444-${String(index).padStart(12, '0')}`,
    documentId,
    inventoryItemId,
    quantity: new Prisma.Decimal(index + 1),
    createdAt: new Date('2026-07-21T12:00:00.000Z'),
    inventoryItem: {
      id: inventoryItemId,
      externalCode: `KB-${index}`,
      name: `Клавіатура ${index}`,
      unitOfMeasure: 'шт',
    },
  };
}

function exportDocument(lines = [line()], displayNumber: number | null = 7) {
  return {
    id: documentId,
    documentNumber: 'MVO-INTERNAL-UUID-LIKE',
    displayNumber,
    documentDate: new Date('2026-07-21T00:00:00.000Z'),
    type: StockDocumentType.MVO_TRANSFER,
    status: StockDocumentStatus.POSTED,
    accountingExportState: AccountingExportState.NOT_EXPORTED,
    sourceResponsiblePersonId: sourceId,
    destinationResponsiblePersonId: destinationId,
    postedAt: new Date('2026-07-21T12:00:00.000Z'),
    sourceResponsiblePerson: person(sourceId, '001', 'Левіс'),
    destinationResponsiblePerson: person(destinationId, '003', 'Луцик'),
    lines,
  };
}

function snapshotRow(displayNumber: number | null = 7) {
  return {
    id: '88888888-8888-4888-8888-888888888888',
    batchId,
    documentId,
    documentLineId: line().id,
    documentNumber: 'MVO-INTERNAL-UUID-LIKE',
    displayNumber,
    documentDate: new Date('2026-07-21T00:00:00.000Z'),
    sourcePersonnelNumber: '001',
    sourceFullName: 'Левіс Тест',
    sourceManagementName: 'Управління 001',
    destinationPersonnelNumber: '003',
    destinationFullName: 'Луцик Тест',
    destinationManagementName: 'Управління 003',
    inventoryCode: 'KB-0',
    inventoryName: 'Клавіатура 0',
    unitOfMeasure: 'шт',
    quantity: new Prisma.Decimal(1),
    documentStatus: StockDocumentStatus.POSTED,
    postedAt: new Date('2026-07-21T12:00:00.000Z'),
    rowOrder: 0,
  };
}

function listRow() {
  return {
    ...line(),
    document: {
      ...exportDocument(),
      exportedAt: null,
    },
  };
}

type SnapshotRow = ReturnType<typeof snapshotRow>;
type PersistedBatch = {
  id: string;
  filename: string;
  sha256: string;
  formatVersion: number;
  documentCount: number;
  rowCount: number;
  rows: SnapshotRow[];
};

function sha256(csv: string) {
  return createHash('sha256').update(csv, 'utf8').digest('hex');
}

function persistedBatch(
  formatVersion = ACCOUNTING_TRANSFER_EXPORT_FORMAT_V2,
  rows: SnapshotRow[] = [snapshotRow()],
): PersistedBatch {
  const csv = formatVersion === ACCOUNTING_TRANSFER_EXPORT_FORMAT_V1
    ? buildAccountingTransferCsvV1(rows)
    : buildAccountingTransferCsvV2(
        rows.map((row) => ({ ...row, displayNumber: row.displayNumber! })),
      );
  return {
    id: batchId,
    filename: 'mvo-transfers.csv',
    sha256: sha256(csv),
    formatVersion,
    documentCount: new Set(rows.map((row) => row.documentId)).size,
    rowCount: rows.length,
    rows,
  };
}

function harness(documents = [exportDocument()]) {
  let storedBatch = persistedBatch();
  const tx = {
    stockDocument: {
      findMany: jest.fn().mockResolvedValue(documents),
      updateMany: jest.fn().mockResolvedValue({ count: documents.length }),
    },
    accountingTransferExportBatch: {
      create: jest.fn().mockImplementation(async (args: {
        data: {
          filename: string;
          sha256: string;
          formatVersion: number;
          documentCount: number;
          rowCount: number;
          rows: { create: Array<Omit<SnapshotRow, 'id' | 'batchId'>> };
        };
      }) => {
        const rows = args.data.rows.create.map((row, index) => ({
          ...row,
          id: `88888888-8888-4888-8888-${String(index).padStart(12, '0')}`,
          batchId,
        }));
        storedBatch = {
          id: batchId,
          filename: args.data.filename,
          sha256: args.data.sha256,
          formatVersion: args.data.formatVersion,
          documentCount: args.data.documentCount,
          rowCount: args.data.rowCount,
          rows,
        };
        return { id: batchId };
      }),
    },
    securityEvent: { create: jest.fn() },
  };
  const prisma = {
    stockDocumentLine: {
      findMany: jest.fn().mockResolvedValue([listRow()]),
      count: jest.fn().mockResolvedValue(1),
    },
    accountingTransferExportBatch: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn().mockImplementation(async () => storedBatch),
    },
    securityEvent: { create: jest.fn() },
    $transaction: jest.fn(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    ),
  };
  return {
    service: new AccountingService(prisma as never),
    prisma,
    tx,
    setStoredBatch(batch: PersistedBatch) {
      storedBatch = batch;
    },
  };
}

describe('AccountingService', () => {
  it('lists only MVO_TRANSFER rows and exposes the human display number', async () => {
    const h = harness();
    const result = await h.service.listTransfers({
      page: 1,
      limit: 20,
      documentNumber: '№ 7',
    });
    expect(h.prisma.stockDocumentLine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          document: expect.objectContaining({
            type: StockDocumentType.MVO_TRANSFER,
            displayNumber: 7,
          }),
        }),
      }),
    );
    expect(result.items[0]).toEqual(
      expect.objectContaining({ displayNumber: 7, quantity: '1' }),
    );
    expect(result.items[0]).not.toHaveProperty('documentNumber');
  });

  it('claims only POSTED, NOT_EXPORTED MVO_TRANSFER documents atomically', async () => {
    const h = harness();
    const result = await h.service.exportTransfers(
      {
        status: StockDocumentStatus.CANCELLED,
        exportState: AccountingExportState.EXPORTED,
      } as never,
      actor,
      { requestId: 'request-1' },
    );

    expect(h.tx.stockDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: StockDocumentType.MVO_TRANSFER,
          status: StockDocumentStatus.POSTED,
          accountingExportState: AccountingExportState.NOT_EXPORTED,
        }),
      }),
    );
    expect(h.tx.stockDocument.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: [documentId] },
        type: StockDocumentType.MVO_TRANSFER,
        status: StockDocumentStatus.POSTED,
        accountingExportState: AccountingExportState.NOT_EXPORTED,
      },
      data: {
        accountingExportState: AccountingExportState.EXPORTED,
        exportedAt: expect.any(Date),
        exportedByUserId: actor.id,
      },
    });
    expect(h.prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }),
    );
    expect(h.tx.accountingTransferExportBatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          formatVersion: ACCOUNTING_TRANSFER_EXPORT_FORMAT_V2,
        }),
      }),
    );
    expect(result.csv).toContain('№ 7');
    expect(result.csv).not.toContain('MVO-INTERNAL-UUID-LIKE');
    expect(h.prisma).not.toHaveProperty('stockBalance');
  });

  it('uses document-level nomenclature filtering and exports every line of a matched document', async () => {
    const selectedInventoryItemId = line().inventoryItemId;
    const otherInventoryItemId = '99999999-9999-4999-8999-999999999999';
    const lines = [line(0), line(1, otherInventoryItemId)];
    const h = harness([exportDocument(lines)]);
    const result = await h.service.exportTransfers(
      { inventoryItemId: selectedInventoryItemId },
      actor,
      {},
    );

    expect(h.tx.accountingTransferExportBatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          documentCount: 1,
          rowCount: 2,
          rows: {
            create: expect.arrayContaining([
              expect.objectContaining({ inventoryName: 'Клавіатура 0' }),
              expect.objectContaining({ inventoryName: 'Клавіатура 1' }),
            ]),
          },
        }),
      }),
    );
    expect(h.tx.stockDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          lines: { some: { inventoryItemId: selectedInventoryItemId } },
        }),
      }),
    );
    expect(result.csv).toContain('Клавіатура 0');
    expect(result.csv).toContain('Клавіатура 1');
  });

  it('rolls back a raced claim and returns conflict without a partial batch', async () => {
    const h = harness();
    h.tx.stockDocument.updateMany.mockResolvedValue({ count: 0 });

    await expect(h.service.exportTransfers({}, actor, {})).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(h.prisma.$transaction).toHaveBeenCalledTimes(3);
    expect(h.prisma.securityEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ success: false }) }),
    );
  });

  it('blocks a document without displayNumber before creating a batch', async () => {
    const h = harness([exportDocument([line()], null)]);
    await expect(h.service.exportTransfers({}, actor, {})).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(h.tx.accountingTransferExportBatch.create).not.toHaveBeenCalled();
  });

  it('re-downloads a V2 snapshot with identical verified bytes', async () => {
    const h = harness();
    const result = await h.service.downloadExportBatch(
      batchId,
      actor,
      { requestId: 'download-request' },
    );

    expect(result.filename).toBe('mvo-transfers.csv');
    expect(result.csv).toContain('Левіс Тест');
    expect(result.csv).toContain('№ 7');
    expect(result.csv).not.toContain(documentId);
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
    expect(h.tx.stockDocument.updateMany).not.toHaveBeenCalled();
    expect(h.prisma.securityEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          success: true,
          requestId: 'download-request',
        }),
      }),
    );
    const repeated = await h.service.downloadExportBatch(batchId, actor, {});
    expect(repeated.csv).toBe(result.csv);
    expect(repeated.batchId).toBe(result.batchId);
  });

  it('re-downloads V1 with legacy documentNumber and ignores displayNumber', async () => {
    const h = harness();
    const legacyRows = [
      {
        ...snapshotRow(999),
        documentNumber: 'LEGACY-DOCUMENT-NUMBER',
      },
    ];
    const batch = persistedBatch(
      ACCOUNTING_TRANSFER_EXPORT_FORMAT_V1,
      legacyRows,
    );
    h.setStoredBatch(batch);

    const first = await h.service.downloadExportBatch(batchId, actor, {});
    const second = await h.service.downloadExportBatch(batchId, actor, {});

    expect(first.csv).toBe(buildAccountingTransferCsvV1(legacyRows));
    expect(sha256(first.csv)).toBe(batch.sha256);
    expect(first.csv).toContain('LEGACY-DOCUMENT-NUMBER');
    expect(first.csv).not.toContain('№ 999');
    expect(second.csv).toBe(first.csv);
  });

  it('rejects a V2 persisted snapshot without a human document number', async () => {
    const h = harness();
    h.setStoredBatch({
      ...persistedBatch(),
      rows: [snapshotRow(null)],
    });
    await expect(
      h.service.downloadExportBatch(batchId, actor, {}),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('rejects a damaged snapshot when the generated hash differs', async () => {
    const h = harness();
    h.setStoredBatch({ ...persistedBatch(), sha256: '0'.repeat(64) });

    await expect(
      h.service.downloadExportBatch(
        batchId,
        actor,
        { requestId: 'integrity-request' },
      ),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(h.prisma.securityEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          success: false,
          requestId: 'integrity-request',
        }),
      }),
    );
  });
});
