import {
  Prisma,
  StockAccountingModel,
  StockSourceKind,
  StockTransactionType,
} from '@prisma/client';
import { buildAccountingTransferCsvV2 } from '../accounting/accounting-transfer.csv';
import { StockService } from './stock.service';

const personA = '11111111-1111-4111-8111-111111111111';
const personB = '22222222-2222-4222-8222-222222222222';
const itemId = '44444444-4444-4444-8444-444444444444';

type TransactionRecord = {
  id: string;
  type: StockTransactionType;
  responsiblePersonId: string;
  quantity: Prisma.Decimal;
  balanceBefore: Prisma.Decimal;
  balanceAfter: Prisma.Decimal;
  importBatchId?: string | null;
  documentId?: string | null;
  reversalOfTransactionId?: string | null;
};

function createDirectBalanceHarness() {
  const balances = new Map<string, Prisma.Decimal>();
  const transactions: TransactionRecord[] = [];
  const attachments: { documentId: string; storedFileName: string }[] = [];
  const key = (personId: string, inventoryItemId: string) =>
    `${personId}:${inventoryItemId}`;

  const tx = {
    responsiblePerson: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        [personA, personB].includes(where.id) ? { id: where.id } : null,
      ),
    },
    inventoryItem: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        where.id === itemId ? { id: where.id } : null,
      ),
    },
    stockBalance: {
      upsert: jest.fn(
        async ({
          where,
        }: {
          where: {
            responsiblePersonId_inventoryItemId: {
              responsiblePersonId: string;
              inventoryItemId: string;
            };
          };
        }) => {
          const ids = where.responsiblePersonId_inventoryItemId;
          const balanceKey = key(ids.responsiblePersonId, ids.inventoryItemId);
          if (!balances.has(balanceKey)) {
            balances.set(balanceKey, new Prisma.Decimal(0));
          }
        },
      ),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: {
            responsiblePersonId_inventoryItemId: {
              responsiblePersonId: string;
              inventoryItemId: string;
            };
          };
          data: { quantity: Prisma.Decimal };
        }) => {
          const ids = where.responsiblePersonId_inventoryItemId;
          balances.set(key(ids.responsiblePersonId, ids.inventoryItemId), data.quantity);
        },
      ),
    },
    stockTransaction: {
      create: jest.fn(
        async ({ data }: { data: Omit<TransactionRecord, 'id'> }) => {
          const record = { ...data, id: `transaction-${transactions.length + 1}` };
          transactions.push(record);
          return record;
        },
      ),
    },
    $queryRaw: jest.fn(
      async (_query: TemplateStringsArray, ...values: unknown[]) => {
        const [responsiblePersonId, inventoryItemId] = values as [string, string];
        const quantity = balances.get(key(responsiblePersonId, inventoryItemId));
        return quantity === undefined ? [] : [{ quantity }];
      },
    ),
  };

  return {
    service: new StockService({} as never),
    tx: tx as never,
    transactions,
    attachments,
    quantity: (personId: string) =>
      balances.get(key(personId, itemId)) ?? new Prisma.Decimal(0),
    saveAttachment: (documentId: string, storedFileName: string) =>
      attachments.push({ documentId, storedFileName }),
  };
}

