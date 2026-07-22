import {
  AccountingExportState,
  Prisma,
  PrismaClient,
  StockAccountingModel,
  StockDocumentStatus,
  StockDocumentType,
  StockSourceKind,
  UserRole,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AccountingService } from './accounting.service';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithPostgres = testDatabaseUrl ? describe : describe.skip;

jest.setTimeout(60_000);

describeWithPostgres('AccountingService PostgreSQL integration', () => {
  const firstClient = new PrismaClient({ datasourceUrl: testDatabaseUrl });
  const secondClient = new PrismaClient({ datasourceUrl: testDatabaseUrl });

  beforeAll(async () => {
    await Promise.all([firstClient.$connect(), secondClient.$connect()]);
  });

  afterAll(async () => {
    await Promise.all([firstClient.$disconnect(), secondClient.$disconnect()]);
  });

  it('claims concurrent exports without duplicate or partial batches', async () => {
    const fixture = await createFixture(firstClient);
    try {
      const documents = await Promise.all([
        createDocument(firstClient, fixture, {}),
        createDocument(firstClient, fixture, {}),
        createDocument(firstClient, fixture, {}),
      ]);
      const beforeBalances = await balanceSnapshot(firstClient, fixture);
      const firstService = new AccountingService(firstClient as never);
      const secondService = new AccountingService(secondClient as never);

      const results = await Promise.allSettled([
        firstService.exportTransfers({}, fixture.actor, {
          requestId: `concurrent-a-${fixture.suffix}`,
        }),
        secondService.exportTransfers({}, fixture.actor, {
          requestId: `concurrent-b-${fixture.suffix}`,
        }),
      ]);

      expect(results.some((result) => result.status === 'fulfilled')).toBe(true);
      const batches = await firstClient.accountingTransferExportBatch.findMany({
        where: { createdByUserId: fixture.user.id },
        include: { documents: true, rows: true },
      });
      expect(batches.length).toBeGreaterThan(0);

      const links = batches.flatMap((batch) => batch.documents);
      expect(new Set(links.map((link) => link.documentId)).size).toBe(
        links.length,
      );
      for (const batch of batches) {
        expect(batch.documentCount).toBeGreaterThan(0);
        expect(batch.rowCount).toBeGreaterThan(0);
        expect(batch.documentCount).toBe(batch.documents.length);
        expect(batch.rowCount).toBe(batch.rows.length);
        for (const row of batch.rows) {
          expect(
            batch.documents.some(
              (link) => link.documentId === row.documentId,
            ),
          ).toBe(true);
        }
      }

      const persistedDocuments = await firstClient.stockDocument.findMany({
        where: { id: { in: documents.map((document) => document.id) } },
        include: { accountingExportBatches: true },
      });
      for (const document of persistedDocuments) {
        expect(document.accountingExportState).toBe(
          AccountingExportState.EXPORTED,
        );
        expect(document.accountingExportBatches).toHaveLength(1);
        expect(
          batches.some((batch) =>
            batch.rows.some((row) => row.documentId === document.id),
          ),
        ).toBe(true);
      }
      expect(await balanceSnapshot(firstClient, fixture)).toEqual(beforeBalances);
    } finally {
      await cleanupFixture(firstClient, fixture);
    }
  });

  it('exports only eligible documents and keeps all lines of a matched document', async () => {
    const fixture = await createFixture(firstClient);
    try {
      const eligible = await createDocument(firstClient, fixture, {
        inventoryItemIds: [fixture.items[0].id, fixture.items[1].id],
      });
      const excluded = await Promise.all([
        createDocument(firstClient, fixture, {
          status: StockDocumentStatus.DRAFT,
        }),
        createDocument(firstClient, fixture, {
          status: StockDocumentStatus.CANCELLED,
        }),
        createDocument(firstClient, fixture, {
          accountingExportState: AccountingExportState.EXPORTED,
        }),
        createDocument(firstClient, fixture, {
          type: StockDocumentType.ISSUE,
        }),
        createDocument(firstClient, fixture, {
          type: StockDocumentType.ASSIGNMENT,
        }),
        createDocument(firstClient, fixture, {
          type: StockDocumentType.TRANSFER,
        }),
      ]);
      const service = new AccountingService(firstClient as never);

      await service.exportTransfers(
        { inventoryItemId: fixture.items[0].id },
        fixture.actor,
        { requestId: `exclusions-${fixture.suffix}` },
      );

      const batch = await firstClient.accountingTransferExportBatch.findFirstOrThrow({
        where: { createdByUserId: fixture.user.id },
        include: { documents: true, rows: true },
      });
      expect(batch.documents.map((link) => link.documentId)).toEqual([
        eligible.id,
      ]);
      expect(batch.rows).toHaveLength(2);
      expect(new Set(batch.rows.map((row) => row.inventoryCode))).toEqual(
        new Set(fixture.items.map((item) => item.externalCode)),
      );

      const states = await firstClient.stockDocument.findMany({
        where: { id: { in: [eligible.id, ...excluded.map((item) => item.id)] } },
        select: { id: true, accountingExportState: true },
      });
      expect(states.find((item) => item.id === eligible.id)?.accountingExportState)
        .toBe(AccountingExportState.EXPORTED);
      for (const document of excluded) {
        const expected = document.accountingExportState;
        expect(states.find((item) => item.id === document.id)?.accountingExportState)
          .toBe(expected);
      }
    } finally {
      await cleanupFixture(firstClient, fixture);
    }
  });
});

