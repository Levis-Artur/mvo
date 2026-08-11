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
const secondItemId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const balanceId = '55555555-5555-4555-8555-555555555555';
const secondBalanceId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const documentId = '66666666-6666-4666-8666-666666666666';
const lineId = '77777777-7777-4777-8777-777777777777';

function user(role: UserRole, responsiblePersonId: string | null) {
  return {
    id:
      role === UserRole.MVO
        ? '11111111-1111-4111-8111-111111111111'
        : '99999999-9999-4999-8999-999999999999',
    username: role.toLowerCase(),
    role,
    isActive: true,
    mustChangePassword: false,
    responsiblePersonId,
  };
}

const mvo = user(UserRole.MVO, sourceId);

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
    createdAt: new Date('2026-08-10T00:00:00.000Z'),
    transactions: [],
    issueLines: [],
    ...overrides,
  };
}

function person(id: string) {
  return {
    id,
    lastName: id === sourceId ? 'Жигульський' : 'Левіс',
    firstName: id === sourceId ? 'Андрій' : 'Артур',
    middleName: null,
    personnelNumber: id === sourceId ? '57' : '61',
    externalAccountingCode: id === sourceId ? '0057' : '0061',
    isActive: true,
  };
}

function rawDocument(
  status: StockDocumentStatus = StockDocumentStatus.POSTED,
  type: StockDocumentType = StockDocumentType.ISSUE,
  lines = [line()],
) {
  return {
    id: documentId,
    documentNumber: 'MOV-TEST',
    displayNumber: 7,
    documentDate: new Date('2026-08-10T00:00:00.000Z'),
    type,
    accountingModel: StockAccountingModel.DIRECT_BALANCE,
    accountingExportState: AccountingExportState.NOT_EXPORTED,
    status,
    sourceResponsiblePersonId: sourceId,
    destinationResponsiblePersonId:
      type === StockDocumentType.MVO_TRANSFER ? destinationId : null,
    recipientName: type === StockDocumentType.ISSUE ? 'Отримувач майна' : null,
    recipientUnit: type === StockDocumentType.ISSUE ? 'Підрозділ' : null,
    basis: type === StockDocumentType.ISSUE ? 'Службова потреба' : null,
    note: 'Примітка',
    createdByUserId: mvo.id,
    postedByUserId: mvo.id,
    postedAt: new Date('2026-08-10T10:00:00.000Z'),
    cancelledByUserId: null,
    cancelledAt: null,
    exportedByUserId: null,
    exportedAt: null,
    sourceTransferId: null,
    createdAt: new Date('2026-08-10T09:00:00.000Z'),
    updatedAt: new Date('2026-08-10T10:00:00.000Z'),
    lines,
    attachments: [],
  };
}

function viewDocument(
  status: StockDocumentStatus = StockDocumentStatus.POSTED,
  type: StockDocumentType = StockDocumentType.ISSUE,
  lines = [line()],
) {
  return {
    ...rawDocument(status, type, lines),
    sourceResponsiblePerson: person(sourceId),
    destinationResponsiblePerson:
      type === StockDocumentType.MVO_TRANSFER ? person(destinationId) : null,
    createdByUser: { id: mvo.id, username: mvo.username, role: mvo.role },
    postedByUser: { id: mvo.id, username: mvo.username, role: mvo.role },
    cancelledByUser: null,
    exportedByUser: null,
    sourceTransfer: null,
    issues: [],
    lines: lines.map((entry) => ({
      ...entry,
      inventoryItem: {
        id: entry.inventoryItemId,
        externalCode: entry.inventoryItemId === itemId ? 'KB-1' : 'MS-1',
        name: entry.inventoryItemId === itemId ? 'Клавіатура' : 'Миша',
        unitOfMeasure: 'шт.',
      },
      accountingOwnerResponsiblePerson: null,
      sourceCustodianResponsiblePerson: null,
      sourceCustodyBalance: null,
      issueLines: entry.issueLines ?? [],
    })),
  };
}

function issueDto(overrides: Record<string, unknown> = {}) {
  return {
    documentDate: '2026-08-10T00:00:00.000Z',
    recipientName: 'Отримувач майна',
    recipientUnit: 'Підрозділ',
    basis: 'Службова потреба',
    note: 'Примітка до видачі',
    lines: [
      {
        inventoryItemId: itemId,
        sourceBalanceId: balanceId,
        quantity: '15',
      },
    ],
    ...overrides,
  };
}

