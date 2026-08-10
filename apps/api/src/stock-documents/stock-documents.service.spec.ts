import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountingExportState,
  Prisma,
  StockAccountingModel,
  StockDocumentStatus,
  StockDocumentType,
  StockTransactionType,
  UserRole,
} from '@prisma/client';
import { StockDocumentsService } from './stock-documents.service';

const sourceId = '22222222-2222-4222-8222-222222222222';
const destinationId = '33333333-3333-4333-8333-333333333333';
const itemId = '44444444-4444-4444-8444-444444444444';
const balanceId = '55555555-5555-4555-8555-555555555555';
const documentId = '66666666-6666-4666-8666-666666666666';
const lineId = '77777777-7777-4777-8777-777777777777';
const owner = user(UserRole.OWNER, null);
const mvo = user(UserRole.MVO, sourceId);

function user(role: UserRole, responsiblePersonId: string | null) {
  return {
    id: role === UserRole.MVO ? '11111111-1111-4111-8111-111111111111' : '99999999-9999-4999-8999-999999999999',
    username: role.toLowerCase(),
    role,
    isActive: true,
    mustChangePassword: false,
    responsiblePersonId,
  };
}

function line(overrides: Record<string, unknown> = {}) {
  return {
    id: lineId,
    documentId,
    inventoryItemId: itemId,
    sourceKind: null,
    accountingOwnerResponsiblePersonId: null,
    sourceCustodianResponsiblePersonId: null,
    sourceCustodyBalanceId: null,
    sourceBalanceId: balanceId,
    sourceTransferLineId: null,
    quantityBefore: null,
    quantityAfter: null,
    quantity: new Prisma.Decimal(2),
    note: null,
    createdAt: new Date('2026-07-21T00:00:00.000Z'),
    transactions: [],
    issueLines: [],
    ...overrides,
  };
}

function rawDocument(
  status: StockDocumentStatus = StockDocumentStatus.DRAFT,
  type: StockDocumentType = StockDocumentType.MVO_TRANSFER,
  lines = [line()],
) {
  return {
    id: documentId,
    documentNumber: 'MVO-7',
    displayNumber: 7,
    documentDate: new Date('2026-07-21T00:00:00.000Z'),
    type,
    accountingModel: type === StockDocumentType.MVO_TRANSFER || type === StockDocumentType.ISSUE
      ? StockAccountingModel.DIRECT_BALANCE
      : StockAccountingModel.OWNER_CUSTODY,
    accountingExportState: AccountingExportState.NOT_EXPORTED,
    status,
    sourceResponsiblePersonId: sourceId,
    destinationResponsiblePersonId:
      type === StockDocumentType.ISSUE ? null : destinationId,
    recipientName: type === StockDocumentType.ISSUE ? 'Одержувач' : null,
    recipientUnit: null,
    basis: type === StockDocumentType.ISSUE ? 'Підстава' : null,
    note: null,
    createdByUserId: mvo.id,
    postedByUserId: status === StockDocumentStatus.POSTED ? mvo.id : null,
    postedAt: status === StockDocumentStatus.POSTED ? new Date() : null,
    cancelledByUserId: null,
    cancelledAt: null,
    exportedByUserId: null,
    exportedAt: null,
    sourceTransferId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lines,
    attachments: [],
    sourceTransfer: null,
    issues: [],
  };
}

function viewDocument(
  status: StockDocumentStatus = StockDocumentStatus.DRAFT,
  type: StockDocumentType = StockDocumentType.MVO_TRANSFER,
  lines = [line()],
) {
  return {
    ...rawDocument(status, type, lines),
    sourceResponsiblePerson: { id: sourceId },
    destinationResponsiblePerson: { id: destinationId },
    createdByUser: { id: mvo.id, username: mvo.username, role: mvo.role },
    postedByUser: null,
    cancelledByUser: null,
    exportedByUser: null,
    attachments: [],
    lines: lines.map((entry) => ({
      ...entry,
      inventoryItem: { id: itemId, externalCode: 'KB-1', name: 'Клавіатура' },
      accountingOwnerResponsiblePerson: null,
      sourceCustodianResponsiblePerson: null,
      sourceCustodyBalance: null,
    })),
  };
}

function dto(overrides: Record<string, unknown> = {}) {
  return {
    documentDate: '2026-07-21T00:00:00.000Z',
    type: StockDocumentType.MVO_TRANSFER,
    sourceResponsiblePersonId: sourceId,
    destinationResponsiblePersonId: destinationId,
    lines: [{ inventoryItemId: itemId, sourceBalanceId: balanceId, quantity: '2' }],
    ...overrides,
  };
}

function atomicDto(overrides: Record<string, unknown> = {}) {
  return {
    documentDate: '2026-07-21T00:00:00.000Z',
    destinationResponsiblePersonId: destinationId,
    lines: [
      {
        inventoryItemId: itemId,
        sourceBalanceId: balanceId,
        quantity: '2',
      },
    ],
    ...overrides,
  };
}

function issueDto(overrides: Record<string, unknown> = {}) {
  return {
    documentDate: '2026-07-21T00:00:00.000Z',
    recipientName: 'Отримувач майна',
    note: 'Видано для службового використання',
    lines: [
      {
        inventoryItemId: itemId,
        sourceBalanceId: balanceId,
        quantity: '2',
      },
    ],
    ...overrides,
  };
}

