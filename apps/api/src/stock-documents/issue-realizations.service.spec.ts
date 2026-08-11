import {
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  IssueRealizationStatus,
  Prisma,
  StockAccountingModel,
  StockDocumentStatus,
  StockDocumentType,
  UserRole,
} from '@prisma/client';
import { IssueRealizationsService } from './issue-realizations.service';

const issueId = '11111111-1111-4111-8111-111111111111';
const issueLineId = '22222222-2222-4222-8222-222222222222';
const realizationId = '33333333-3333-4333-8333-333333333333';
const sourceId = '44444444-4444-4444-8444-444444444444';
const actorId = '55555555-5555-4555-8555-555555555555';

const actor = {
  id: actorId,
  username: 'mvo-a',
  role: UserRole.MVO,
  isActive: true,
  mustChangePassword: false,
  responsiblePersonId: sourceId,
};

function issue() {
  return {
    id: issueId,
    type: StockDocumentType.ISSUE,
    status: StockDocumentStatus.POSTED,
    accountingModel: StockAccountingModel.DIRECT_BALANCE,
    sourceTransferId: null,
    sourceResponsiblePersonId: sourceId,
    lines: [{ id: issueLineId, quantity: new Prisma.Decimal(10) }],
  };
}

function realization(
  status: IssueRealizationStatus = IssueRealizationStatus.POSTED,
) {
  return {
    id: realizationId,
    issueId,
    displayNumber: 1,
    realizationDate: new Date('2026-08-11T00:00:00.000Z'),
    recipientText: null,
    note: null,
    status,
    createdByUserId: actorId,
    cancelledByUserId:
      status === IssueRealizationStatus.CANCELLED ? actorId : null,
    createdAt: new Date('2026-08-11T09:00:00.000Z'),
    updatedAt: new Date('2026-08-11T09:00:00.000Z'),
    cancelledAt:
      status === IssueRealizationStatus.CANCELLED
        ? new Date('2026-08-11T10:00:00.000Z')
        : null,
    createdByUser: { id: actorId, username: 'mvo-a', role: UserRole.MVO },
    cancelledByUser: null,
    lines: [
      {
        id: '66666666-6666-4666-8666-666666666666',
        realizationId,
        issueLineId,
        quantity: new Prisma.Decimal(8),
        createdAt: new Date('2026-08-11T09:00:00.000Z'),
        issueLine: {
          inventoryItem: {
            id: '77777777-7777-4777-8777-777777777777',
            externalCode: 'KB-1',
            name: 'Клавіатура',
            unitOfMeasure: 'шт.',
          },
        },
      },
    ],
    attachments: [],
  };
}

function harness() {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    stockDocument: { findUnique: jest.fn().mockResolvedValue(issue()) },
    issueRealizationLine: { groupBy: jest.fn().mockResolvedValue([]) },
    issueRealization: {
      create: jest.fn().mockResolvedValue(realization()),
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn().mockResolvedValue(
        realization(IssueRealizationStatus.CANCELLED),
      ),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    securityEvent: { create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    ),
    stockDocument: {
      findUnique: jest.fn().mockResolvedValue({
        type: StockDocumentType.ISSUE,
        sourceResponsiblePersonId: sourceId,
      }),
    },
    issueRealization: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findFirst: jest.fn(),
    },
    issueRealizationAttachment: { findFirst: jest.fn() },
  };
  const storage = {
    store: jest.fn(),
    assertStoredFilesExist: jest.fn(),
    removeAfterMetadataFailure: jest.fn(),
    createDownloadStream: jest.fn(),
  };
  return {
    service: new IssueRealizationsService(prisma as never, storage as never),
    prisma,
    tx,
    storage,
  };
}