function transferDto(overrides: Record<string, unknown> = {}) {
  return {
    documentDate: '2026-08-10T00:00:00.000Z',
    destinationResponsiblePersonId: destinationId,
    note: 'Передача',
    lines: [
      {
        inventoryItemId: itemId,
        sourceBalanceId: balanceId,
        quantity: '20',
      },
    ],
    ...overrides,
  };
}

function attachmentFile(): Express.Multer.File {
  const buffer = Buffer.from('%PDF-1.7 invoice');
  return {
    fieldname: 'files',
    originalname: 'накладна.pdf',
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
    },
    stockTransaction: { create: jest.fn() },
    stockDocumentAttachment: { deleteMany: jest.fn() },
    issueRealization: { count: jest.fn().mockResolvedValue(0) },
    stockBalance: { findUnique: jest.fn() },
    responsiblePerson: {
      findUnique: jest.fn().mockResolvedValue(person(sourceId)),
    },
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
    responsiblePerson: {
      findUnique: jest.fn().mockResolvedValue(person(destinationId)),
    },
    securityEvent: { create: jest.fn() },
    $transaction: jest.fn(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    ),
  };
  const stock = {
    createDecreasingTransactionInTx: jest.fn().mockResolvedValue({
      id: 'transaction-out',
      balanceBefore: new Prisma.Decimal(100),
      balanceAfter: new Prisma.Decimal(85),
    }),
    createIncreasingTransactionInTx: jest.fn().mockResolvedValue({
      id: 'transaction-reversal',
      balanceBefore: new Prisma.Decimal(85),
      balanceAfter: new Prisma.Decimal(100),
    }),
  };
  const storage = {
    store: jest.fn().mockResolvedValue({
      originalFileName: 'накладна.pdf',
      storedFileName: 'stored.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 128,
      sha256: 'a'.repeat(64),
      storagePath: 'stored.pdf',
    }),
    removeAfterMetadataFailure: jest.fn(),
    assertStoredFilesExist: jest.fn(),
    stageForDeletion: jest.fn(),
    restoreStaged: jest.fn(),
    finalizeDeletion: jest.fn(),
  };
  return {
    service: new StockDocumentsService(
      prisma as never,
      stock as never,
      storage as never,
    ),
    prisma,
    tx,
    stock,
    storage,
  };
}

function prepareIssueCreate(
  h: ReturnType<typeof harness>,
  lines = [line({ quantity: new Prisma.Decimal(15) })],
) {
  h.tx.stockDocument.create.mockResolvedValue(
    rawDocument(StockDocumentStatus.POSTED, StockDocumentType.ISSUE, lines),
  );
  h.tx.stockBalance.findUnique.mockImplementation(({ where }) => {
    const id = where.id;
    if (id === balanceId) {
      return Promise.resolve({
        id: balanceId,
        responsiblePersonId: sourceId,
        inventoryItemId: itemId,
      });
    }
    return Promise.resolve({
      id: secondBalanceId,
      responsiblePersonId: sourceId,
      inventoryItemId: secondItemId,
    });
  });
  h.prisma.stockDocument.findUnique.mockResolvedValue(
    viewDocument(StockDocumentStatus.POSTED, StockDocumentType.ISSUE, lines),
  );
}

