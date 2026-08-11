import {
  IssueRealizationStatus,
  Prisma,
  PrismaClient,
  StockAccountingModel,
  StockDocumentStatus,
  StockDocumentType,
  UserRole,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { IssueRealizationsService } from './issue-realizations.service';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithPostgres = testDatabaseUrl ? describe : describe.skip;

jest.setTimeout(60_000);

describeWithPostgres(
  testDatabaseUrl
    ? 'issue realization PostgreSQL concurrency'
    : 'issue realization PostgreSQL concurrency (skipped: TEST_DATABASE_URL is not set)',
  () => {
    let firstClient: PrismaClient;
    let secondClient: PrismaClient;

    beforeAll(async () => {
      firstClient = new PrismaClient({ datasourceUrl: testDatabaseUrl });
      secondClient = new PrismaClient({ datasourceUrl: testDatabaseUrl });
      await Promise.all([firstClient.$connect(), secondClient.$connect()]);
    });

    afterAll(async () => {
      await Promise.all([firstClient.$disconnect(), secondClient.$disconnect()]);
    });

    it('allows exactly one concurrent 8 + 8 realization when only 10 is available', async () => {
      const fixture = await createFixture(firstClient);
      const first = createService(firstClient);
      const second = createService(secondClient);

      try {
        const request = {
          realizationDate: '2026-08-11',
          lines: [{ issueLineId: fixture.issueLine.id, quantity: '8' }],
        };
        const results = await Promise.allSettled([
          first.create(fixture.issue.id, request, [], fixture.actor, {}),
          second.create(fixture.issue.id, request, [], fixture.actor, {}),
        ]);
        expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
        expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);

        const aggregate = await firstClient.issueRealizationLine.aggregate({
          where: {
            issueLineId: fixture.issueLine.id,
            realization: { status: IssueRealizationStatus.POSTED },
          },
          _sum: { quantity: true },
        });
        expect(aggregate._sum.quantity?.toString()).toBe('8');
      } finally {
        await cleanupFixture(firstClient, fixture);
      }
    });
  },
);

function createService(prisma: PrismaClient) {
  return new IssueRealizationsService(prisma as never, {
    store: jest.fn(),
    assertStoredFilesExist: jest.fn(),
    removeAfterMetadataFailure: jest.fn(),
  } as never);
}

async function createFixture(prisma: PrismaClient) {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 12);
  const management = await prisma.management.create({
    data: { name: `Realization management ${suffix}`, code: `RM-${suffix}` },
  });
  const service = await prisma.service.create({
    data: {
      name: `Realization service ${suffix}`,
      code: `RS-${suffix}`,
      managementId: management.id,
    },
  });
  const source = await prisma.responsiblePerson.create({
    data: {
      lastName: 'Тестовий',
      firstName: 'Реалізатор',
      personnelNumber: `REAL-${suffix}`,
      managementId: management.id,
      serviceId: service.id,
    },
  });
  const user = await prisma.user.create({
    data: {
      username: `real-${suffix}`,
      passwordHash: 'integration-test-only',
      role: UserRole.MVO,
      isActive: true,
      mustChangePassword: false,
      responsiblePersonId: source.id,
    },
  });
  const item = await prisma.inventoryItem.create({
    data: {
      externalCode: `REAL-${suffix}`,
      name: `Тестова позиція ${suffix}`,
      unitOfMeasure: 'шт.',
    },
  });
  const issue = await prisma.stockDocument.create({
    data: {
      documentNumber: `REAL-ISSUE-${suffix}`,
      documentDate: new Date('2026-08-11'),
      type: StockDocumentType.ISSUE,
      accountingModel: StockAccountingModel.DIRECT_BALANCE,
      status: StockDocumentStatus.POSTED,
      sourceResponsiblePersonId: source.id,
      recipientName: 'Тестовий одержувач',
      createdByUserId: user.id,
      postedByUserId: user.id,
      postedAt: new Date(),
      lines: {
        create: { inventoryItemId: item.id, quantity: new Prisma.Decimal(10) },
      },
    },
    include: { lines: true },
  });
  return {
    management,
    service,
    source,
    user,
    item,
    issue,
    issueLine: issue.lines[0],
    actor: {
      id: user.id,
      username: user.username,
      role: user.role,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
      responsiblePersonId: source.id,
    },
  };
}

type Fixture = Awaited<ReturnType<typeof createFixture>>;

async function cleanupFixture(prisma: PrismaClient, fixture: Fixture) {
  await prisma.issueRealizationAttachment.deleteMany({
    where: { realization: { issueId: fixture.issue.id } },
  });
  await prisma.issueRealizationLine.deleteMany({
    where: { realization: { issueId: fixture.issue.id } },
  });
  await prisma.issueRealization.deleteMany({ where: { issueId: fixture.issue.id } });
  await prisma.securityEvent.deleteMany({ where: { actorUserId: fixture.user.id } });
  await prisma.stockDocument.delete({ where: { id: fixture.issue.id } });
  await prisma.inventoryItem.delete({ where: { id: fixture.item.id } });
  await prisma.user.delete({ where: { id: fixture.user.id } });
  await prisma.responsiblePerson.delete({ where: { id: fixture.source.id } });
  await prisma.service.delete({ where: { id: fixture.service.id } });
  await prisma.management.delete({ where: { id: fixture.management.id } });
}
