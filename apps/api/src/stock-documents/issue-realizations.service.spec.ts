import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
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
import { AccessControlService } from '../auth/access-control.service';

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
    responsiblePerson: { findFirst: jest.fn().mockResolvedValue({ id: sourceId }) },
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
      findFirst: jest.fn().mockResolvedValue({ id: issueId }),
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
    responsiblePerson: { findFirst: jest.fn().mockResolvedValue({ id: sourceId }) },
    securityEvent: { create: jest.fn() },
  };
  const storage = {
    store: jest.fn(),
    assertStoredFilesExist: jest.fn(),
    removeAfterMetadataFailure: jest.fn(),
    createDownloadStream: jest.fn(),
  };
  return {
    service: new IssueRealizationsService(prisma as never, storage as never, new AccessControlService(prisma as never)),
    prisma,
    tx,
    storage,
  };
}

describe('manager realization attachment read scope', () => {
  it.each(['PREVIEW', 'DOWNLOAD'] as const)('permits scoped %s and rejects foreign attachments before storage', async (action) => {
    const h = harness();
    const manager = { ...actor, role: UserRole.ORG_MANAGER, responsiblePersonId: null,
      accessScopes: [{ managementId: 'manager-management', serviceCode: null }] };
    h.prisma.issueRealizationAttachment.findFirst.mockResolvedValue({
      id: 'attachment', originalFileName: 'реалізація.pdf', mimeType: 'application/pdf',
      sizeBytes: 100, storagePath: 'private.pdf',
    });
    await expect(h.service.attachment(issueId, realizationId, 'attachment', manager, {}, action)).resolves.toBeDefined();
    expect(h.prisma.stockDocument.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: [{ id: issueId }, { OR: [
        { sourceResponsiblePerson: { OR: [{ managementId: 'manager-management' }] } },
        { destinationResponsiblePerson: { OR: [{ managementId: 'manager-management' }] } },
      ] }] },
    }));
    h.storage.assertStoredFilesExist.mockClear();
    h.storage.createDownloadStream.mockClear();
    h.prisma.stockDocument.findFirst.mockResolvedValueOnce(null as never);
    await expect(h.service.attachment(issueId, realizationId, 'attachment', manager, {}, action)).rejects.toBeInstanceOf(NotFoundException);
    expect(h.storage.assertStoredFilesExist).not.toHaveBeenCalled();
    expect(h.storage.createDownloadStream).not.toHaveBeenCalled();
  });
});

describe('IssueRealizationsService', () => {
  it('creates realization for any active OWNER target regardless of scopes and keeps OWNER attribution', async () => {
    const h = harness();
    const owner = { ...actor, id: 'owner-user', role: UserRole.OWNER, responsiblePersonId: null,
      accessScopes: [{ managementId: 'unrelated-management', serviceCode: null }] };
    await h.service.create(issueId, { realizationDate: '2026-08-11', targetResponsiblePersonId: sourceId,
      lines: [{ issueLineId, quantity: '2' }] }, [], owner, {});
    expect(h.prisma.responsiblePerson.findFirst).toHaveBeenCalledWith({
      where: { AND: [{ id: sourceId, isActive: true }, {}] }, select: { id: true },
    });
    expect(h.tx.issueRealization.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ issueId, createdByUserId: owner.id }),
    }));
    expect(h.tx.securityEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      actorUserId: owner.id, metadata: expect.objectContaining({ targetResponsiblePersonId: sourceId }),
    }) }));
  });
  it('creates realization for scoped target while keeping the authenticated manager attribution', async () => {
    const h = harness();
    const manager = { ...actor, id: 'manager-user', role: UserRole.ORG_MANAGER, responsiblePersonId: null,
      accessScopes: [{ managementId: 'manager-management', serviceCode: null }] };
    await h.service.create(issueId, { realizationDate: '2026-08-11', targetResponsiblePersonId: sourceId,
      lines: [{ issueLineId, quantity: '8' }] }, [], manager, {});
    expect(h.tx.issueRealization.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ issueId, createdByUserId: manager.id }) }));
    expect(h.tx.securityEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      actorUserId: manager.id, metadata: expect.objectContaining({ targetResponsiblePersonId: sourceId, action: 'ISSUE_REALIZATION_CREATE' }),
    }) }));
    expect(h.tx).not.toHaveProperty('stockBalance');
    expect(h.tx).not.toHaveProperty('stockTransaction');
    h.tx.issueRealizationLine.groupBy.mockResolvedValue([{ issueLineId, _sum: { quantity: new Prisma.Decimal(8) } }]);
    await expect(h.service.create(issueId, { realizationDate: '2026-08-11', targetResponsiblePersonId: sourceId,
      lines: [{ issueLineId, quantity: '3' }] }, [], manager, {})).rejects.toBeInstanceOf(ConflictException);
    expect(h.tx.issueRealization.create).toHaveBeenCalledTimes(1);
  });

  it('rejects out-of-scope or mismatched ISSUE targets and crafted MVO targets before storage', async () => {
    const h = harness();
    const manager = { ...actor, role: UserRole.ORG_MANAGER, responsiblePersonId: null,
      accessScopes: [{ managementId: 'manager-management', serviceCode: null }] };
    const input = { realizationDate: '2026-08-11', targetResponsiblePersonId: sourceId, lines: [{ issueLineId, quantity: '1' }] };
    h.prisma.responsiblePerson.findFirst.mockResolvedValueOnce(null as never);
    await expect(h.service.create(issueId, input, [], manager, {})).rejects.toBeInstanceOf(NotFoundException);
    h.prisma.stockDocument.findFirst.mockResolvedValueOnce(null as never);
    await expect(h.service.create(issueId, input, [], manager, {})).rejects.toBeInstanceOf(NotFoundException);
    await expect(h.service.create(issueId, input, [], actor, {})).rejects.toBeInstanceOf(ForbiddenException);
    h.prisma.responsiblePerson.findFirst.mockResolvedValueOnce({ id: 'other-scoped-mvo' });
    await expect(h.service.create(issueId, { ...input, targetResponsiblePersonId: 'other-scoped-mvo' }, [], manager, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(h.storage.store).not.toHaveBeenCalled();
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });
  it('rejects excessive total size before storing any realization attachments', async () => {
    const h = harness();
    const files = [20, 20, 11].map((size) => ({ size: size * 1024 * 1024 })) as Express.Multer.File[];
    await expect(h.service.create(issueId, {
      realizationDate: '2026-09-17', lines: [{ issueLineId, quantity: '1' }],
    }, files, actor, {})).rejects.toBeInstanceOf(BadRequestException);
    expect(h.storage.store).not.toHaveBeenCalled();
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
    expect(h.tx.issueRealization.create).not.toHaveBeenCalled();
  });
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
    const file = { originalname: 'акт.pdf', size: 12 } as Express.Multer.File;

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
