import {
  Prisma,
  StockAccountingModel,
  StockSourceKind,
  StockTransactionType,
} from '@prisma/client';
import { StockService } from './stock.service';

const personA = '11111111-1111-4111-8111-111111111111';
const personB = '22222222-2222-4222-8222-222222222222';
const personC = '33333333-3333-4333-8333-333333333333';
const itemId = '44444444-4444-4444-8444-444444444444';

type TransactionRecord = {
  id: string;
  type: StockTransactionType;
  quantity: Prisma.Decimal;
  reversalOfTransactionId?: string | null;
};

function createAccountingHarness() {
  const direct = new Map<string, Prisma.Decimal>();
  const custody = new Map<string, Prisma.Decimal>();
  const transactions: TransactionRecord[] = [];
  const directKey = (personId: string, inventoryItemId: string) =>
    `${personId}:${inventoryItemId}`;
  const custodyKey = (ownerId: string, custodianId: string, inventoryItemId: string) =>
    `${ownerId}:${custodianId}:${inventoryItemId}`;

  const tx = {
    responsiblePerson: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        [personA, personB, personC].includes(where.id) ? { id: where.id } : null,
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
          const key = directKey(ids.responsiblePersonId, ids.inventoryItemId);
          if (!direct.has(key)) direct.set(key, new Prisma.Decimal(0));
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
          direct.set(
            directKey(ids.responsiblePersonId, ids.inventoryItemId),
            data.quantity,
          );
        },
      ),
    },
    custodyBalance: {
      upsert: jest.fn(
        async ({
          where,
        }: {
          where: {
            inventoryItemId_accountingOwnerResponsiblePersonId_custodianResponsiblePersonId: {
              inventoryItemId: string;
              accountingOwnerResponsiblePersonId: string;
              custodianResponsiblePersonId: string;
            };
          };
        }) => {
          const ids =
            where.inventoryItemId_accountingOwnerResponsiblePersonId_custodianResponsiblePersonId;
          const key = custodyKey(
            ids.accountingOwnerResponsiblePersonId,
            ids.custodianResponsiblePersonId,
            ids.inventoryItemId,
          );
          if (!custody.has(key)) custody.set(key, new Prisma.Decimal(0));
        },
      ),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: {
            inventoryItemId_accountingOwnerResponsiblePersonId_custodianResponsiblePersonId: {
              inventoryItemId: string;
              accountingOwnerResponsiblePersonId: string;
              custodianResponsiblePersonId: string;
            };
          };
          data: { quantity: Prisma.Decimal };
        }) => {
          const ids =
            where.inventoryItemId_accountingOwnerResponsiblePersonId_custodianResponsiblePersonId;
          custody.set(
            custodyKey(
              ids.accountingOwnerResponsiblePersonId,
              ids.custodianResponsiblePersonId,
              ids.inventoryItemId,
            ),
            data.quantity,
          );
        },
      ),
    },
    stockTransaction: {
      create: jest.fn(
        async ({ data }: { data: Omit<TransactionRecord, 'id'> }) => {
          const record = {
            ...data,
            id: `transaction-${transactions.length + 1}`,
          };
          transactions.push(record);
          return record;
        },
      ),
    },
    $queryRaw: jest.fn(
      async (_query: TemplateStringsArray, ...values: unknown[]) => {
        if (values.length === 2) {
          const [responsiblePersonId, inventoryItemId] = values as [string, string];
          const quantity = direct.get(
            directKey(responsiblePersonId, inventoryItemId),
          );
          return quantity ? [{ quantity }] : [];
        }
        const [inventoryItemId, ownerId, custodianId] = values as [
          string,
          string,
          string,
        ];
        const quantity = custody.get(
          custodyKey(ownerId, custodianId, inventoryItemId),
        );
        return quantity ? [{ quantity }] : [];
      },
    ),
  };

  return {
    service: new StockService({} as never),
    tx,
    transactions,
    directQuantity: (personId: string) =>
      direct.get(directKey(personId, itemId)) ?? new Prisma.Decimal(0),
    custodyQuantity: (ownerId: string, custodianId: string) =>
      custody.get(custodyKey(ownerId, custodianId, itemId)) ??
      new Prisma.Decimal(0),
  };
}

