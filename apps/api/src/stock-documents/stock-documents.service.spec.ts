import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  StockAccountingModel,
  StockDocumentStatus,
  StockDocumentType,
  StockSourceKind,
  StockTransactionType,
  UserRole,
} from '@prisma/client';
import { StockDocumentsService } from './stock-documents.service';

const owner = {
  id: '11111111-1111-1111-1111-111111111111',
  username: 'owner',
  role: UserRole.OWNER,
  isActive: true,
  mustChangePassword: false,
  responsiblePersonId: null,
};
const sourceId = '22222222-2222-2222-2222-222222222222';
const destinationId = '33333333-3333-3333-3333-333333333333';
const itemId = '44444444-4444-4444-4444-444444444444';
const accountingOwnerId = '55555555-5555-5555-5555-555555555555';
const custodyBalanceId = '66666666-6666-6666-6666-666666666666';
const mvo = {
  ...owner,
  id: '77777777-7777-4777-8777-777777777777',
  username: 'mvo',
  role: UserRole.MVO,
  responsiblePersonId: sourceId,
};

function document(
  type: StockDocumentType = StockDocumentType.TRANSFER,
  status: StockDocumentStatus = StockDocumentStatus.DRAFT,
  sourceKind?: StockSourceKind,
) {
  const accountingModel =
    type === StockDocumentType.ASSIGNMENT ||
    (type === StockDocumentType.ISSUE && sourceKind)
      ? StockAccountingModel.OWNER_CUSTODY
      : StockAccountingModel.LEGACY_BALANCE;
  const lineOwnerId =
    sourceKind === StockSourceKind.ASSIGNED ? accountingOwnerId : sourceId;
  const transactions =
    type === StockDocumentType.ASSIGNMENT && status === StockDocumentStatus.POSTED
      ? [
          {
            id: 'outgoing-transaction-id',
            type:
              sourceKind === StockSourceKind.ASSIGNED
                ? StockTransactionType.ASSIGNMENT_OUT_CUSTODY
                : StockTransactionType.ASSIGNMENT_OUT_DIRECT,
          },
          {
            id: 'incoming-transaction-id',
            type: StockTransactionType.ASSIGNMENT_IN_CUSTODY,
          },
        ]
      : type === StockDocumentType.ISSUE &&
          sourceKind &&
          status === StockDocumentStatus.POSTED
        ? [
            {
              id: 'issue-transaction-id',
              type:
                sourceKind === StockSourceKind.DIRECT
                  ? StockTransactionType.ISSUE_FROM_DIRECT
                  : StockTransactionType.ISSUE_FROM_CUSTODY,
            },
          ]
      : [];
  return {
    id: 'document-id',
    documentNumber: 'MOV-1',
    documentDate: new Date(),
    type,
    accountingModel,
    status,
    sourceResponsiblePersonId: sourceId,
    destinationResponsiblePersonId:
      type === StockDocumentType.TRANSFER ||
      type === StockDocumentType.ASSIGNMENT
        ? destinationId
        : null,
    recipientName: type === StockDocumentType.ISSUE ? 'Одержувач' : null,
    recipientUnit: null,
    basis: type === StockDocumentType.ISSUE ? 'Видаткова накладна' : null,
    note: null,
    createdByUserId: owner.id,
    postedByUserId: null,
    postedAt: null,
    cancelledByUserId: null,
    cancelledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lines: [
      {
        id: 'line-id',
        documentId: 'document-id',
        inventoryItemId: itemId,
        sourceKind: sourceKind ?? null,
        accountingOwnerResponsiblePersonId: sourceKind ? lineOwnerId : null,
        sourceCustodianResponsiblePersonId:
          sourceKind === StockSourceKind.ASSIGNED ? sourceId : null,
        sourceCustodyBalanceId:
          sourceKind === StockSourceKind.ASSIGNED ? custodyBalanceId : null,
        quantity: new Prisma.Decimal(2),
        note: null,
        createdAt: new Date(),
        inventoryItem: { id: itemId },
        accountingOwnerResponsiblePerson: null,
        sourceCustodianResponsiblePerson: null,
        sourceCustodyBalance: null,
        transactions,
      },
    ],
    sourceResponsiblePerson: { id: sourceId },
    destinationResponsiblePerson: { id: destinationId },
    createdByUser: { id: owner.id, username: 'owner', role: UserRole.OWNER },
    postedByUser: null,
    cancelledByUser: null,
    attachments:
      type === StockDocumentType.ISSUE
        ? [
            {
              id: 'attachment-id',
              documentId: 'document-id',
              originalFileName: 'invoice.pdf',
              mimeType: 'application/pdf',
              sizeBytes: 100,
              sha256: 'hash',
              storagePath: 'stored.pdf',
              uploadedByUserId: owner.id,
              uploadedByUser: {
                id: owner.id,
                username: owner.username,
                role: owner.role,
              },
              createdAt: new Date(),
            },
          ]
        : [],
  };
}