describe('IssueRealizationsService', () => {
  it('creates a POSTED partial realization without touching stock', async () => {
    const h = harness();
    const result = await h.service.create(
      issueId,
      {
        realizationDate: '2026-08-11',
        lines: [{ issueLineId, quantity: '8' }],
      },
      [],
      actor,
      { requestId: 'realize-1' },
    );

    expect(result.status).toBe(IssueRealizationStatus.POSTED);
    expect(result.totalQuantity).toBe('8');
    expect(h.tx.issueRealization.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          issueId,
          status: IssueRealizationStatus.POSTED,
          lines: {
            create: [
              expect.objectContaining({
                issueLineId,
                quantity: new Prisma.Decimal(8),
              }),
            ],
          },
        }),
      }),
    );
    expect(h.tx.$queryRaw).toHaveBeenCalled();
    expect(h.tx.issueRealizationLine.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          realization: {
            issueId,
            status: IssueRealizationStatus.POSTED,
          },
        }),
      }),
    );
    expect(h.tx).not.toHaveProperty('stockBalance');
    expect(h.tx).not.toHaveProperty('stockTransaction');
    expect(h.tx).not.toHaveProperty('custodyBalance');
  });

  it('rejects over-realization using the active sum inside the transaction', async () => {
    const h = harness();
    h.tx.issueRealizationLine.groupBy.mockResolvedValue([
      { issueLineId, _sum: { quantity: new Prisma.Decimal(4) } },
    ]);

    await expect(
      h.service.create(
        issueId,
        {
          realizationDate: '2026-08-11',
          lines: [{ issueLineId, quantity: '8' }],
        },
        [],
        actor,
        {},
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(h.tx.issueRealization.create).not.toHaveBeenCalled();
  });

  it('allows a second partial realization when the active sum remains within ISSUE quantity', async () => {
    const h = harness();
    h.tx.stockDocument.findUnique.mockResolvedValue({
      ...issue(),
      lines: [{ id: issueLineId, quantity: new Prisma.Decimal(50) }],
    });
    h.tx.issueRealizationLine.groupBy.mockResolvedValue([
      { issueLineId, _sum: { quantity: new Prisma.Decimal(20) } },
    ]);

    await expect(
      h.service.create(
        issueId,
        {
          realizationDate: '2026-08-12',
          lines: [{ issueLineId, quantity: '10' }],
        },
        [],
        actor,
        {},
      ),
    ).resolves.toEqual(expect.objectContaining({ status: 'POSTED' }));
  });

  it.each(['0', '-1'])('rejects a non-positive quantity %s', async (quantity) => {
    const h = harness();
    await expect(
      h.service.create(
        issueId,
        {
          realizationDate: '2026-08-11',
          lines: [{ issueLineId, quantity }],
        },
        [],
        actor,
        {},
      ),
    ).rejects.toThrow('Кількість реалізації має бути більшою за нуль');
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('supports multiple ISSUE lines and persists secure attachment metadata', async () => {
    const h = harness();
    const secondLineId = '99999999-9999-4999-8999-999999999999';
    h.tx.stockDocument.findUnique.mockResolvedValue({
      ...issue(),
      lines: [
        ...issue().lines,
        { id: secondLineId, quantity: new Prisma.Decimal(5) },
      ],
    });
    h.storage.store.mockResolvedValue({
      originalFileName: 'акт.pdf',
      storedFileName: 'uuid.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 12,
      sha256: 'a'.repeat(64),
      storagePath: 'uuid.pdf',
    });
    const file = { originalname: 'акт.pdf' } as Express.Multer.File;

    await h.service.create(
      issueId,
      {
        realizationDate: '2026-08-11',
        lines: [
          { issueLineId, quantity: '3' },
          { issueLineId: secondLineId, quantity: '2' },
        ],
      },
      [file],
      actor,
      {},
    );

    expect(h.storage.store).toHaveBeenCalledWith(file);
    expect(h.tx.issueRealization.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lines: { create: expect.arrayContaining([
            expect.objectContaining({ issueLineId, quantity: new Prisma.Decimal(3) }),
            expect.objectContaining({ issueLineId: secondLineId, quantity: new Prisma.Decimal(2) }),
          ]) },
          attachments: {
            create: [expect.objectContaining({ storedFileName: 'uuid.pdf' })],
          },
        }),
      }),
    );
  });

  it('does not allow another MVO to realize the issue', async () => {
    const h = harness();
    await expect(
      h.service.create(
        issueId,
        {
          realizationDate: '2026-08-11',
          lines: [{ issueLineId, quantity: '1' }],
        },
        [],
        { ...actor, responsiblePersonId: '88888888-8888-4888-8888-888888888888' },
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows OWNER global read and denies another MVO', async () => {
    const h = harness();
    h.prisma.stockDocument.findUnique.mockResolvedValue({
      type: StockDocumentType.ISSUE,
      sourceResponsiblePersonId: sourceId,
    });
    await expect(
      h.service.list(issueId, { page: 1, limit: 25 }, {
        ...actor,
        role: UserRole.OWNER,
        responsiblePersonId: null,
      }),
    ).resolves.toEqual(expect.objectContaining({ items: [] }));
    await expect(
      h.service.list(issueId, { page: 1, limit: 25 }, {
        ...actor,
        responsiblePersonId: '88888888-8888-4888-8888-888888888888',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('cancels idempotently and never restores StockBalance', async () => {
    const h = harness();
    h.tx.issueRealization.findFirst.mockResolvedValue({
      ...realization(),
      issue: { sourceResponsiblePersonId: sourceId },
    });

    const result = await h.service.cancel(
      issueId,
      realizationId,
      actor,
      {},
    );

    expect(result.status).toBe(IssueRealizationStatus.CANCELLED);
    expect(h.tx.issueRealization.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: realizationId,
          status: IssueRealizationStatus.POSTED,
        },
      }),
    );
    expect(h.tx).not.toHaveProperty('stockBalance');
    expect(h.tx).not.toHaveProperty('stockTransaction');
  });
});