describe('owner/custody accounting end-to-end flow', () => {
  it('keeps one accounting owner through import, assignment, reassignment, issue and cancellation', async () => {
    const ledger = createAccountingHarness();
    const tx = ledger.tx as never;
    const occurredAt = new Date('2026-07-20T10:00:00.000Z');

    await ledger.service.createIncreasingTransactionInTx(tx, {
      type: StockTransactionType.INITIAL_BALANCE,
      responsiblePersonId: personA,
      inventoryItemId: itemId,
      quantity: '4',
      occurredAt,
      accountingModel: StockAccountingModel.OWNER_CUSTODY,
      bucketKind: StockSourceKind.DIRECT,
      accountingOwnerResponsiblePersonId: personA,
    });
    expect(ledger.directQuantity(personA).toString()).toBe('4');

    await ledger.service.createDecreasingTransactionInTx(tx, {
      type: StockTransactionType.ASSIGNMENT_OUT_DIRECT,
      responsiblePersonId: personA,
      inventoryItemId: itemId,
      quantity: '2',
      occurredAt,
      accountingModel: StockAccountingModel.OWNER_CUSTODY,
      bucketKind: StockSourceKind.DIRECT,
      accountingOwnerResponsiblePersonId: personA,
      sourceCustodianResponsiblePersonId: personA,
      destinationCustodianResponsiblePersonId: personB,
    });
    await ledger.service.createCustodyIncreasingTransactionInTx(tx, {
      type: StockTransactionType.ASSIGNMENT_IN_CUSTODY,
      accountingOwnerResponsiblePersonId: personA,
      custodianResponsiblePersonId: personB,
      inventoryItemId: itemId,
      quantity: '2',
      occurredAt,
      sourceCustodianResponsiblePersonId: personA,
      destinationCustodianResponsiblePersonId: personB,
    });
    expect(ledger.directQuantity(personA).toString()).toBe('2');
    expect(ledger.directQuantity(personB).toString()).toBe('0');
    expect(ledger.custodyQuantity(personA, personB).toString()).toBe('2');

    await ledger.service.createCustodyDecreasingTransactionInTx(tx, {
      type: StockTransactionType.ASSIGNMENT_OUT_CUSTODY,
      accountingOwnerResponsiblePersonId: personA,
      custodianResponsiblePersonId: personB,
      inventoryItemId: itemId,
      quantity: '1',
      occurredAt,
      sourceCustodianResponsiblePersonId: personB,
      destinationCustodianResponsiblePersonId: personC,
    });
    await ledger.service.createCustodyIncreasingTransactionInTx(tx, {
      type: StockTransactionType.ASSIGNMENT_IN_CUSTODY,
      accountingOwnerResponsiblePersonId: personA,
      custodianResponsiblePersonId: personC,
      inventoryItemId: itemId,
      quantity: '1',
      occurredAt,
      sourceCustodianResponsiblePersonId: personB,
      destinationCustodianResponsiblePersonId: personC,
    });
    expect(ledger.custodyQuantity(personA, personB).toString()).toBe('1');
    expect(ledger.custodyQuantity(personA, personC).toString()).toBe('1');
    expect(ledger.directQuantity(personC).toString()).toBe('0');

    await ledger.service.createDecreasingTransactionInTx(tx, {
      type: StockTransactionType.ISSUE_FROM_DIRECT,
      responsiblePersonId: personA,
      inventoryItemId: itemId,
      quantity: '1',
      occurredAt,
      accountingModel: StockAccountingModel.OWNER_CUSTODY,
      bucketKind: StockSourceKind.DIRECT,
      accountingOwnerResponsiblePersonId: personA,
      sourceCustodianResponsiblePersonId: personA,
    });
    const issuedFromCustody =
      await ledger.service.createCustodyDecreasingTransactionInTx(tx, {
        type: StockTransactionType.ISSUE_FROM_CUSTODY,
        accountingOwnerResponsiblePersonId: personA,
        custodianResponsiblePersonId: personB,
        inventoryItemId: itemId,
        quantity: '1',
        occurredAt,
        sourceCustodianResponsiblePersonId: personB,
      });
    expect(ledger.directQuantity(personA).toString()).toBe('1');
    expect(ledger.custodyQuantity(personA, personB).toString()).toBe('0');

    await ledger.service.createCustodyIncreasingTransactionInTx(tx, {
      type: StockTransactionType.ISSUE_REVERSAL,
      accountingOwnerResponsiblePersonId: personA,
      custodianResponsiblePersonId: personB,
      inventoryItemId: itemId,
      quantity: '1',
      occurredAt,
      sourceCustodianResponsiblePersonId: personB,
      reversalOfTransactionId: issuedFromCustody.id,
    });

    const assignedOut = ledger
      .custodyQuantity(personA, personB)
      .plus(ledger.custodyQuantity(personA, personC));
    const totalAccounted = ledger.directQuantity(personA).plus(assignedOut);
    expect(ledger.custodyQuantity(personA, personB).toString()).toBe('1');
    expect(assignedOut.toString()).toBe('2');
    expect(totalAccounted.toString()).toBe('3');
    expect(ledger.directQuantity(personB).toString()).toBe('0');
    expect(ledger.directQuantity(personC).toString()).toBe('0');
    expect(
      ledger.transactions.every((transaction) => transaction.quantity.gt(0)),
    ).toBe(true);
    expect(
      ledger.transactions[ledger.transactions.length - 1]
        ?.reversalOfTransactionId,
    ).toBe(issuedFromCustody.id);
  });
});