function createService() {
  const tx = {
    stockDocument: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      delete: jest.fn(),
    },
    stockDocumentLine: { deleteMany: jest.fn() },
    stockDocumentAttachment: { deleteMany: jest.fn() },
    custodyBalance: { findUnique: jest.fn() },
    securityEvent: { create: jest.fn() },
  };
  const prisma = {
    stockDocument: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    stockDocumentAttachment: { findMany: jest.fn().mockResolvedValue([]) },
    securityEvent: { create: jest.fn() },
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  const stock = {
    createDecreasingTransactionInTx: jest.fn(),
    createIncreasingTransactionInTx: jest.fn(),
    createCustodyDecreasingTransactionInTx: jest.fn(),
    createCustodyIncreasingTransactionInTx: jest.fn(),
  };
  const attachmentStorage = {
    assertStoredFilesExist: jest.fn(),
    stageForDeletion: jest.fn(),
    restoreStaged: jest.fn(),
    finalizeDeletion: jest.fn(),
  };
  return {
    service: new StockDocumentsService(
      prisma as never,
      stock as never,
      attachmentStorage as never,
    ),
    prisma,
    tx,
    stock,
    attachmentStorage,
  };
}

const transferDto = {
  documentDate: new Date().toISOString(),
  type: StockDocumentType.TRANSFER,
  sourceResponsiblePersonId: sourceId,
  destinationResponsiblePersonId: destinationId,
  lines: [{ inventoryItemId: itemId, quantity: '2' }],
};

const issueDto = {
  documentDate: new Date().toISOString(),
  type: StockDocumentType.ISSUE,
  sourceResponsiblePersonId: sourceId,
  recipientName: 'Одержувач',
  basis: 'Видаткова накладна',
  lines: [
    {
      inventoryItemId: itemId,
      quantity: '2',
      sourceKind: StockSourceKind.DIRECT,
      accountingOwnerResponsiblePersonId: sourceId,
    },
  ],
};

function preparePostedResult(
  prisma: ReturnType<typeof createService>['prisma'],
  value: ReturnType<typeof document>,
) {
  prisma.stockDocument.findUnique.mockResolvedValue({
    ...value,
    status: StockDocumentStatus.POSTED,
  });
}

