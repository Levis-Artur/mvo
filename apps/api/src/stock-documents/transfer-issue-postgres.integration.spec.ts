import {
  Prisma,
  PrismaClient,
  StockDocumentStatus,
  StockDocumentType,
  UserRole,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { StockService } from '../stock/stock.service';
import { StockDocumentsService } from './stock-documents.service';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithPostgres = testDatabaseUrl ? describe : describe.skip;

jest.setTimeout(60_000);

describeWithPostgres(
  testDatabaseUrl
    ? 'standalone ISSUE PostgreSQL concurrency'
    : 'standalone ISSUE PostgreSQL concurrency (skipped: TEST_DATABASE_URL is not set)',
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

  it('allows only one concurrent ISSUE when both requests exceed direct stock together', async () => {
    const fixture = await createFixture(firstClient);
    const firstService = createService(firstClient);
    const secondService = createService(secondClient);
    const file = attachmentFile();

    try {
      const results = await Promise.allSettled([
        firstService.createAndPostIssue(
          issueDto(fixture.balance.id, fixture.item.id, '4'),
          [file],
          fixture.actor,
          { requestId: `issue-a-${fixture.suffix}` },
        ),
        secondService.createAndPostIssue(
          issueDto(fixture.balance.id, fixture.item.id, '4'),
          [file],
          fixture.actor,
          { requestId: `issue-b-${fixture.suffix}` },
        ),
      ]);

      expect(
        results.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        results.filter((result) => result.status === 'rejected'),
      ).toHaveLength(1);

      const postedLines = await firstClient.stockDocumentLine.findMany({
        where: {
          sourceBalanceId: fixture.balance.id,
          sourceTransferLineId: null,
          document: {
            type: StockDocumentType.ISSUE,
            status: StockDocumentStatus.POSTED,
          },
        },
        select: { quantity: true },
      });
      const issued = postedLines.reduce(
        (sum, line) => sum.plus(line.quantity),
        new Prisma.Decimal(0),
      );
      expect(issued.toString()).toBe('4');

      const balance = await firstClient.stockBalance.findUniqueOrThrow({
        where: { id: fixture.balance.id },
      });
      expect(balance.quantity.toString()).toBe('1');
    } finally {
      await cleanupFixture(firstClient, fixture);
    }
  });
  },
);

function createService(prisma: PrismaClient) {
  const storage = {
    store: jest.fn(async (file: Express.Multer.File) => ({
      originalFileName: file.originalname,
      storedFileName: `${randomUUID()}.pdf`,
      mimeType: 'application/pdf',
      sizeBytes: file.size,
      sha256: randomUUID().replace(/-/g, '').padEnd(64, '0'),
      storagePath: `${randomUUID()}.pdf`,
    })),
    assertStoredFilesExist: jest.fn(),
    removeAfterMetadataFailure: jest.fn(),
  };
  return new StockDocumentsService(
    prisma as never,
    new StockService(prisma as never),
    storage as never,
  );
}

async function createFixture(prisma: PrismaClient) {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 12);
  const management = await prisma.management.create({
    data: { name: `Issue management ${suffix}`, code: `IM-${suffix}` },
  });
  const service = await prisma.service.create({
    data: {
      name: `Issue service ${suffix}`,
      code: `IS-${suffix}`,
      managementId: management.id,
    },
  });
  const source = await prisma.responsiblePerson.create({
      data: {
        lastName: 'Тестовий',
        firstName: 'Відправник',
        externalAccountingCode: suffix.slice(0, 4),
        managementId: management.id,
        serviceId: service.id,
      },
    });
  const user = await prisma.user.create({
    data: {
      username: `issue-${suffix}`,
      passwordHash: 'integration-test-only',
      role: UserRole.MVO,
      isActive: true,
      mustChangePassword: false,
      responsiblePersonId: source.id,
    },
  });
  const item = await prisma.inventoryItem.create({
    data: {
      externalCode: `ISSUE-${suffix}`,
      name: `Тестова позиція ${suffix}`,
      unitOfMeasure: 'шт',
    },
  });
  const balance = await prisma.stockBalance.create({
    data: {
      responsiblePersonId: source.id,
      inventoryItemId: item.id,
      quantity: new Prisma.Decimal(5),
    },
  });
  return {
    suffix,
    management,
    service,
    source,
    user,
    item,
    balance,
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

function issueDto(
  sourceBalanceId: string,
  inventoryItemId: string,
  quantity: string,
) {
  return {
    documentDate: '2026-08-10T00:00:00.000Z',
    recipientName: 'Зовнішній одержувач',
    lines: [{ sourceBalanceId, inventoryItemId, quantity }],
  };
}

function attachmentFile(): Express.Multer.File {
  const buffer = Buffer.from('%PDF-1.7 invoice');
  return {
    fieldname: 'files',
    originalname: 'invoice.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: buffer.length,
    buffer,
    destination: '',
    filename: '',
    path: '',
    stream: null as never,
  };
}

async function cleanupFixture(prisma: PrismaClient, fixture: Fixture) {
  await prisma.stockTransaction.deleteMany({
    where: { responsiblePersonId: fixture.source.id },
  });
  await prisma.stockDocumentAttachment.deleteMany({
    where: { document: { createdByUserId: fixture.user.id } },
  });
  await prisma.stockDocument.deleteMany({
    where: {
      createdByUserId: fixture.user.id,
      type: StockDocumentType.ISSUE,
    },
  });
  await prisma.securityEvent.deleteMany({
    where: { actorUserId: fixture.user.id },
  });
  await prisma.stockBalance.delete({ where: { id: fixture.balance.id } });
  await prisma.inventoryItem.delete({ where: { id: fixture.item.id } });
  await prisma.user.delete({ where: { id: fixture.user.id } });
  await prisma.responsiblePerson.delete({ where: { id: fixture.source.id } });
  await prisma.service.delete({ where: { id: fixture.service.id } });
  await prisma.management.delete({ where: { id: fixture.management.id } });
}
