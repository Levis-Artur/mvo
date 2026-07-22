import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
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
    quantityBefore: null,
    quantityAfter: null,
    quantity: new Prisma.Decimal(2),
    note: null,
    createdAt: new Date('2026-07-21T00:00:00.000Z'),
    transactions: [],
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
    accountingModel: type === StockDocumentType.MVO_TRANSFER
      ? StockAccountingModel.DIRECT_BALANCE
      : StockAccountingModel.OWNER_CUSTODY,
    accountingExportState: AccountingExportState.NOT_EXPORTED,
    status,
    sourceResponsiblePersonId: sourceId,
    destinationResponsiblePersonId: destinationId,
    recipientName: type === StockDocumentType.ISSUE ? 'Одержувач' : null,
    recipientUnit: null,
    basis: type === StockDocumentType.ISSUE ? 'Підстава' : null,
    note: null,
    createdByUserId: mvo.id,
    postedByUserId: status === StockDocumentStatus.POSTED ? mvo.id : null,
    postedAt: status === StockDocumentStatus.POSTED ? new Date() : null,
    cancelledByUserId: null,
    cancelledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lines,
    attachments: [],
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

function harness() {
  const tx = {
    stockDocument: {
      findUnique: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn(),
      delete: jest.fn(),
    },
    stockDocumentLine: {
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    stockDocumentAttachment: { deleteMany: jest.fn() },
    stockBalance: { findUnique: jest.fn() },
    responsiblePerson: { findUnique: jest.fn().mockResolvedValue({ id: destinationId, isActive: true }) },
    securityEvent: { create: jest.fn() },
  };
  const prisma = {
    stockDocument: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
    },
    stockDocumentAttachment: { findMany: jest.fn().mockResolvedValue([]) },
    responsiblePerson: { findUnique: jest.fn().mockResolvedValue({ id: destinationId, isActive: true }) },
    securityEvent: { create: jest.fn() },
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  const stock = {
    createDecreasingTransactionInTx: jest.fn(),
    createIncreasingTransactionInTx: jest.fn(),
  };
  const storage = {
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

describe('StockDocumentsService MVO_TRANSFER', () => {
  it('scopes an MVO list to documents created by or sent from the current MVO', async () => {
    const h = harness();
    await h.service.list({ page: 1, limit: 20, sourceResponsiblePersonId: destinationId }, mvo);
    expect(h.prisma.stockDocument.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: [{ createdByUserId: mvo.id }, { sourceResponsiblePersonId: sourceId }],
      }),
    }));
  });

  it('creates MVO_TRANSFER with only a direct source balance', async () => {
    const h = harness();
    h.prisma.stockDocument.create.mockResolvedValue(viewDocument());
    await h.service.create(dto(), mvo, {});
    expect(h.prisma.stockDocument.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      type: StockDocumentType.MVO_TRANSFER,
      accountingModel: StockAccountingModel.DIRECT_BALANCE,
      lines: { create: [expect.objectContaining({ sourceBalanceId: balanceId, sourceKind: null })] },
    }) }));
  });

  it('forbids transfer to the sender', async () => {
    const h = harness();
    await expect(h.service.create(dto({ destinationResponsiblePersonId: sourceId }), mvo, {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('forbids an inactive recipient', async () => {
    const h = harness();
    h.prisma.responsiblePerson.findUnique.mockResolvedValue({ id: destinationId, isActive: false });
    await expect(h.service.create(dto(), mvo, {})).rejects.toThrow('деактивовано');
  });

  it('does not let MVO substitute another source', async () => {
    const h = harness();
    await expect(h.service.create(dto({ sourceResponsiblePersonId: destinationId }), mvo, {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each([UserRole.ACCOUNTANT, UserRole.AUDITOR])('%s is read-only', async (role) => {
    const h = harness();
    await expect(h.service.create(dto(), user(role, null), {})).rejects.toBeInstanceOf(ForbiddenException);
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

  it('keeps new ISSUE on the direct balance path', async () => {
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
    await h.service.post(documentId, mvo, {});
    expect(h.stock.createDecreasingTransactionInTx).toHaveBeenCalledWith(h.tx, expect.objectContaining({ type: StockTransactionType.ISSUE_OUT }));
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
});