describe('StockDocumentsService', () => {
  it('scopes the MVO document list by current user and responsible person', async () => {
    const { service, prisma } = createService();
    prisma.stockDocument.findMany.mockResolvedValue([]);
    prisma.stockDocument.count.mockResolvedValue(0);

    await service.list(
      {
        page: 1,
        limit: 20,
        sourceResponsiblePersonId: destinationId,
      },
      mvo,
    );

    expect(prisma.stockDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sourceResponsiblePersonId: destinationId,
          OR: [
            { createdByUserId: mvo.id },
            { sourceResponsiblePersonId: sourceId },
            { destinationResponsiblePersonId: sourceId },
            {
              lines: {
                some: { accountingOwnerResponsiblePersonId: sourceId },
              },
            },
          ],
        }),
      }),
    );
  });

  it('hides an unrelated document from MVO even when its id is known', async () => {
    const { service, prisma } = createService();
    prisma.stockDocument.findUnique.mockResolvedValue(document());

    await expect(
      service.findOne('document-id', {
        ...mvo,
        id: '88888888-8888-4888-8888-888888888888',
        responsiblePersonId: '99999999-9999-4999-8999-999999999999',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates and edits an ASSIGNMENT draft with explicit source metadata', async () => {
    const { service, prisma, tx } = createService();
    const value = document(
      StockDocumentType.ASSIGNMENT,
      StockDocumentStatus.DRAFT,
      StockSourceKind.DIRECT,
    );
    const dto = {
      ...transferDto,
      type: StockDocumentType.ASSIGNMENT,
      lines: [
        {
          inventoryItemId: itemId,
          quantity: '2',
          sourceKind: StockSourceKind.DIRECT,
          accountingOwnerResponsiblePersonId: sourceId,
        },
      ],
    };
    prisma.stockDocument.create.mockResolvedValue(value);

    await service.create(dto, owner, {});

    expect(prisma.stockDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountingModel: StockAccountingModel.OWNER_CUSTODY,
          lines: {
            create: [
              expect.objectContaining({
                sourceKind: StockSourceKind.DIRECT,
                accountingOwnerResponsiblePersonId: sourceId,
              }),
            ],
          },
        }),
      }),
    );

    prisma.stockDocument.findUnique.mockResolvedValue(value);
    tx.stockDocument.update.mockResolvedValue(value);
    await expect(
      service.update('document-id', dto, owner, {}),
    ).resolves.toBeDefined();
    expect(tx.stockDocumentLine.deleteMany).toHaveBeenCalledWith({
      where: { documentId: 'document-id' },
    });
  });

  it('keeps DIRECT and ASSIGNED sources of one item separate by accounting owner', async () => {
    const { service, prisma } = createService();
    const value = document(
      StockDocumentType.ASSIGNMENT,
      StockDocumentStatus.DRAFT,
      StockSourceKind.DIRECT,
    );
    prisma.stockDocument.create.mockResolvedValue(value);

    await expect(service.create({
      ...transferDto,
      type: StockDocumentType.ASSIGNMENT,
      lines: [
        {
          inventoryItemId: itemId,
          quantity: '1',
          sourceKind: StockSourceKind.DIRECT,
          accountingOwnerResponsiblePersonId: sourceId,
        },
        {
          inventoryItemId: itemId,
          quantity: '1',
          sourceKind: StockSourceKind.ASSIGNED,
          accountingOwnerResponsiblePersonId: accountingOwnerId,
          sourceCustodianResponsiblePersonId: sourceId,
          sourceCustodyBalanceId: custodyBalanceId,
        },
      ],
    }, owner, {})).resolves.toBeDefined();

    expect(prisma.stockDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lines: { create: expect.arrayContaining([
            expect.objectContaining({
              sourceKind: StockSourceKind.DIRECT,
              accountingOwnerResponsiblePersonId: sourceId,
            }),
            expect.objectContaining({
              sourceKind: StockSourceKind.ASSIGNED,
              accountingOwnerResponsiblePersonId: accountingOwnerId,
              sourceCustodyBalanceId: custodyBalanceId,
            }),
          ]) },
        }),
      }),
    );
  });

  it('posts DIRECT to CUSTODY without increasing recipient StockBalance', async () => {
    const { service, prisma, tx, stock } = createService();
    const value = document(
      StockDocumentType.ASSIGNMENT,
      StockDocumentStatus.DRAFT,
      StockSourceKind.DIRECT,
    );
    tx.stockDocument.findUnique.mockResolvedValue(value);
    preparePostedResult(prisma, value);

    await service.post('document-id', owner, { requestId: 'request-1' });

    expect(stock.createDecreasingTransactionInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        type: StockTransactionType.ASSIGNMENT_OUT_DIRECT,
        responsiblePersonId: sourceId,
        accountingOwnerResponsiblePersonId: sourceId,
      }),
    );
    expect(stock.createCustodyIncreasingTransactionInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        type: StockTransactionType.ASSIGNMENT_IN_CUSTODY,
        accountingOwnerResponsiblePersonId: sourceId,
        custodianResponsiblePersonId: destinationId,
      }),
    );
    expect(stock.createIncreasingTransactionInTx).not.toHaveBeenCalled();
  });

  it('posts CUSTODY to CUSTODY and keeps the accounting owner', async () => {
    const { service, prisma, tx, stock } = createService();
    const value = document(
      StockDocumentType.ASSIGNMENT,
      StockDocumentStatus.DRAFT,
      StockSourceKind.ASSIGNED,
    );
    tx.stockDocument.findUnique.mockResolvedValue(value);
    tx.custodyBalance.findUnique.mockResolvedValue({
      inventoryItemId: itemId,
      accountingOwnerResponsiblePersonId: accountingOwnerId,
      custodianResponsiblePersonId: sourceId,
    });
    preparePostedResult(prisma, value);

    await service.post('document-id', owner, {});

    expect(stock.createCustodyDecreasingTransactionInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        accountingOwnerResponsiblePersonId: accountingOwnerId,
        custodianResponsiblePersonId: sourceId,
      }),
    );
    expect(stock.createCustodyIncreasingTransactionInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        accountingOwnerResponsiblePersonId: accountingOwnerId,
        custodianResponsiblePersonId: destinationId,
      }),
    );
    expect(stock.createIncreasingTransactionInTx).not.toHaveBeenCalled();
  });

  it('returns CUSTODY to the accounting owner DIRECT bucket', async () => {
    const { service, prisma, tx, stock } = createService();
    const value = document(
      StockDocumentType.ASSIGNMENT,
      StockDocumentStatus.DRAFT,
      StockSourceKind.ASSIGNED,
    );
    value.destinationResponsiblePersonId = accountingOwnerId;
    tx.stockDocument.findUnique.mockResolvedValue(value);
    tx.custodyBalance.findUnique.mockResolvedValue({
      inventoryItemId: itemId,
      accountingOwnerResponsiblePersonId: accountingOwnerId,
      custodianResponsiblePersonId: sourceId,
    });
    preparePostedResult(prisma, value);

    await service.post('document-id', owner, {});

    expect(stock.createCustodyDecreasingTransactionInTx).toHaveBeenCalled();
    expect(stock.createIncreasingTransactionInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        type: StockTransactionType.ASSIGNMENT_IN_DIRECT,
        responsiblePersonId: accountingOwnerId,
        accountingOwnerResponsiblePersonId: accountingOwnerId,
        bucketKind: StockSourceKind.DIRECT,
      }),
    );
    expect(stock.createCustodyIncreasingTransactionInTx).not.toHaveBeenCalled();
  });

  it('posts ISSUE FROM DIRECT and reduces only the owner direct bucket', async () => {
    const { service, prisma, tx, stock, attachmentStorage } = createService();
    const value = document(
      StockDocumentType.ISSUE,
      StockDocumentStatus.DRAFT,
      StockSourceKind.DIRECT,
    );
    tx.stockDocument.findUnique.mockResolvedValue(value);
    preparePostedResult(prisma, value);

    await service.post('document-id', owner, {});

    expect(attachmentStorage.assertStoredFilesExist).toHaveBeenCalledWith([
      'stored.pdf',
    ]);
    expect(stock.createDecreasingTransactionInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        type: StockTransactionType.ISSUE_FROM_DIRECT,
        responsiblePersonId: sourceId,
        accountingOwnerResponsiblePersonId: sourceId,
        bucketKind: StockSourceKind.DIRECT,
      }),
    );
    expect(stock.createCustodyDecreasingTransactionInTx).not.toHaveBeenCalled();
  });

  it('posts ISSUE FROM ASSIGNED without changing custodian StockBalance', async () => {
    const { service, prisma, tx, stock } = createService();
    const value = document(
      StockDocumentType.ISSUE,
      StockDocumentStatus.DRAFT,
      StockSourceKind.ASSIGNED,
    );
    tx.stockDocument.findUnique.mockResolvedValue(value);
    tx.custodyBalance.findUnique.mockResolvedValue({
      inventoryItemId: itemId,
      accountingOwnerResponsiblePersonId: accountingOwnerId,
      custodianResponsiblePersonId: sourceId,
    });
    preparePostedResult(prisma, value);

    await service.post('document-id', owner, {});

    expect(stock.createCustodyDecreasingTransactionInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        type: StockTransactionType.ISSUE_FROM_CUSTODY,
        accountingOwnerResponsiblePersonId: accountingOwnerId,
        custodianResponsiblePersonId: sourceId,
      }),
    );
    expect(stock.createDecreasingTransactionInTx).not.toHaveBeenCalled();
    expect(stock.createIncreasingTransactionInTx).not.toHaveBeenCalled();
  });

  it('rejects posting ISSUE without an attachment before moving stock', async () => {
    const { service, tx, stock } = createService();
    const value = document(
      StockDocumentType.ISSUE,
      StockDocumentStatus.DRAFT,
      StockSourceKind.DIRECT,
    );
    value.attachments = [];
    tx.stockDocument.findUnique.mockResolvedValue(value);

    await expect(service.post('document-id', owner, {})).rejects.toThrow(
      'додайте хоча б одне фото або скан',
    );
    expect(stock.createDecreasingTransactionInTx).not.toHaveBeenCalled();
  });

  it('does not post a legacy ISSUE draft through the old balance model', async () => {
    const { service, tx, stock } = createService();
    tx.stockDocument.findUnique.mockResolvedValue(
      document(StockDocumentType.ISSUE, StockDocumentStatus.DRAFT),
    );

    await expect(service.post('document-id', owner, {})).rejects.toThrow(
      'явним джерелом DIRECT або ASSIGNED',
    );
    expect(stock.createDecreasingTransactionInTx).not.toHaveBeenCalled();
  });

  it('requires recipient, basis and explicit source for a new ISSUE', async () => {
    const { service } = createService();
    await expect(
      service.create({ ...issueDto, basis: undefined }, owner, {}),
    ).rejects.toThrow('мету або підставу');
    await expect(
      service.create(
        {
          ...issueDto,
          lines: [{ inventoryItemId: itemId, quantity: '2' }],
        },
        owner,
        {},
      ),
    ).rejects.toThrow('тип джерела та облікового власника');
  });

  it('rolls back ISSUE posting when one line has insufficient stock', async () => {
    const { service, tx, stock } = createService();
    const value = document(
      StockDocumentType.ISSUE,
      StockDocumentStatus.DRAFT,
      StockSourceKind.DIRECT,
    );
    value.lines.push({
      ...value.lines[0],
      id: 'line-id-2',
      inventoryItemId: '77777777-7777-7777-7777-777777777777',
    });
    tx.stockDocument.findUnique.mockResolvedValue(value);
    stock.createDecreasingTransactionInTx
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new BadRequestException('Недостатній залишок'));

    await expect(service.post('document-id', owner, {})).rejects.toThrow(
      'Недостатній залишок',
    );
    expect(tx.stockDocument.update).not.toHaveBeenCalled();
  });

  it.each([StockSourceKind.DIRECT, StockSourceKind.ASSIGNED])(
    'reverses ISSUE back into the %s source bucket and keeps attachments',
    async (sourceKind) => {
      const { service, prisma, tx, stock, attachmentStorage } = createService();
      const value = document(
        StockDocumentType.ISSUE,
        StockDocumentStatus.POSTED,
        sourceKind,
      );
      tx.stockDocument.findUnique.mockResolvedValue(value);
      prisma.stockDocument.findUnique.mockResolvedValue({
        ...value,
        status: StockDocumentStatus.CANCELLED,
      });

      await service.cancel('document-id', owner, {});

      if (sourceKind === StockSourceKind.DIRECT) {
        expect(stock.createIncreasingTransactionInTx).toHaveBeenCalledWith(
          tx,
          expect.objectContaining({
            type: StockTransactionType.ISSUE_REVERSAL,
            bucketKind: StockSourceKind.DIRECT,
            reversalOfTransactionId: 'issue-transaction-id',
          }),
        );
      } else {
        expect(
          stock.createCustodyIncreasingTransactionInTx,
        ).toHaveBeenCalledWith(
          tx,
          expect.objectContaining({
            type: StockTransactionType.ISSUE_REVERSAL,
            accountingOwnerResponsiblePersonId: accountingOwnerId,
            custodianResponsiblePersonId: sourceId,
            reversalOfTransactionId: 'issue-transaction-id',
          }),
        );
      }
      expect(attachmentStorage.stageForDeletion).not.toHaveBeenCalled();
    },
  );

  it('rejects transfer to the same MVO', async () => {
    const { service } = createService();
    await expect(
      service.create(
        { ...transferDto, destinationResponsiblePersonId: sourceId },
        owner,
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an ASSIGNED source held by another MVO', async () => {
    const { service } = createService();
    await expect(
      service.create(
        {
          ...transferDto,
          type: StockDocumentType.ASSIGNMENT,
          lines: [
            {
              inventoryItemId: itemId,
              quantity: '1',
              sourceKind: StockSourceKind.ASSIGNED,
              accountingOwnerResponsiblePersonId: accountingOwnerId,
              sourceCustodianResponsiblePersonId: destinationId,
            },
          ],
        },
        owner,
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('propagates insufficient direct or custody quantity errors', async () => {
    const { service, tx, stock } = createService();
    tx.stockDocument.findUnique.mockResolvedValue(
      document(
        StockDocumentType.ASSIGNMENT,
        StockDocumentStatus.DRAFT,
        StockSourceKind.DIRECT,
      ),
    );
    stock.createDecreasingTransactionInTx.mockRejectedValue(
      new BadRequestException('Недостатній залишок'),
    );
    await expect(service.post('document-id', owner, {})).rejects.toThrow(
      'Недостатній залишок',
    );
    expect(stock.createCustodyIncreasingTransactionInTx).not.toHaveBeenCalled();
  });

  it('rolls back the whole posting transaction when one line fails', async () => {
    const { service, prisma, tx, stock } = createService();
    const value = document(
      StockDocumentType.ASSIGNMENT,
      StockDocumentStatus.DRAFT,
      StockSourceKind.DIRECT,
    );
    value.lines.push({
      ...value.lines[0],
      id: 'line-id-2',
      inventoryItemId: '77777777-7777-7777-7777-777777777777',
    });
    tx.stockDocument.findUnique.mockResolvedValue(value);
    stock.createDecreasingTransactionInTx
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('line failed'));

    await expect(service.post('document-id', owner, {})).rejects.toThrow(
      'line failed',
    );
    expect(tx.stockDocument.update).not.toHaveBeenCalled();
    expect(prisma.securityEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ success: false }),
      }),
    );
  });

  it('keeps posting idempotent after the document is POSTED', async () => {
    const { service, prisma, tx, stock } = createService();
    const value = document(
      StockDocumentType.ASSIGNMENT,
      StockDocumentStatus.POSTED,
      StockSourceKind.DIRECT,
    );
    tx.stockDocument.updateMany.mockResolvedValue({ count: 0 });
    tx.stockDocument.findUnique.mockResolvedValue({
      status: StockDocumentStatus.POSTED,
    });
    preparePostedResult(prisma, value);

    await expect(service.post('document-id', owner, {})).resolves.toBeDefined();
    expect(stock.createDecreasingTransactionInTx).not.toHaveBeenCalled();
    expect(stock.createCustodyIncreasingTransactionInTx).not.toHaveBeenCalled();
  });

  it('reverses ASSIGNMENT only after taking quantity from the new custodian', async () => {
    const { service, prisma, tx, stock } = createService();
    const value = document(
      StockDocumentType.ASSIGNMENT,
      StockDocumentStatus.POSTED,
      StockSourceKind.DIRECT,
    );
    tx.stockDocument.findUnique.mockResolvedValue(value);
    prisma.stockDocument.findUnique.mockResolvedValue({
      ...value,
      status: StockDocumentStatus.CANCELLED,
    });

    await service.cancel('document-id', owner, {});

    expect(stock.createCustodyDecreasingTransactionInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        type: StockTransactionType.ASSIGNMENT_REVERSAL,
        custodianResponsiblePersonId: destinationId,
        reversalOfTransactionId: 'incoming-transaction-id',
      }),
    );
    expect(stock.createIncreasingTransactionInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        responsiblePersonId: sourceId,
        reversalOfTransactionId: 'outgoing-transaction-id',
      }),
    );
  });

  it('does not complete cancellation when destination custody is insufficient', async () => {
    const { service, tx, stock } = createService();
    tx.stockDocument.findUnique.mockResolvedValue(
      document(
        StockDocumentType.ASSIGNMENT,
        StockDocumentStatus.POSTED,
        StockSourceKind.DIRECT,
      ),
    );
    stock.createCustodyDecreasingTransactionInTx.mockRejectedValue(
      new BadRequestException('Недостатньо закріпленого майна'),
    );

    await expect(service.cancel('document-id', owner, {})).rejects.toThrow(
      'Недостатньо закріпленого майна',
    );
    expect(tx.stockDocument.update).not.toHaveBeenCalled();
  });

  it('keeps legacy TRANSFER read-only on the backend', async () => {
    const { service, prisma, tx, stock } = createService();
    const value = document();
    prisma.stockDocument.findUnique.mockResolvedValue(value);
    tx.stockDocument.findUnique.mockResolvedValue(value);

    await expect(service.create(transferDto, owner, {})).rejects.toThrow(
      'доступний лише для перегляду',
    );
    await expect(
      service.update('document-id', transferDto, owner, {}),
    ).rejects.toThrow('доступний лише для перегляду');
    await expect(service.remove('document-id', owner, {})).rejects.toThrow(
      'доступний лише для перегляду',
    );
    await expect(service.post('document-id', owner, {})).rejects.toThrow(
      'доступний лише для перегляду',
    );
    await expect(service.cancel('document-id', owner, {})).rejects.toThrow(
      'доступний лише для перегляду',
    );
    expect(stock.createDecreasingTransactionInTx).not.toHaveBeenCalled();
    expect(stock.createIncreasingTransactionInTx).not.toHaveBeenCalled();
  });

  it.each([UserRole.ACCOUNTANT, UserRole.AUDITOR])(
    'keeps %s read-only for stock documents',
    async (role) => {
      const { service } = createService();
      await expect(
        service.create(transferDto, { ...owner, role }, {}),
      ).rejects.toBeInstanceOf(ForbiddenException);
    },
  );

  it('prevents MVO from creating a document for another source', async () => {
    const { service } = createService();
    await expect(
      service.create(
        {
          ...transferDto,
          type: StockDocumentType.ASSIGNMENT,
          lines: [
            {
              inventoryItemId: itemId,
              quantity: '2',
              sourceKind: StockSourceKind.DIRECT,
              accountingOwnerResponsiblePersonId: sourceId,
            },
          ],
        },
        { ...owner, role: UserRole.MVO, responsiblePersonId: destinationId },
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('prevents editing a posted document', async () => {
    const { service, prisma } = createService();
    prisma.stockDocument.findUnique.mockResolvedValue(
      document(StockDocumentType.ASSIGNMENT, StockDocumentStatus.POSTED),
    );
    await expect(
      service.update(
        'document-id',
        {
          ...transferDto,
          type: StockDocumentType.ASSIGNMENT,
          lines: [
            {
              inventoryItemId: itemId,
              quantity: '2',
              sourceKind: StockSourceKind.DIRECT,
              accountingOwnerResponsiblePersonId: sourceId,
            },
          ],
        },
        owner,
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('deletes DRAFT attachment metadata and files through controlled staging', async () => {
    const { service, prisma, tx, attachmentStorage } = createService();
    prisma.stockDocument.findUnique.mockResolvedValue(
      document(StockDocumentType.ISSUE, StockDocumentStatus.DRAFT),
    );
    prisma.stockDocumentAttachment.findMany.mockResolvedValue([
      { storagePath: 'stored.pdf' },
    ]);
    attachmentStorage.stageForDeletion.mockResolvedValue({
      storagePath: 'stored.pdf',
      stagedStoragePath: '.deleting-file',
    });

    await service.remove('document-id', owner, {});

    expect(tx.stockDocumentAttachment.deleteMany).toHaveBeenCalledWith({
      where: { documentId: 'document-id' },
    });
    expect(tx.stockDocument.delete).toHaveBeenCalledWith({
      where: { id: 'document-id' },
    });
    expect(attachmentStorage.finalizeDeletion).toHaveBeenCalledWith([
      {
        storagePath: 'stored.pdf',
        stagedStoragePath: '.deleting-file',
      },
    ]);
  });
});