describe('StockDocumentsService standalone ISSUE', () => {
  it('creates a POSTED ISSUE from the authenticated MVO direct balance', async () => {
    const h = harness();
    prepareIssueCreate(h);

    const result = await h.service.createAndPostIssue(
      issueDto(),
      [attachmentFile()],
      mvo,
      { requestId: 'issue-request' },
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: StockDocumentStatus.POSTED,
        displayNumber: 7,
        recipientName: 'Отримувач майна',
      }),
    );
    expect(h.tx.stockDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: StockDocumentType.ISSUE,
          status: StockDocumentStatus.POSTED,
          sourceResponsiblePersonId: sourceId,
          sourceTransferId: null,
          destinationResponsiblePersonId: null,
          recipientName: 'Отримувач майна',
          note: 'Примітка до видачі',
          attachments: {
            create: [
              expect.objectContaining({
                originalFileName: 'накладна.pdf',
                uploadedByUserId: mvo.id,
              }),
            ],
          },
        }),
      }),
    );
    const createdLines = h.tx.stockDocument.create.mock.calls[0][0].data.lines
      .create;
    expect(createdLines[0]).toEqual(
      expect.objectContaining({
        sourceBalanceId: balanceId,
        quantity: new Prisma.Decimal(15),
      }),
    );
    expect(createdLines[0].sourceTransferLineId).toBeNull();
    expect(h.stock.createDecreasingTransactionInTx).toHaveBeenCalledWith(
      h.tx,
      expect.objectContaining({
        type: StockTransactionType.ISSUE_OUT,
        responsiblePersonId: sourceId,
        inventoryItemId: itemId,
        quantity: new Prisma.Decimal(15),
      }),
    );
    expect(h.tx.stockDocumentLine.update).toHaveBeenCalledWith({
      where: { id: lineId },
      data: {
        quantityBefore: new Prisma.Decimal(100),
        quantityAfter: new Prisma.Decimal(85),
      },
    });
    expect(h.stock.createIncreasingTransactionInTx).not.toHaveBeenCalled();
  });

  it('does not trust a source MVO from the request payload', async () => {
    const h = harness();
    prepareIssueCreate(h);
    const malicious = issueDto() as ReturnType<typeof issueDto> & {
      sourceResponsiblePersonId: string;
    };
    malicious.sourceResponsiblePersonId = destinationId;

    await h.service.createAndPostIssue(
      malicious,
      [attachmentFile()],
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

  it.each([
    UserRole.OWNER,
    UserRole.DPP_ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.AUDITOR,
  ])('%s cannot create an ISSUE without MVO auth context', async (role) => {
    const h = harness();
    await expect(
      h.service.createAndPostIssue(
        issueDto(),
        [attachmentFile()],
        user(role, null),
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(h.storage.store).not.toHaveBeenCalled();
  });

  it('rejects a non-positive quantity before storing files', async () => {
    const h = harness();
    await expect(
      h.service.createAndPostIssue(
        issueDto({
          lines: [
            {
              inventoryItemId: itemId,
              sourceBalanceId: balanceId,
              quantity: '0',
            },
          ],
        }),
        [attachmentFile()],
        mvo,
        {},
      ),
    ).rejects.toThrow('має бути додатною');
    expect(h.storage.store).not.toHaveBeenCalled();
  });

  it('requires a confirming attachment', async () => {
    const h = harness();
    await expect(
      h.service.createAndPostIssue(issueDto(), [], mvo, {}),
    ).rejects.toThrow('додайте хоча б одне фото або скан накладної');
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects insufficient stock and removes the staged file', async () => {
    const h = harness();
    prepareIssueCreate(h);
    h.stock.createDecreasingTransactionInTx.mockRejectedValueOnce(
      new BadRequestException('Недостатній залишок'),
    );

    await expect(
      h.service.createAndPostIssue(
        issueDto(),
        [attachmentFile()],
        mvo,
        {},
      ),
    ).rejects.toThrow('Недостатній залишок');
    expect(h.storage.removeAfterMetadataFailure).toHaveBeenCalledWith(
      'stored.pdf',
    );
  });

  it('keeps a multi-line ISSUE atomic when a later line fails', async () => {
    const h = harness();
    const secondLine = line({
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      inventoryItemId: secondItemId,
      sourceBalanceId: secondBalanceId,
      quantity: new Prisma.Decimal(4),
    });
    prepareIssueCreate(h, [line({ quantity: new Prisma.Decimal(3) }), secondLine]);
    h.stock.createDecreasingTransactionInTx
      .mockResolvedValueOnce({
        id: 'first-out',
        balanceBefore: new Prisma.Decimal(10),
        balanceAfter: new Prisma.Decimal(7),
      })
      .mockRejectedValueOnce(new BadRequestException('Недостатній залишок'));

    await expect(
      h.service.createAndPostIssue(
        issueDto({
          lines: [
            {
              inventoryItemId: itemId,
              sourceBalanceId: balanceId,
              quantity: '3',
            },
            {
              inventoryItemId: secondItemId,
              sourceBalanceId: secondBalanceId,
              quantity: '4',
            },
          ],
        }),
        [attachmentFile()],
        mvo,
        {},
      ),
    ).rejects.toThrow('Недостатній залишок');
    expect(h.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(h.storage.removeAfterMetadataFailure).toHaveBeenCalledWith(
      'stored.pdf',
    );
  });

  it('cancels standalone ISSUE by restoring the same direct balance', async () => {
    const h = harness();
    const issuedLine = line({
      quantity: new Prisma.Decimal(15),
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
        sourceTransferId: null,
      })
      .mockResolvedValueOnce(
        rawDocument(
          StockDocumentStatus.POSTED,
          StockDocumentType.ISSUE,
          [issuedLine],
        ),
      );
    h.prisma.stockDocument.findUnique.mockResolvedValue(
      viewDocument(
        StockDocumentStatus.CANCELLED,
        StockDocumentType.ISSUE,
        [issuedLine],
      ),
    );

    await h.service.cancel(documentId, mvo, {});

    expect(h.stock.createIncreasingTransactionInTx).toHaveBeenCalledWith(
      h.tx,
      expect.objectContaining({
        type: StockTransactionType.ISSUE_REVERSAL,
        responsiblePersonId: sourceId,
        quantity: new Prisma.Decimal(15),
        reversalOfTransactionId: 'issue-out',
      }),
    );
  });

  it('does not restore stock twice after a repeated cancellation', async () => {
    const h = harness();
    h.tx.stockDocument.findUnique.mockResolvedValueOnce({
      type: StockDocumentType.ISSUE,
      accountingModel: StockAccountingModel.DIRECT_BALANCE,
      accountingExportState: AccountingExportState.NOT_EXPORTED,
      status: StockDocumentStatus.CANCELLED,
      sourceResponsiblePersonId: sourceId,
      sourceTransferId: null,
    });
    h.prisma.stockDocument.findUnique.mockResolvedValue(
      viewDocument(StockDocumentStatus.CANCELLED),
    );

    await h.service.cancel(documentId, mvo, {});

    expect(h.stock.createIncreasingTransactionInTx).not.toHaveBeenCalled();
  });

  it('blocks ISSUE cancellation while a POSTED realization exists', async () => {
    const h = harness();
    h.tx.stockDocument.findUnique.mockResolvedValueOnce({
      type: StockDocumentType.ISSUE,
      accountingModel: StockAccountingModel.DIRECT_BALANCE,
      accountingExportState: AccountingExportState.NOT_EXPORTED,
      status: StockDocumentStatus.POSTED,
      sourceResponsiblePersonId: sourceId,
      sourceTransferId: null,
    });
    h.tx.issueRealization.count.mockResolvedValue(1);

    await expect(h.service.cancel(documentId, mvo, {})).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(h.stock.createIncreasingTransactionInTx).not.toHaveBeenCalled();
  });
});

describe('StockDocumentsService independent MVO_TRANSFER', () => {
  it('decreases only the sender and never creates recipient stock', async () => {
    const h = harness();
    const transferLine = line({ quantity: new Prisma.Decimal(20) });
    h.tx.stockDocument.create.mockResolvedValue(
      rawDocument(
        StockDocumentStatus.POSTED,
        StockDocumentType.MVO_TRANSFER,
        [transferLine],
      ),
    );
    h.tx.stockBalance.findUnique.mockResolvedValue({
      id: balanceId,
      responsiblePersonId: sourceId,
      inventoryItemId: itemId,
    });
    h.prisma.stockDocument.findUnique.mockResolvedValue(
      viewDocument(
        StockDocumentStatus.POSTED,
        StockDocumentType.MVO_TRANSFER,
        [transferLine],
      ),
    );
    h.stock.createDecreasingTransactionInTx.mockResolvedValueOnce({
      id: 'transfer-out',
      balanceBefore: new Prisma.Decimal(100),
      balanceAfter: new Prisma.Decimal(80),
    });

    await h.service.createAndPostMvoTransfer(transferDto(), mvo, {});

    expect(h.stock.createDecreasingTransactionInTx).toHaveBeenCalledWith(
      h.tx,
      expect.objectContaining({
        type: StockTransactionType.MVO_TRANSFER_OUT,
        responsiblePersonId: sourceId,
        quantity: new Prisma.Decimal(20),
      }),
    );
    expect(h.stock.createIncreasingTransactionInTx).not.toHaveBeenCalled();
    expect(h.tx).not.toHaveProperty('custodyBalance');
  });

  it('does not expose the sender transfer to its recipient MVO', async () => {
    const h = harness();
    h.prisma.stockDocument.findUnique.mockResolvedValue(
      viewDocument(
        StockDocumentStatus.POSTED,
        StockDocumentType.MVO_TRANSFER,
      ),
    );

    await expect(
      h.service.findOne(documentId, user(UserRole.MVO, destinationId)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a transfer to the sender before starting a transaction', async () => {
    const h = harness();
    await expect(
      h.service.createAndPostMvoTransfer(
        transferDto({ destinationResponsiblePersonId: sourceId }),
        mvo,
        {},
      ),
    ).rejects.toThrow('не можуть бути одним МВО');
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a balance owned by another MVO', async () => {
    const h = harness();
    const transferLine = line({ quantity: new Prisma.Decimal(20) });
    h.tx.stockDocument.create.mockResolvedValue(
      rawDocument(
        StockDocumentStatus.POSTED,
        StockDocumentType.MVO_TRANSFER,
        [transferLine],
      ),
    );
    h.tx.stockBalance.findUnique.mockResolvedValue({
      id: balanceId,
      responsiblePersonId: destinationId,
      inventoryItemId: itemId,
    });

    await expect(
      h.service.createAndPostMvoTransfer(transferDto(), mvo, {}),
    ).rejects.toThrow('не належить МВО-відправнику');
    expect(h.stock.createDecreasingTransactionInTx).not.toHaveBeenCalled();
  });

  it('rejects insufficient sender stock without changing recipient stock', async () => {
    const h = harness();
    const transferLine = line({ quantity: new Prisma.Decimal(20) });
    h.tx.stockDocument.create.mockResolvedValue(
      rawDocument(
        StockDocumentStatus.POSTED,
        StockDocumentType.MVO_TRANSFER,
        [transferLine],
      ),
    );
    h.tx.stockBalance.findUnique.mockResolvedValue({
      id: balanceId,
      responsiblePersonId: sourceId,
      inventoryItemId: itemId,
    });
    h.stock.createDecreasingTransactionInTx.mockRejectedValueOnce(
      new BadRequestException('Недостатній залишок'),
    );

    await expect(
      h.service.createAndPostMvoTransfer(transferDto(), mvo, {}),
    ).rejects.toThrow('Недостатній залишок');
    expect(h.stock.createIncreasingTransactionInTx).not.toHaveBeenCalled();
  });

  it('restores only the sender when a POSTED transfer is cancelled', async () => {
    const h = harness();
    const transferLine = line({
      quantity: new Prisma.Decimal(20),
      transactions: [
        { id: 'transfer-out', type: StockTransactionType.MVO_TRANSFER_OUT },
      ],
    });
    h.tx.stockDocument.findUnique
      .mockResolvedValueOnce({
        type: StockDocumentType.MVO_TRANSFER,
        accountingModel: StockAccountingModel.DIRECT_BALANCE,
        accountingExportState: AccountingExportState.NOT_EXPORTED,
        status: StockDocumentStatus.POSTED,
        sourceResponsiblePersonId: sourceId,
        sourceTransferId: null,
      })
      .mockResolvedValueOnce(
        rawDocument(
          StockDocumentStatus.POSTED,
          StockDocumentType.MVO_TRANSFER,
          [transferLine],
        ),
      );
    h.prisma.stockDocument.findUnique.mockResolvedValue(
      viewDocument(
        StockDocumentStatus.CANCELLED,
        StockDocumentType.MVO_TRANSFER,
        [transferLine],
      ),
    );

    await h.service.cancel(documentId, mvo, {});

    expect(h.stock.createIncreasingTransactionInTx).toHaveBeenCalledWith(
      h.tx,
      expect.objectContaining({
        type: StockTransactionType.MVO_TRANSFER_REVERSAL,
        responsiblePersonId: sourceId,
        reversalOfTransactionId: 'transfer-out',
      }),
    );
  });

  it('keeps ACCOUNTANT read-only for transfers', async () => {
    const h = harness();
    await expect(
      h.service.createAndPostMvoTransfer(
        transferDto(),
        user(UserRole.ACCOUNTANT, null),
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });
});