async function createFixture(prisma: PrismaClient) {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 12);
  const management = await prisma.management.create({
    data: { name: `Test management ${suffix}`, code: `TM-${suffix}` },
  });
  const service = await prisma.service.create({
    data: {
      name: `Test service ${suffix}`,
      code: `TS-${suffix}`,
      managementId: management.id,
    },
  });
  const [source, destination] = await Promise.all([
    prisma.responsiblePerson.create({
      data: {
        lastName: 'Тестовий',
        firstName: 'Відправник',
        personnelNumber: `SRC-${suffix}`,
        managementId: management.id,
        serviceId: service.id,
      },
    }),
    prisma.responsiblePerson.create({
      data: {
        lastName: 'Тестовий',
        firstName: 'Одержувач',
        personnelNumber: `DST-${suffix}`,
        managementId: management.id,
        serviceId: service.id,
      },
    }),
  ]);
  const user = await prisma.user.create({
    data: {
      username: `accounting-${suffix}`,
      passwordHash: 'integration-test-only',
      role: UserRole.ACCOUNTANT,
      isActive: true,
      mustChangePassword: false,
    },
  });
  const items = await Promise.all([0, 1].map((index) =>
    prisma.inventoryItem.create({
      data: {
        externalCode: `EXP-${suffix}-${index}`,
        name: `Тестова номенклатура ${index}`,
        unitOfMeasure: 'шт',
      },
    }),
  ));
  const balances = await Promise.all(
    [source, destination].flatMap((person, personIndex) =>
      items.map((item, itemIndex) =>
        prisma.stockBalance.create({
          data: {
            responsiblePersonId: person.id,
            inventoryItemId: item.id,
            quantity: new Prisma.Decimal(10 + personIndex + itemIndex),
          },
        }),
      ),
    ),
  );
  return {
    suffix,
    management,
    service,
    source,
    destination,
    user,
    items,
    balances,
    actor: {
      id: user.id,
      username: user.username,
      role: user.role,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
      responsiblePersonId: user.responsiblePersonId,
    },
  };
}

type Fixture = Awaited<ReturnType<typeof createFixture>>;