describe('direct-balance accounting end-to-end flow', () => {
  it('keeps imports, transfer, issue, reversal and accounting export independent', async () => {
    const ledger = createDirectBalanceHarness();
    const occurredAt = new Date('2026-07-22T10:00:00.000Z');

    // Scenario 1: CSV receipt +10 to A, then A transfers 2 to B.
    await ledger.service.createIncreasingTransactionInTx(ledger.tx, {
      type: StockTransactionType.IMPORT_RECEIPT,
      responsiblePersonId: personA,
      inventoryItemId: itemId,
      quantity: '10',
      occurredAt,
      importBatchId: 'import-a',
      accountingModel: StockAccountingModel.DIRECT_BALANCE,
      bucketKind: StockSourceKind.DIRECT,
    });
    const transfer = await ledger.service.createDecreasingTransactionInTx(
      ledger.tx,
      {
        type: StockTransactionType.MVO_TRANSFER_OUT,
        responsiblePersonId: personA,
        inventoryItemId: itemId,
        quantity: '2',
        occurredAt,
        documentId: 'transfer-a-b',
        accountingModel: StockAccountingModel.DIRECT_BALANCE,
        bucketKind: StockSourceKind.DIRECT,
      },
    );
    expect(ledger.quantity(personA).toString()).toBe('8');
    expect(ledger.quantity(personB).toString()).toBe('0');

    // Scenario 2: a later CSV receipt +5 to B is a separate event.
    await ledger.service.createIncreasingTransactionInTx(ledger.tx, {
      type: StockTransactionType.IMPORT_RECEIPT,
      responsiblePersonId: personB,
      inventoryItemId: itemId,
      quantity: '5',
      occurredAt: new Date('2026-07-23T10:00:00.000Z'),
      importBatchId: 'import-b',
      accountingModel: StockAccountingModel.DIRECT_BALANCE,
      bucketKind: StockSourceKind.DIRECT,
    });
    expect(ledger.quantity(personA).toString()).toBe('8');
    expect(ledger.quantity(personB).toString()).toBe('5');
    expect(
      ledger.transactions.find((entry) => entry.documentId === 'transfer-a-b'),
    ).toBeDefined();
    expect(
      ledger.transactions.find((entry) => entry.importBatchId === 'import-b'),
    ).toBeDefined();

    // Scenario 3: ISSUE removes one direct unit and keeps attachment metadata.
    await ledger.service.createDecreasingTransactionInTx(ledger.tx, {
      type: StockTransactionType.ISSUE_OUT,
      responsiblePersonId: personA,
      inventoryItemId: itemId,
      quantity: '1',
      occurredAt: new Date('2026-07-24T10:00:00.000Z'),
      documentId: 'issue-a',
      accountingModel: StockAccountingModel.DIRECT_BALANCE,
      bucketKind: StockSourceKind.DIRECT,
    });
    ledger.saveAttachment('issue-a', 'invoice-uuid.pdf');
    expect(ledger.quantity(personA).toString()).toBe('7');
    expect(ledger.attachments).toEqual([
      { documentId: 'issue-a', storedFileName: 'invoice-uuid.pdf' },
    ]);

    // Scenario 4: cancelling the transfer restores only A (+2), never B.
    await ledger.service.createIncreasingTransactionInTx(ledger.tx, {
      type: StockTransactionType.MVO_TRANSFER_REVERSAL,
      responsiblePersonId: personA,
      inventoryItemId: itemId,
      quantity: '2',
      occurredAt: new Date('2026-07-25T10:00:00.000Z'),
      documentId: 'transfer-a-b',
      accountingModel: StockAccountingModel.DIRECT_BALANCE,
      bucketKind: StockSourceKind.DIRECT,
      reversalOfTransactionId: transfer.id,
    });
    expect(ledger.quantity(personA).toString()).toBe('9');
    expect(ledger.quantity(personB).toString()).toBe('5');

    // Scenario 5: export is a pure read/serialization operation.
    const beforeExport = [
      ledger.quantity(personA).toString(),
      ledger.quantity(personB).toString(),
    ];
    const csv = buildAccountingTransferCsvV2([
      {
        displayNumber: 1,
        documentDate: occurredAt,
        sourcePersonnelNumber: '001',
        sourceFullName: 'МВО А',
        sourceManagementName: 'Управління А',
        destinationPersonnelNumber: '002',
        destinationFullName: 'МВО Б',
        destinationManagementName: 'Управління Б',
        inventoryCode: 'KB-1',
        inventoryName: 'Клавіатура',
        unitOfMeasure: 'шт',
        quantity: '2',
        documentStatus: 'CANCELLED',
      },
    ]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect([
      ledger.quantity(personA).toString(),
      ledger.quantity(personB).toString(),
    ]).toEqual(beforeExport);

    expect(ledger.transactions.map((entry) => entry.type)).toEqual([
      StockTransactionType.IMPORT_RECEIPT,
      StockTransactionType.MVO_TRANSFER_OUT,
      StockTransactionType.IMPORT_RECEIPT,
      StockTransactionType.ISSUE_OUT,
      StockTransactionType.MVO_TRANSFER_REVERSAL,
    ]);
    expect(ledger.transactions.every((entry) => entry.quantity.gt(0))).toBe(true);
    expect(ledger).not.toHaveProperty('custodyBalance');
  });
});