function attachmentFile(name = 'invoice.pdf'): Express.Multer.File {
  const buffer = Buffer.from('%PDF-1.7 invoice');
  return {
    fieldname: 'files',
    originalname: name,
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

function storedAttachment(index = 1) {
  return {
    originalFileName: `invoice-${index}.pdf`,
    storedFileName: `stored-${index}.pdf`,
    mimeType: 'application/pdf' as const,
    sizeBytes: 128,
    sha256: `sha-${index}`,
    storagePath: `stored-${index}.pdf`,
  };
}

function harness() {
  const tx = {
    stockDocument: {
      findUnique: jest.fn(),
      create: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn(),
      delete: jest.fn(),
    },
    stockDocumentLine: {
      update: jest.fn(),
      deleteMany: jest.fn(),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    stockTransaction: { create: jest.fn() },
    stockDocumentAttachment: { deleteMany: jest.fn() },
    custodyBalance: {
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    stockBalance: { findUnique: jest.fn() },
    responsiblePerson: { findUnique: jest.fn().mockResolvedValue({ id: destinationId, isActive: true, externalAccountingCode: '0057' }) },
    securityEvent: { create: jest.fn() },
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
  const prisma = {
    stockDocument: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
    },
    stockDocumentAttachment: { findMany: jest.fn().mockResolvedValue([]) },
    responsiblePerson: { findUnique: jest.fn().mockResolvedValue({ id: destinationId, isActive: true, externalAccountingCode: '0057' }) },
    securityEvent: { create: jest.fn() },
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  const stock = {
    createDecreasingTransactionInTx: jest.fn(),
    createIncreasingTransactionInTx: jest.fn(),
  };
  const storage = {
    store: jest.fn().mockResolvedValue(storedAttachment()),
    removeAfterMetadataFailure: jest.fn().mockResolvedValue(undefined),
    assertStoredFilesExist: jest.fn(),
    stageForDeletion: jest.fn(),
    restoreStaged: jest.fn(),
    finalizeDeletion: jest.fn(),
  };
  return {
    service: new StockDocumentsService(prisma as never, stock as never, storage as never),
    prisma,
    tx,
    stock,
    storage,
  };
}

function preparePosting(h: ReturnType<typeof harness>, lines = [line()]) {
  h.tx.stockDocument.findUnique
    .mockResolvedValueOnce({ type: StockDocumentType.MVO_TRANSFER, accountingModel: StockAccountingModel.DIRECT_BALANCE, status: StockDocumentStatus.DRAFT, sourceResponsiblePersonId: sourceId })
    .mockResolvedValueOnce(rawDocument(StockDocumentStatus.DRAFT, StockDocumentType.MVO_TRANSFER, lines));
  h.tx.stockBalance.findUnique.mockResolvedValue({ id: balanceId, responsiblePersonId: sourceId, inventoryItemId: itemId });
  h.stock.createDecreasingTransactionInTx.mockResolvedValue({
    id: 'transaction-out',
    balanceBefore: new Prisma.Decimal(10),
    balanceAfter: new Prisma.Decimal(8),
  });
  h.prisma.stockDocument.findUnique.mockResolvedValue(viewDocument(StockDocumentStatus.POSTED));
}

function prepareAtomicTransfer(
  h: ReturnType<typeof harness>,
  lines = [line()],
) {
  h.tx.stockDocument.create.mockResolvedValue(
    rawDocument(
      StockDocumentStatus.POSTED,
      StockDocumentType.MVO_TRANSFER,
      lines,
    ),
  );
  h.tx.stockBalance.findUnique.mockResolvedValue({
    id: balanceId,
    responsiblePersonId: sourceId,
    inventoryItemId: itemId,
  });
  h.stock.createDecreasingTransactionInTx.mockResolvedValue({
    id: 'transaction-out',
    balanceBefore: new Prisma.Decimal(10),
    balanceAfter: new Prisma.Decimal(8),
  });
  h.prisma.stockDocument.findUnique.mockResolvedValue(
    viewDocument(StockDocumentStatus.POSTED),
  );
}


describe('StockDocumentsService MVO_TRANSFER', () => {
  it('scopes an MVO list strictly to outgoing documents of the current MVO', async () => {
    const h = harness();
    await h.service.list({ page: 1, limit: 20, sourceResponsiblePersonId: destinationId }, mvo);
    expect(h.prisma.stockDocument.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        sourceResponsiblePersonId: sourceId,
        destinationResponsiblePersonId: undefined,
      }),
    }));
  });

  it('rejects MVO_TRANSFER in the generic draft endpoint', async () => {
    const h = harness();
    await expect(h.service.create(dto(), mvo, {})).rejects.toThrow(
      'Нову передачу потрібно одразу підтвердити та провести',
    );
    expect(h.prisma.stockDocument.create).not.toHaveBeenCalled();
  });

  it('atomically creates MVO_TRANSFER as POSTED and decreases only the sender', async () => {
    const h = harness();
    prepareAtomicTransfer(h);

    const result = await h.service.createAndPostMvoTransfer(
      atomicDto(),
      mvo,
      { requestId: 'atomic-transfer' },
    );

    expect(result.status).toBe(StockDocumentStatus.POSTED);
    expect(result.displayNumber).toBe(7);
    expect(h.tx.stockDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: StockDocumentType.MVO_TRANSFER,
          status: StockDocumentStatus.POSTED,
          sourceResponsiblePersonId: sourceId,
          destinationResponsiblePersonId: destinationId,
          postedByUserId: mvo.id,
          postedAt: expect.any(Date),
        }),
      }),
    );
    expect(h.stock.createDecreasingTransactionInTx).toHaveBeenCalledWith(
      h.tx,
      expect.objectContaining({
        type: StockTransactionType.MVO_TRANSFER_OUT,
        responsiblePersonId: sourceId,
        quantity: new Prisma.Decimal(2),
      }),
    );
    expect(h.stock.createIncreasingTransactionInTx).not.toHaveBeenCalled();
    expect(h.tx.custodyBalance.create).not.toHaveBeenCalled();
    expect(h.tx.custodyBalance.update).not.toHaveBeenCalled();
    expect(h.tx.custodyBalance.upsert).not.toHaveBeenCalled();
  });

  it('forbids transfer to the sender before creating a document', async () => {
    const h = harness();
    await expect(
      h.service.createAndPostMvoTransfer(
        atomicDto({ destinationResponsiblePersonId: sourceId }),
        mvo,
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(h.tx.stockDocument.create).not.toHaveBeenCalled();
  });

  it('forbids an inactive recipient', async () => {
    const h = harness();
    h.tx.responsiblePerson.findUnique
      .mockResolvedValueOnce({ id: sourceId, isActive: true })
      .mockResolvedValueOnce({ id: destinationId, isActive: false });
    await expect(
      h.service.createAndPostMvoTransfer(atomicDto(), mvo, {}),
    ).rejects.toThrow('деактивовано');
    expect(h.tx.stockDocument.create).not.toHaveBeenCalled();
  });

  it('forbids a recipient without an accounting code', async () => {
    const h = harness();
    h.tx.responsiblePerson.findUnique
      .mockResolvedValueOnce({
        id: sourceId,
        isActive: true,
        externalAccountingCode: '1155',
      })
      .mockResolvedValueOnce({
        id: destinationId,
        isActive: true,
        externalAccountingCode: null,
      });

    await expect(
      h.service.createAndPostMvoTransfer(atomicDto(), mvo, {}),
    ).rejects.toThrow('не має дійсного бухгалтерського коду');
    expect(h.tx.stockDocument.create).not.toHaveBeenCalled();
  });

  it('takes the sender from auth context and ignores injected source data', async () => {
    const h = harness();
    prepareAtomicTransfer(h);
    await h.service.createAndPostMvoTransfer(
      {
        ...atomicDto(),
        sourceResponsiblePersonId: destinationId,
      } as never,
      mvo,
      {},
    );
    expect(h.tx.stockDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceResponsiblePersonId: sourceId,
        }),
      }),
    );
  });

  it.each([UserRole.ACCOUNTANT, UserRole.AUDITOR])('%s is read-only', async (role) => {
    const h = harness();
    await expect(
      h.service.createAndPostMvoTransfer(
        atomicDto(),
        user(role, null),
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('forbids an inactive MVO sender', async () => {
    const h = harness();
    h.tx.responsiblePerson.findUnique.mockResolvedValueOnce({
      id: sourceId,
      isActive: false,
    });

    await expect(
      h.service.createAndPostMvoTransfer(atomicDto(), mvo, {}),
    ).rejects.toThrow('МВО-відправника');
    expect(h.tx.stockDocument.create).not.toHaveBeenCalled();
  });

  it('rejects an empty transfer before opening a persisted document', async () => {
    const h = harness();
    await expect(
      h.service.createAndPostMvoTransfer(
        atomicDto({ lines: [] }),
        mvo,
        {},
      ),
    ).rejects.toThrow('щонайменше одну позицію');
    expect(h.tx.stockDocument.create).not.toHaveBeenCalled();
  });

  it.each(['0', '-1'])(
    'rejects non-positive quantity %s',
    async (quantity) => {
      const h = harness();
      await expect(
        h.service.createAndPostMvoTransfer(
          atomicDto({
            lines: [
              {
                inventoryItemId: itemId,
                sourceBalanceId: balanceId,
                quantity,
              },
            ],
          }),
          mvo,
          {},
        ),
      ).rejects.toThrow('має бути додатною');
      expect(h.tx.stockDocument.create).not.toHaveBeenCalled();
    },
  );

  it.each(['NaN', 'Infinity', '1.00001'])(
    'rejects invalid or unsupported decimal quantity %s',
    async (quantity) => {
      const h = harness();
      await expect(
        h.service.createAndPostMvoTransfer(
          atomicDto({
            lines: [
              {
                inventoryItemId: itemId,
                sourceBalanceId: balanceId,
                quantity,
              },
            ],
          }),
          mvo,
          {},
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(h.tx.stockDocument.create).not.toHaveBeenCalled();
    },
  );

  it('rolls back atomic creation when the sender balance is insufficient', async () => {
    const h = harness();
    prepareAtomicTransfer(h);
    h.stock.createDecreasingTransactionInTx.mockRejectedValue(
      new BadRequestException('Недостатній залишок'),
    );

    await expect(
      h.service.createAndPostMvoTransfer(
        atomicDto(),
        mvo,
        { requestId: 'insufficient-transfer' },
      ),
    ).rejects.toThrow('Недостатній залишок');
    expect(h.prisma.stockDocument.findUnique).not.toHaveBeenCalled();
    expect(h.stock.createIncreasingTransactionInTx).not.toHaveBeenCalled();
  });

  it('rolls back all atomic lines when a later line fails', async () => {
    const h = harness();
    const secondLine = line({
      id: '88888888-8888-4888-8888-888888888888',
      inventoryItemId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      sourceBalanceId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    });
    prepareAtomicTransfer(h, [line(), secondLine]);
    h.tx.stockBalance.findUnique
      .mockResolvedValueOnce({
        id: balanceId,
        responsiblePersonId: sourceId,
        inventoryItemId: itemId,
      })
      .mockResolvedValueOnce({
        id: secondLine.sourceBalanceId,
        responsiblePersonId: sourceId,
        inventoryItemId: secondLine.inventoryItemId,
      });
    h.stock.createDecreasingTransactionInTx
      .mockResolvedValueOnce({
        id: 'first-transaction',
        balanceBefore: new Prisma.Decimal(10),
        balanceAfter: new Prisma.Decimal(8),
      })
      .mockRejectedValueOnce(new Error('second line failed'));

    await expect(
      h.service.createAndPostMvoTransfer(
        atomicDto({
          lines: [
            {
              inventoryItemId: itemId,
              sourceBalanceId: balanceId,
              quantity: '2',
            },
            {
              inventoryItemId: secondLine.inventoryItemId,
              sourceBalanceId: secondLine.sourceBalanceId,
              quantity: '1',
            },
          ],
        }),
        mvo,
        {},
      ),
    ).rejects.toThrow('second line failed');
    expect(h.stock.createDecreasingTransactionInTx).toHaveBeenCalledTimes(2);
    expect(h.prisma.stockDocument.findUnique).not.toHaveBeenCalled();
  });

  it.each([StockDocumentType.TRANSFER, StockDocumentType.ASSIGNMENT])('keeps legacy %s valid but read-only', async (type) => {
    const h = harness();
    h.prisma.stockDocument.findUnique.mockResolvedValue(viewDocument(StockDocumentStatus.POSTED, type));
    await expect(h.service.findOne(documentId, owner)).resolves.toBeDefined();
    await expect(h.service.create(dto({ type }), owner, {})).rejects.toThrow('лише для перегляду');
  });

  it('keeps an OWNER_CUSTODY ISSUE read-only', async () => {
    const h = harness();
    h.tx.stockDocument.findUnique.mockResolvedValue({
      type: StockDocumentType.ISSUE,
      accountingModel: StockAccountingModel.OWNER_CUSTODY,
      status: StockDocumentStatus.POSTED,
      sourceResponsiblePersonId: sourceId,
    });

    await expect(h.service.cancel(documentId, owner, {})).rejects.toThrow(
      'лише для перегляду',
    );
    expect(h.stock.createIncreasingTransactionInTx).not.toHaveBeenCalled();
  });

  it('posts A=10 → A=8 and never changes B', async () => {
    const h = harness();
    preparePosting(h);
    await h.service.post(documentId, mvo, {});
    expect(h.stock.createDecreasingTransactionInTx).toHaveBeenCalledWith(h.tx, expect.objectContaining({
      type: StockTransactionType.MVO_TRANSFER_OUT,
      responsiblePersonId: sourceId,
      quantity: new Prisma.Decimal(2),
    }));
    expect(h.tx.stockDocumentLine.update).toHaveBeenCalledWith({
      where: { id: lineId },
      data: { quantityBefore: new Prisma.Decimal(10), quantityAfter: new Prisma.Decimal(8) },
    });
    expect(h.stock.createIncreasingTransactionInTx).not.toHaveBeenCalled();
  });

  it('keeps a legacy standalone ISSUE read-only', async () => {
    const h = harness();
    const issue = {
      ...rawDocument(StockDocumentStatus.DRAFT, StockDocumentType.ISSUE),
      accountingModel: StockAccountingModel.DIRECT_BALANCE,
      destinationResponsiblePersonId: null,
      recipientName: 'Одержувач',
      basis: 'Накладна',
      attachments: [{ id: 'attachment-id', storagePath: 'invoice.pdf' }],
    };
    h.tx.stockDocument.findUnique
      .mockResolvedValueOnce({ type: StockDocumentType.ISSUE, accountingModel: StockAccountingModel.DIRECT_BALANCE, status: StockDocumentStatus.DRAFT, sourceResponsiblePersonId: sourceId })
      .mockResolvedValueOnce(issue);
    h.tx.stockBalance.findUnique.mockResolvedValue({ responsiblePersonId: sourceId, inventoryItemId: itemId });
    h.stock.createDecreasingTransactionInTx.mockResolvedValue({ id: 'issue-out', balanceBefore: new Prisma.Decimal(8), balanceAfter: new Prisma.Decimal(6) });
    h.prisma.stockDocument.findUnique.mockResolvedValue(viewDocument(StockDocumentStatus.POSTED, StockDocumentType.ISSUE));
    await expect(h.service.post(documentId, mvo, {})).rejects.toThrow(
      'Видача старої моделі доступна лише для перегляду',
    );
    expect(h.stock.createDecreasingTransactionInTx).not.toHaveBeenCalled();
  });

  it('does not allow changing a transfer draft into a standalone ISSUE', async () => {
    const h = harness();
    h.prisma.stockDocument.findUnique.mockResolvedValue(
      rawDocument(StockDocumentStatus.DRAFT, StockDocumentType.MVO_TRANSFER),
    );

    await expect(
      h.service.update(
        documentId,
        dto({
          type: StockDocumentType.ISSUE,
          destinationResponsiblePersonId: undefined,
          recipientName: 'Одержувач',
        }),
        mvo,
        {},
      ),
    ).rejects.toThrow('Тип документа не можна змінювати');
    expect(h.tx.stockDocument.update).not.toHaveBeenCalled();
  });

  it('does not post a child ISSUE through the legacy draft workflow', async () => {
    const h = harness();
    h.tx.stockDocument.findUnique.mockResolvedValueOnce({
      type: StockDocumentType.ISSUE,
      accountingModel: StockAccountingModel.DIRECT_BALANCE,
      status: StockDocumentStatus.DRAFT,
      sourceResponsiblePersonId: sourceId,
      sourceTransferId: documentId,
    });

    await expect(h.service.post(documentId, mvo, {})).rejects.toThrow(
      'однією операцією без чернетки',
    );
    expect(h.stock.createDecreasingTransactionInTx).not.toHaveBeenCalled();
    expect(h.tx.stockDocument.updateMany).not.toHaveBeenCalled();
  });

  it('forbids a source balance owned by another MVO', async () => {
    const h = harness();
    preparePosting(h);
    h.tx.stockBalance.findUnique.mockResolvedValue({ responsiblePersonId: destinationId, inventoryItemId: itemId });
    await expect(h.service.post(documentId, mvo, {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('propagates insufficient quantity and does not mark the document posted', async () => {
    const h = harness();
    preparePosting(h);
    h.stock.createDecreasingTransactionInTx.mockRejectedValue(new BadRequestException('Недостатній залишок'));
    await expect(h.service.post(documentId, mvo, {})).rejects.toThrow('Недостатній залишок');
    expect(h.tx.stockDocument.update).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: StockDocumentStatus.POSTED }) }));
  });

  it('is idempotent when posting again', async () => {
    const h = harness();
    h.tx.stockDocument.findUnique.mockResolvedValueOnce({ type: StockDocumentType.MVO_TRANSFER, accountingModel: StockAccountingModel.DIRECT_BALANCE, status: StockDocumentStatus.POSTED, sourceResponsiblePersonId: sourceId });
    h.prisma.stockDocument.findUnique.mockResolvedValue(viewDocument(StockDocumentStatus.POSTED));
    await h.service.post(documentId, mvo, {});
    expect(h.stock.createDecreasingTransactionInTx).not.toHaveBeenCalled();
  });

  it('rolls back the entire posting flow when a later line fails', async () => {
    const h = harness();
    const secondLine = line({ id: '88888888-8888-4888-8888-888888888888', sourceBalanceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
    preparePosting(h, [line(), secondLine]);
    h.tx.stockBalance.findUnique
      .mockResolvedValueOnce({ responsiblePersonId: sourceId, inventoryItemId: itemId })
      .mockResolvedValueOnce({ responsiblePersonId: sourceId, inventoryItemId: itemId });
    h.stock.createDecreasingTransactionInTx
      .mockResolvedValueOnce({ id: 'first', balanceBefore: new Prisma.Decimal(10), balanceAfter: new Prisma.Decimal(8) })
      .mockRejectedValueOnce(new Error('line failed'));
    await expect(h.service.post(documentId, mvo, {})).rejects.toThrow('line failed');
    expect(h.tx.stockDocument.update).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: StockDocumentStatus.POSTED }) }));
  });

  it('cancels by restoring only the sender bucket with a reversal transaction', async () => {
    const h = harness();
    const postedLine = line({ transactions: [{ id: 'out', type: StockTransactionType.MVO_TRANSFER_OUT }] });
    h.tx.stockDocument.findUnique
      .mockResolvedValueOnce({ type: StockDocumentType.MVO_TRANSFER, accountingModel: StockAccountingModel.DIRECT_BALANCE, status: StockDocumentStatus.POSTED, sourceResponsiblePersonId: sourceId })
      .mockResolvedValueOnce(rawDocument(StockDocumentStatus.POSTED, StockDocumentType.MVO_TRANSFER, [postedLine]));
    h.prisma.stockDocument.findUnique.mockResolvedValue(viewDocument(StockDocumentStatus.CANCELLED));
    await h.service.cancel(documentId, mvo, {});
    expect(h.stock.createIncreasingTransactionInTx).toHaveBeenCalledWith(h.tx, expect.objectContaining({
      type: StockTransactionType.MVO_TRANSFER_REVERSAL,
      responsiblePersonId: sourceId,
      reversalOfTransactionId: 'out',
    }));
    expect(h.stock.createDecreasingTransactionInTx).not.toHaveBeenCalled();
  });

  it('blocks cancellation after accounting export before any reversal', async () => {
    const h = harness();
    h.tx.stockDocument.findUnique.mockResolvedValueOnce({
      type: StockDocumentType.MVO_TRANSFER,
      accountingModel: StockAccountingModel.DIRECT_BALANCE,
      accountingExportState: AccountingExportState.EXPORTED,
      status: StockDocumentStatus.POSTED,
      sourceResponsiblePersonId: sourceId,
    });

    const error = await h.service.cancel(documentId, mvo, {
      requestId: 'blocked-cancel-request',
    }).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getStatus()).toBe(409);
    expect((error as ConflictException).message).toBe(
      'Передачу вже передано бухгалтерії. Звичайне скасування неможливе.',
    );
    expect(h.stock.createIncreasingTransactionInTx).not.toHaveBeenCalled();
    expect(h.tx.stockDocument.updateMany).not.toHaveBeenCalled();
    expect(h.tx.stockDocument.update).not.toHaveBeenCalled();
    expect(h.prisma.securityEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          requestId: 'blocked-cancel-request',
          success: false,
        }),
      }),
    );
  });

  it('blocks cancellation when export wins the concurrent claim', async () => {
    const h = harness();
    h.tx.stockDocument.findUnique
      .mockResolvedValueOnce({
        type: StockDocumentType.MVO_TRANSFER,
        accountingModel: StockAccountingModel.DIRECT_BALANCE,
        accountingExportState: AccountingExportState.NOT_EXPORTED,
        status: StockDocumentStatus.POSTED,
        sourceResponsiblePersonId: sourceId,
      })
      .mockResolvedValueOnce({
        type: StockDocumentType.MVO_TRANSFER,
        accountingExportState: AccountingExportState.EXPORTED,
        status: StockDocumentStatus.POSTED,
        sourceResponsiblePersonId: sourceId,
      });
    h.tx.stockDocument.updateMany.mockResolvedValue({ count: 0 });

    await expect(h.service.cancel(documentId, mvo, {})).rejects.toThrow(
      'Передачу вже передано бухгалтерії. Звичайне скасування неможливе.',
    );
    expect(h.stock.createIncreasingTransactionInTx).not.toHaveBeenCalled();
  });

  it('does not restore twice when cancellation is repeated', async () => {
    const h = harness();
    h.tx.stockDocument.findUnique.mockResolvedValueOnce({ type: StockDocumentType.MVO_TRANSFER, accountingModel: StockAccountingModel.DIRECT_BALANCE, status: StockDocumentStatus.CANCELLED, sourceResponsiblePersonId: sourceId });
    h.prisma.stockDocument.findUnique.mockResolvedValue(viewDocument(StockDocumentStatus.CANCELLED));
    await h.service.cancel(documentId, mvo, {});
    expect(h.stock.createIncreasingTransactionInTx).not.toHaveBeenCalled();
  });

  it('hides an unrelated document from MVO', async () => {
    const h = harness();
    h.prisma.stockDocument.findUnique.mockResolvedValue({
      ...viewDocument(),
      createdByUserId: owner.id,
      sourceResponsiblePersonId: destinationId,
    });
    await expect(h.service.findOne(documentId, mvo)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not grant transfer or child ISSUE access to the recipient MVO', async () => {
    const h = harness();
    h.prisma.stockDocument.findUnique.mockResolvedValue(
      viewDocument(StockDocumentStatus.POSTED),
    );
    const recipient = user(UserRole.MVO, destinationId);

    await expect(h.service.findOne(documentId, recipient)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    h.prisma.stockDocument.findUnique.mockResolvedValue({
      ...viewDocument(
        StockDocumentStatus.POSTED,
        StockDocumentType.ISSUE,
      ),
      sourceTransferId: documentId,
    });
    await expect(h.service.findOne(documentId, recipient)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});


function transferIssueDto(overrides: Record<string, unknown> = {}) {
  return {
    documentDate: '2026-07-22T00:00:00.000Z',
    recipientName: 'Зовнішній одержувач',
    note: 'Накладна',
    lines: [{ sourceTransferLineId: lineId, quantity: '2' }],
    ...overrides,
  };
}

function prepareTransferIssue(
  h: ReturnType<typeof harness>,
  options: {
    status?: StockDocumentStatus;
    transferred?: string;
    issued?: string;
  } = {},
) {
  const transferLine = line({
    quantity: new Prisma.Decimal(options.transferred ?? '5'),
  });
  h.tx.stockDocument.findUnique.mockResolvedValueOnce({
    ...rawDocument(
      options.status ?? StockDocumentStatus.POSTED,
      StockDocumentType.MVO_TRANSFER,
      [transferLine],
    ),
  });
  h.tx.stockDocumentLine.groupBy.mockResolvedValue(
    options.issued
      ? [
          {
            sourceTransferLineId: lineId,
            _sum: { quantity: new Prisma.Decimal(options.issued) },
          },
        ]
      : [],
  );
  const issueLine = line({
    sourceBalanceId: null,
    sourceTransferLineId: lineId,
    quantity: new Prisma.Decimal('2'),
  });
  h.tx.stockDocument.create.mockResolvedValue({
    ...rawDocument(
      StockDocumentStatus.POSTED,
      StockDocumentType.ISSUE,
      [issueLine],
    ),
    sourceTransferId: documentId,
  });
  h.tx.stockBalance.findUnique.mockResolvedValue({
    quantity: new Prisma.Decimal('5'),
  });
  h.prisma.stockDocument.findUnique.mockResolvedValue({
    ...viewDocument(
      StockDocumentStatus.POSTED,
      StockDocumentType.ISSUE,
      [issueLine],
    ),
    sourceTransferId: documentId,
  });
}

describe('StockDocumentsService transfer-based ISSUE', () => {
  it('forbids the legacy standalone create endpoint', async () => {
    const h = harness();

    await expect(
      h.service.createAndPostIssue(
        issueDto(),
        [attachmentFile()],
        mvo,
        {},
      ),
    ).rejects.toThrow(
      'Нову видачу можна оформити лише з власної проведеної передачі',
    );
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('requires an attachment before starting the transaction', async () => {
    const h = harness();

    await expect(
      h.service.createAndPostTransferIssue(
        documentId,
        transferIssueDto(),
        [],
        mvo,
        {},
      ),
    ).rejects.toThrow('додайте хоча б одне фото або скан накладної');
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    UserRole.OWNER,
    UserRole.DPP_ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.AUDITOR,
  ])('%s cannot create an ISSUE without MVO auth context', async (role) => {
    const h = harness();

    await expect(
      h.service.createAndPostTransferIssue(
        documentId,
        transferIssueDto(),
        [attachmentFile()],
        user(role, null),
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(h.storage.store).not.toHaveBeenCalled();
  });

  it('creates a POSTED child ISSUE without changing either MVO balance', async () => {
    const h = harness();
    prepareTransferIssue(h);

    const result = await h.service.createAndPostTransferIssue(
      documentId,
      transferIssueDto(),
      [attachmentFile()],
      mvo,
      { requestId: 'transfer-issue' },
    );

    expect(result.status).toBe(StockDocumentStatus.POSTED);
    expect(result.displayNumber).toBe(7);
    expect(h.tx.stockDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: StockDocumentType.ISSUE,
          status: StockDocumentStatus.POSTED,
          sourceTransferId: documentId,
          sourceResponsiblePersonId: sourceId,
          destinationResponsiblePersonId: null,
          recipientName: 'Зовнішній одержувач',
          lines: {
            create: [
              expect.objectContaining({
                sourceTransferLineId: lineId,
                sourceBalanceId: null,
                quantity: new Prisma.Decimal(2),
              }),
            ],
          },
          attachments: {
            create: [
              expect.objectContaining({
                storagePath: 'stored-1.pdf',
                uploadedByUserId: mvo.id,
              }),
            ],
          },
        }),
      }),
    );
    expect(h.stock.createDecreasingTransactionInTx).not.toHaveBeenCalled();
    expect(h.stock.createIncreasingTransactionInTx).not.toHaveBeenCalled();
    expect(h.tx.custodyBalance.create).not.toHaveBeenCalled();
    expect(h.tx.custodyBalance.update).not.toHaveBeenCalled();
    expect(h.tx.custodyBalance.upsert).not.toHaveBeenCalled();
    expect(h.tx.stockTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: StockTransactionType.ISSUE_OUT,
          balanceBefore: new Prisma.Decimal(5),
          balanceAfter: new Prisma.Decimal(5),
        }),
      }),
    );
  });

  it.each([
    ['recipient', destinationId],
    ['unrelated MVO', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
  ])('does not let the %s create an ISSUE', async (_label, personId) => {
    const h = harness();
    prepareTransferIssue(h);

    await expect(
      h.service.createAndPostTransferIssue(
        documentId,
        transferIssueDto(),
        [attachmentFile()],
        user(UserRole.MVO, personId),
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(h.tx.stockDocument.create).not.toHaveBeenCalled();
  });

  it.each([StockDocumentStatus.DRAFT, StockDocumentStatus.CANCELLED])(
    'rejects a %s parent transfer',
    async (status) => {
      const h = harness();
      prepareTransferIssue(h, { status });

      await expect(
        h.service.createAndPostTransferIssue(
          documentId,
          transferIssueDto(),
          [attachmentFile()],
          mvo,
          {},
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(h.tx.stockDocument.create).not.toHaveBeenCalled();
    },
  );

  it('rejects quantity above the derived available amount', async () => {
    const h = harness();
    prepareTransferIssue(h, { transferred: '5', issued: '3' });

    await expect(
      h.service.createAndPostTransferIssue(
        documentId,
        transferIssueDto({
          lines: [{ sourceTransferLineId: lineId, quantity: '3' }],
        }),
        [attachmentFile()],
        mvo,
        {},
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(h.tx.stockDocument.create).not.toHaveBeenCalled();
  });

  it('allows issuing exactly the remaining transferred quantity', async () => {
    const h = harness();
    prepareTransferIssue(h, { transferred: '5', issued: '2' });

    await expect(
      h.service.createAndPostTransferIssue(
        documentId,
        transferIssueDto({
          lines: [{ sourceTransferLineId: lineId, quantity: '3' }],
        }),
        [attachmentFile()],
        mvo,
        {},
      ),
    ).resolves.toMatchObject({ status: StockDocumentStatus.POSTED });
    expect(h.stock.createDecreasingTransactionInTx).not.toHaveBeenCalled();
  });

  it('derives issued and available quantities from POSTED child lines only', async () => {
    const h = harness();
    const transfer = viewDocument(
      StockDocumentStatus.POSTED,
      StockDocumentType.MVO_TRANSFER,
      [
        line({
          quantity: new Prisma.Decimal('5'),
          issueLines: [
            {
              quantity: new Prisma.Decimal('2'),
              document: { status: StockDocumentStatus.POSTED },
            },
            {
              quantity: new Prisma.Decimal('1'),
              document: { status: StockDocumentStatus.CANCELLED },
            },
          ],
        }),
      ],
    );
    h.prisma.stockDocument.findUnique.mockResolvedValue(transfer);

    const result = await h.service.findOne(documentId, mvo);

    expect(result.lines[0]).toMatchObject({
      quantity: '5',
      issuedQuantity: '2',
      availableToIssue: '3',
    });
  });

  it('locks the parent transfer before calculating availability', async () => {
    const h = harness();
    prepareTransferIssue(h);

    await h.service.createAndPostTransferIssue(
      documentId,
      transferIssueDto(),
      [attachmentFile()],
      mvo,
      {},
    );

    expect(h.tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(h.tx.stockDocumentLine.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          document: {
            type: StockDocumentType.ISSUE,
            status: StockDocumentStatus.POSTED,
          },
        }),
      }),
    );
  });

  it('blocks cancelling a transfer with an active child ISSUE', async () => {
    const h = harness();
    h.tx.stockDocument.findUnique.mockResolvedValueOnce({
      type: StockDocumentType.MVO_TRANSFER,
      accountingModel: StockAccountingModel.DIRECT_BALANCE,
      accountingExportState: AccountingExportState.NOT_EXPORTED,
      status: StockDocumentStatus.POSTED,
      sourceResponsiblePersonId: sourceId,
      sourceTransferId: null,
    });
    h.tx.stockDocument.count.mockResolvedValue(1);

    await expect(h.service.cancel(documentId, mvo, {})).rejects.toThrow(
      'Передачу неможливо скасувати, оскільки з переданого майна вже оформлено видачу.',
    );
    expect(h.tx.stockDocument.updateMany).not.toHaveBeenCalled();
    expect(h.stock.createIncreasingTransactionInTx).not.toHaveBeenCalled();
  });

  it('cancels a child ISSUE without restoring StockBalance', async () => {
    const h = harness();
    const issueLine = line({
      sourceBalanceId: null,
      sourceTransferLineId: lineId,
      transactions: [
        { id: 'issue-out', type: StockTransactionType.ISSUE_OUT },
      ],
    });
    h.tx.stockDocument.findUnique
      .mockResolvedValueOnce({
        type: StockDocumentType.ISSUE,
        accountingModel: StockAccountingModel.DIRECT_BALANCE,
        accountingExportState: AccountingExportState.NOT_EXPORTED,
        status: StockDocumentStatus.POSTED,
        sourceResponsiblePersonId: sourceId,
        sourceTransferId: documentId,
      })
      .mockResolvedValueOnce({
        ...rawDocument(
          StockDocumentStatus.POSTED,
          StockDocumentType.ISSUE,
          [issueLine],
        ),
        sourceTransferId: documentId,
      });
    h.tx.stockBalance.findUnique.mockResolvedValue({
      quantity: new Prisma.Decimal('5'),
    });
    h.prisma.stockDocument.findUnique.mockResolvedValue({
      ...viewDocument(
        StockDocumentStatus.CANCELLED,
        StockDocumentType.ISSUE,
        [issueLine],
      ),
      sourceTransferId: documentId,
    });

    const result = await h.service.cancel(documentId, mvo, {});

    expect(result.status).toBe(StockDocumentStatus.CANCELLED);
    expect(h.stock.createIncreasingTransactionInTx).not.toHaveBeenCalled();
    expect(h.stock.createDecreasingTransactionInTx).not.toHaveBeenCalled();
    expect(h.tx.stockTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: StockTransactionType.ISSUE_REVERSAL,
          balanceBefore: new Prisma.Decimal(5),
          balanceAfter: new Prisma.Decimal(5),
          reversalOfTransactionId: 'issue-out',
        }),
      }),
    );
  });

  it('keeps a multi-line ISSUE atomic when one line is not in the transfer', async () => {
    const h = harness();
    prepareTransferIssue(h);

    await expect(
      h.service.createAndPostTransferIssue(
        documentId,
        transferIssueDto({
          lines: [
            { sourceTransferLineId: lineId, quantity: '1' },
            {
              sourceTransferLineId:
                'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
              quantity: '1',
            },
          ],
        }),
        [attachmentFile()],
        mvo,
        {},
      ),
    ).rejects.toThrow('не належить цій передачі');
    expect(h.tx.stockDocument.create).not.toHaveBeenCalled();
    expect(h.storage.removeAfterMetadataFailure).toHaveBeenCalledWith(
      'stored-1.pdf',
    );
  });
});