async function createDocument(
  prisma: PrismaClient,
  fixture: Fixture,
  options: {
    type?: StockDocumentType;
    status?: StockDocumentStatus;
    accountingExportState?: AccountingExportState;
    inventoryItemIds?: string[];
  },
) {
  const type = options.type ?? StockDocumentType.MVO_TRANSFER;
  const status = options.status ?? StockDocumentStatus.POSTED;
  const accountingExportState =
    options.accountingExportState ?? AccountingExportState.NOT_EXPORTED;
  const posted = status !== StockDocumentStatus.DRAFT;
  const cancelled = status === StockDocumentStatus.CANCELLED;
  const inventoryItemIds = options.inventoryItemIds ?? [fixture.items[0].id];
  return prisma.stockDocument.create({
    data: {
      documentNumber: `integration-${randomUUID()}`,
      documentDate: new Date('2026-07-22T00:00:00.000Z'),
      type,
      status,
      accountingExportState,
      accountingModel:
        type === StockDocumentType.MVO_TRANSFER
          ? StockAccountingModel.DIRECT_BALANCE
          : StockAccountingModel.LEGACY_BALANCE,
      sourceResponsiblePersonId: fixture.source.id,
      destinationResponsiblePersonId:
        type === StockDocumentType.ISSUE ? null : fixture.destination.id,
      recipientName:
        type === StockDocumentType.ISSUE ? 'Зовнішній одержувач' : null,
      basis: type === StockDocumentType.ISSUE ? 'Тестова підстава' : null,
      createdByUserId: fixture.user.id,
      postedByUserId: posted ? fixture.user.id : null,
      postedAt: posted ? new Date('2026-07-22T10:00:00.000Z') : null,
      cancelledByUserId: cancelled ? fixture.user.id : null,
      cancelledAt: cancelled ? new Date('2026-07-22T11:00:00.000Z') : null,
      exportedByUserId:
        accountingExportState === AccountingExportState.EXPORTED
          ? fixture.user.id
          : null,
      exportedAt:
        accountingExportState === AccountingExportState.EXPORTED
          ? new Date('2026-07-22T12:00:00.000Z')
          : null,
      lines: {
        create: inventoryItemIds.map((inventoryItemId, index) => ({
          inventoryItemId,
          sourceKind: StockSourceKind.DIRECT,
          sourceBalanceId: fixture.balances.find(
            (balance) =>
              balance.responsiblePersonId === fixture.source.id &&
              balance.inventoryItemId === inventoryItemId,
          )!.id,
          quantity: new Prisma.Decimal(index + 1),
          quantityBefore: new Prisma.Decimal(10),
          quantityAfter: new Prisma.Decimal(9 - index),
        })),
      },
    },
  });
}

async function balanceSnapshot(prisma: PrismaClient, fixture: Fixture) {
  const balances = await prisma.stockBalance.findMany({
    where: { id: { in: fixture.balances.map((balance) => balance.id) } },
    orderBy: { id: 'asc' },
  });
  return balances.map((balance) => ({
    id: balance.id,
    quantity: balance.quantity.toString(),
  }));
}

async function cleanupFixture(prisma: PrismaClient, fixture: Fixture) {
  await prisma.$transaction([
    prisma.securityEvent.deleteMany({ where: { actorUserId: fixture.user.id } }),
    prisma.accountingTransferExportBatch.deleteMany({
      where: { createdByUserId: fixture.user.id },
    }),
    prisma.stockDocument.deleteMany({
      where: { createdByUserId: fixture.user.id },
    }),
    prisma.stockBalance.deleteMany({
      where: { id: { in: fixture.balances.map((balance) => balance.id) } },
    }),
    prisma.inventoryItem.deleteMany({
      where: { id: { in: fixture.items.map((item) => item.id) } },
    }),
    prisma.user.delete({ where: { id: fixture.user.id } }),
    prisma.responsiblePerson.deleteMany({
      where: { id: { in: [fixture.source.id, fixture.destination.id] } },
    }),
    prisma.service.delete({ where: { id: fixture.service.id } }),
    prisma.management.delete({ where: { id: fixture.management.id } }),
  ]);
}
