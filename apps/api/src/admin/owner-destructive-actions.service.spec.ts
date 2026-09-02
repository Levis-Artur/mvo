import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ImportStatus, Prisma, SecurityEventType, UserRole } from '@prisma/client';
import { OwnerDestructiveActionsService } from './owner-destructive-actions.service';

const owner = {
  id: 'owner-id',
  username: 'owner',
  role: UserRole.OWNER,
  isActive: true,
  mustChangePassword: false,
  responsiblePersonId: null,
};

function createService() {
  const tx = {
    stockTransaction: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    stockBalance: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    custodyBalance: { findMany: jest.fn(), deleteMany: jest.fn() },
    importRow: {
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    importBatch: {
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    userSession: { deleteMany: jest.fn() },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    stockDocument: {
      findMany: jest.fn(), updateMany: jest.fn(), deleteMany: jest.fn(),
    },
    stockDocumentLine: {
      findMany: jest.fn(), updateMany: jest.fn(), deleteMany: jest.fn(),
    },
    stockDocumentAttachment: { deleteMany: jest.fn() },
    issueRealization: {
      findMany: jest.fn(), updateMany: jest.fn(), deleteMany: jest.fn(),
    },
    issueRealizationLine: { findMany: jest.fn(), deleteMany: jest.fn() },
    issueRealizationAttachment: { deleteMany: jest.fn() },
    accountingTransferExportBatchDocument: { findMany: jest.fn() },
    accountingTransferExportBatch: { deleteMany: jest.fn() },
    responsiblePerson: {
      findUniqueOrThrow: jest.fn(), delete: jest.fn(), deleteMany: jest.fn(),
    },
    inventoryItem: {
      findUniqueOrThrow: jest.fn(), delete: jest.fn(), deleteMany: jest.fn(),
    },
    unit: { delete: jest.fn(), deleteMany: jest.fn() },
    service: { delete: jest.fn(), deleteMany: jest.fn() },
    management: { delete: jest.fn(), deleteMany: jest.fn() },
    securityEvent: { create: jest.fn() },
    $queryRaw: jest.fn(),
  };
  const prisma = {
    user: { findUnique: jest.fn(), count: jest.fn() },
    importBatch: { findUnique: jest.fn() },
    responsiblePerson: { findUnique: jest.fn() },
    custodyBalance: { count: jest.fn() },
    stockDocument: { count: jest.fn() },
    stockDocumentLine: { count: jest.fn() },
    stockDocumentAttachment: { count: jest.fn(), findMany: jest.fn() },
    issueRealization: { count: jest.fn() },
    issueRealizationAttachment: { count: jest.fn(), findMany: jest.fn() },
    issueRealizationLine: { count: jest.fn() },
    accountingTransferExportBatch: { count: jest.fn() },
    inventoryItem: { findUnique: jest.fn() },
    unit: { findUnique: jest.fn() },
    service: { findUnique: jest.fn() },
    management: { findUnique: jest.fn() },
    securityEvent: { create: jest.fn() },
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  const businessDataReset = {
    run: jest.fn().mockResolvedValue({
      preserved: { ownerUsers: 1, ownerSessions: 1 },
      deleteCandidates: {
        nonOwnerUsers: 2,
        userAccessScopes: 3,
        managements: 1,
        services: 3,
        units: 2,
        responsiblePersons: 4,
        inventoryItems: 5,
        stockBalances: 6,
        custodyBalances: 1,
        stockTransactions: 8,
        stockDocuments: 7,
        mvoTransfers: 3,
        issues: 4,
        stockDocumentLines: 11,
        issueRealizations: 2,
        issueRealizationLines: 5,
        stockDocumentAttachments: 2,
        issueRealizationAttachments: 1,
        importBatches: 1,
        importRows: 9,
        accountingExportBatches: 1,
        securityEvents: 10,
      },
      deleted: null,
      attachmentFilesDeleted: 3,
      orphanAttachmentFiles: 1,
    }),
  };
  const stockService = { createIncreasingTransactionInTx: jest.fn() };
  const stockDocuments = { cancelForOwnerDeletionInTx: jest.fn() };
  const attachmentStorage = {
    stageForDeletion: jest.fn(),
    restoreStaged: jest.fn(),
    finalizeDeletion: jest.fn(),
  };

  return {
    service: new OwnerDestructiveActionsService(
      prisma as never,
      businessDataReset as never,
      stockService as never,
      stockDocuments as never,
      attachmentStorage as never,
    ),
    prisma,
    tx,
    businessDataReset,
    stockService,
    stockDocuments,
    attachmentStorage,
  };
}

function prepareInventoryDelete(h: ReturnType<typeof createService>) {
  h.prisma.inventoryItem.findUnique.mockResolvedValue({
    id: 'item-x', externalCode: 'X', name: 'Item X',
    _count: {
      stockBalances: 1, custodyBalances: 1, stockTransactions: 1,
      stockDocumentLines: 1, importRows: 1,
    },
  });
  h.prisma.stockDocument.count
    .mockResolvedValueOnce(1)
    .mockResolvedValueOnce(1);
  h.prisma.issueRealizationLine.count.mockResolvedValue(0);
  h.prisma.issueRealization.count.mockResolvedValue(0);
  h.prisma.stockDocumentAttachment.count.mockResolvedValue(0);
  h.prisma.issueRealizationAttachment.count.mockResolvedValue(0);
  h.prisma.accountingTransferExportBatch.count.mockResolvedValue(0);
  h.prisma.stockDocumentAttachment.findMany.mockResolvedValue([]);
  h.prisma.issueRealizationAttachment.findMany.mockResolvedValue([]);
  h.tx.inventoryItem.findUniqueOrThrow.mockResolvedValue({ id: 'item-x' });
  h.tx.stockDocumentLine.findMany.mockResolvedValue([
    { id: 'line-x', documentId: 'document-id' },
  ]);
  h.tx.stockDocument.findMany.mockResolvedValue([
    { id: 'document-id', _count: { lines: 0 } },
  ]);
  h.tx.issueRealizationLine.findMany.mockResolvedValue([]);
  h.tx.issueRealization.findMany.mockResolvedValue([]);
  h.tx.accountingTransferExportBatchDocument.findMany.mockResolvedValue([]);
  h.tx.stockTransaction.findMany.mockResolvedValue([
    { id: 'transaction-x' },
  ]);
  h.tx.custodyBalance.findMany.mockResolvedValue([{ id: 'custody-x' }]);
  h.tx.stockBalance.findMany.mockResolvedValue([{ id: 'balance-x' }]);
}

describe('OwnerDestructiveActionsService', () => {
  beforeEach(() => {
    process.env.OWNER_DESTRUCTIVE_ACTIONS_ENABLED = 'true';
  });

  afterEach(() => {
    delete process.env.OWNER_DESTRUCTIVE_ACTIONS_ENABLED;
    delete process.env.ALLOW_BUSINESS_DATA_RESET;
  });

  it.each([UserRole.MVO, UserRole.DPP_ADMIN, UserRole.AUDITOR])(
    'rejects role %s',
    async (role) => {
      const { service } = createService();
      await expect(
        service.deletionPreview({ ...owner, role }, 'users', 'user-id'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    },
  );

  it('allows OWNER entity preview when the feature flag is false', async () => {
    process.env.OWNER_DESTRUCTIVE_ACTIONS_ENABLED = 'false';
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-id', username: 'test-user', role: UserRole.MVO, isActive: true,
      _count: {
        sessions: 0, accessScopes: 0, createdStockDocuments: 0,
        uploadedStockDocumentAttachments: 0, createdIssueRealizations: 0,
        uploadedIssueRealizationAttachments: 0,
        accountingTransferExportBatches: 0,
      },
    });
    prisma.user.count.mockResolvedValue(1);

    await expect(
      service.deletionPreview(owner, 'users', 'user-id'),
    ).resolves.toMatchObject({ canDelete: true });
  });

  it('returns a deletion preview for OWNER', async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      username: 'test-user',
      role: UserRole.MVO,
      isActive: true,
      _count: {
        sessions: 2, accessScopes: 1, createdStockDocuments: 0,
        uploadedStockDocumentAttachments: 0, createdIssueRealizations: 0,
        uploadedIssueRealizationAttachments: 0,
        accountingTransferExportBatches: 0,
      },
    });
    prisma.user.count.mockResolvedValue(1);

    await expect(
      service.deletionPreview(owner, 'users', 'user-id'),
    ).resolves.toEqual({
      entityType: 'users',
      entityId: 'user-id',
      displayName: 'test-user',
      canDelete: true,
      blockers: [],
      dependencies: [
        { type: 'sessions', count: 2, action: 'DELETE' },
        { type: 'accessScopes', count: 1, action: 'DELETE' },
        { type: 'createdStockDocuments', count: 0, action: 'DETACH' },
        { type: 'uploadedStockDocumentAttachments', count: 0, action: 'DETACH' },
        { type: 'createdIssueRealizations', count: 0, action: 'DETACH' },
        { type: 'uploadedIssueRealizationAttachments', count: 0, action: 'DETACH' },
        { type: 'accountingTransferExportBatches', count: 0, action: 'DETACH' },
      ],
    });
  });

  it('reports historical User actor relations as detach dependencies', async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-id', username: 'historical-user', role: UserRole.MVO,
      isActive: true,
      _count: {
        sessions: 0, accessScopes: 0, createdStockDocuments: 2,
        uploadedStockDocumentAttachments: 3, createdIssueRealizations: 4,
        uploadedIssueRealizationAttachments: 5,
        accountingTransferExportBatches: 6,
      },
    });
    prisma.user.count.mockResolvedValue(1);

    const preview = await service.deletionPreview(owner, 'users', 'user-id');

    expect(preview.canDelete).toBe(true);
    expect(preview.blockers).toEqual([]);
    expect(preview.dependencies).toEqual(expect.arrayContaining([
      { type: 'createdStockDocuments', count: 2, action: 'DETACH' },
      { type: 'uploadedStockDocumentAttachments', count: 3, action: 'DETACH' },
      { type: 'createdIssueRealizations', count: 4, action: 'DETACH' },
      { type: 'uploadedIssueRealizationAttachments', count: 5, action: 'DETACH' },
      { type: 'accountingTransferExportBatches', count: 6, action: 'DETACH' },
    ]));
  });

  it('rejects deletion of the current OWNER account', async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValue({
      ...owner,
      _count: {
        sessions: 1, accessScopes: 0, createdStockDocuments: 0,
        uploadedStockDocumentAttachments: 0, createdIssueRealizations: 0,
        uploadedIssueRealizationAttachments: 0,
        accountingTransferExportBatches: 0,
      },
    });
    prisma.user.count.mockResolvedValue(1);

    await expect(service.delete(
      owner,
      'users',
      owner.id,
      { confirmation: `DELETE users:${owner.id}` },
      {},
    )).rejects.toBeInstanceOf(ConflictException);
  });

  it('reports the unsupported entityType in a clear 400 error', async () => {
    const { service } = createService();

    await expect(
      service.deletionPreview(owner, 'responsible-person', 'person-id'),
    ).rejects.toThrow(
      new BadRequestException(
        'Безпечний сценарій видалення для entityType "responsible-person" не визначений.',
      ),
    );
  });

  it('returns shared custody to a surviving accounting owner before deleting MVO', async () => {
    const { service, prisma, tx, stockService } = createService();
    prisma.responsiblePerson.findUnique.mockResolvedValue({
      id: 'person-a', lastName: 'A', firstName: 'MVO', middleName: null,
      stockBalances: [], user: null,
      _count: { stockTransactions: 0, importRows: 0 },
    });
    prisma.custodyBalance.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    prisma.stockDocument.count.mockResolvedValue(0);
    prisma.stockDocumentLine.count.mockResolvedValue(0);
    prisma.stockDocumentAttachment.count.mockResolvedValue(0);
    prisma.issueRealization.count.mockResolvedValue(0);
    prisma.accountingTransferExportBatch.count.mockResolvedValue(0);
    prisma.stockDocumentAttachment.findMany.mockResolvedValue([]);
    prisma.issueRealizationAttachment.findMany.mockResolvedValue([]);
    tx.responsiblePerson.findUniqueOrThrow.mockResolvedValue({
      id: 'person-a', lastName: 'A', firstName: 'MVO', middleName: null,
    });
    tx.user.findUnique.mockResolvedValue(null);
    tx.custodyBalance.findMany.mockResolvedValue([{
      id: 'custody-id', inventoryItemId: 'item-id',
      accountingOwnerResponsiblePersonId: 'person-b',
      custodianResponsiblePersonId: 'person-a',
      quantity: new Prisma.Decimal(5),
    }]);
    tx.stockDocument.findMany.mockResolvedValue([]);
    tx.accountingTransferExportBatchDocument.findMany.mockResolvedValue([]);
    tx.issueRealization.findMany.mockResolvedValue([]);

    await service.delete(owner, 'responsible-persons', 'person-a', {
      confirmation: 'DELETE responsible-persons:person-a',
    }, {});

    expect(stockService.createIncreasingTransactionInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        type: 'ASSIGNMENT_REVERSAL',
        responsiblePersonId: 'person-b',
        inventoryItemId: 'item-id',
        quantity: expect.anything(),
        documentId: null,
      }),
    );
    expect(tx.custodyBalance.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['custody-id'] } },
    });
  });

  it.each([
    ['owner with surviving custodian', 'person-a', 'person-b'],
    ['owner and custodian', 'person-a', 'person-a'],
  ])('deletes custody without crediting another balance when A is %s', async (
    _caseName, accountingOwnerResponsiblePersonId, custodianResponsiblePersonId,
  ) => {
    const { service, prisma, tx, stockService } = createService();
    prisma.responsiblePerson.findUnique.mockResolvedValue({
      id: 'person-a', lastName: 'A', firstName: 'MVO', middleName: null,
      stockBalances: [], user: null,
      _count: { stockTransactions: 0, importRows: 0 },
    });
    prisma.custodyBalance.count.mockResolvedValue(1);
    prisma.stockDocument.count.mockResolvedValue(0);
    prisma.stockDocumentLine.count.mockResolvedValue(0);
    prisma.stockDocumentAttachment.count.mockResolvedValue(0);
    prisma.issueRealization.count.mockResolvedValue(0);
    prisma.accountingTransferExportBatch.count.mockResolvedValue(0);
    prisma.stockDocumentAttachment.findMany.mockResolvedValue([]);
    prisma.issueRealizationAttachment.findMany.mockResolvedValue([]);
    tx.responsiblePerson.findUniqueOrThrow.mockResolvedValue({
      id: 'person-a', lastName: 'A', firstName: 'MVO', middleName: null,
    });
    tx.user.findUnique.mockResolvedValue(null);
    tx.custodyBalance.findMany.mockResolvedValue([{
      id: 'custody-id', inventoryItemId: 'item-id',
      accountingOwnerResponsiblePersonId, custodianResponsiblePersonId,
      quantity: new Prisma.Decimal(5),
    }]);
    tx.stockDocument.findMany.mockResolvedValue([]);
    tx.accountingTransferExportBatchDocument.findMany.mockResolvedValue([]);
    tx.issueRealization.findMany.mockResolvedValue([]);

    await service.delete(owner, 'responsible-persons', 'person-a', {
      confirmation: 'DELETE responsible-persons:person-a',
    }, {});

    expect(stockService.createIncreasingTransactionInTx).not.toHaveBeenCalled();
    expect(tx.custodyBalance.deleteMany).toHaveBeenCalled();
  });

  it('cancels affected posted documents, removes whole export batch, detaches imports and deletes linked MVO user', async () => {
    const { service, prisma, tx, stockDocuments } = createService();
    prisma.responsiblePerson.findUnique.mockResolvedValue({
      id: 'person-a', lastName: 'A', firstName: 'MVO', middleName: null,
      stockBalances: [], user: { id: 'mvo-user', role: UserRole.MVO },
      _count: { stockTransactions: 2, importRows: 1 },
    });
    prisma.custodyBalance.count.mockResolvedValue(0);
    prisma.stockDocument.count.mockResolvedValue(2);
    prisma.stockDocumentLine.count.mockResolvedValue(2);
    prisma.stockDocumentAttachment.count.mockResolvedValue(0);
    prisma.issueRealization.count.mockResolvedValue(0);
    prisma.accountingTransferExportBatch.count.mockResolvedValue(1);
    prisma.stockDocumentAttachment.findMany.mockResolvedValue([]);
    prisma.issueRealizationAttachment.findMany.mockResolvedValue([]);
    tx.responsiblePerson.findUniqueOrThrow.mockResolvedValue({
      id: 'person-a', lastName: 'A', firstName: 'MVO', middleName: null,
    });
    tx.user.findUnique.mockResolvedValue({ id: 'mvo-user', role: UserRole.MVO });
    tx.custodyBalance.findMany.mockResolvedValue([]);
    tx.stockDocument.findMany.mockResolvedValue([
      {
        id: 'transfer-b-a', type: 'MVO_TRANSFER', status: 'POSTED',
        accountingModel: 'DIRECT_BALANCE',
      },
      {
        id: 'transfer-a-b', type: 'MVO_TRANSFER', status: 'POSTED',
        accountingModel: 'DIRECT_BALANCE',
      },
    ]);
    tx.accountingTransferExportBatchDocument.findMany
      .mockResolvedValueOnce([{ batchId: 'batch-id' }])
      .mockResolvedValueOnce([
        { documentId: 'transfer-b-a' },
        { documentId: 'unaffected-document' },
      ]);
    tx.issueRealization.findMany.mockResolvedValue([]);

    await service.delete(owner, 'responsible-persons', 'person-a', {
      confirmation: 'DELETE responsible-persons:person-a',
    }, {});

    expect(stockDocuments.cancelForOwnerDeletionInTx).toHaveBeenCalledTimes(2);
    expect(tx.accountingTransferExportBatch.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['batch-id'] } },
    });
    expect(tx.stockDocument.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['transfer-b-a', 'unaffected-document'] } },
      data: expect.objectContaining({ accountingExportState: 'NOT_EXPORTED' }),
    });
    expect(tx.importRow.updateMany).toHaveBeenCalledWith({
      where: { responsiblePersonId: 'person-a' },
      data: { responsiblePersonId: null },
    });
    expect(tx.stockDocument.updateMany).toHaveBeenCalledWith({
      where: { postedByUserId: 'mvo-user' },
      data: { postedByUserId: null },
    });
    expect(tx.issueRealization.updateMany).toHaveBeenCalledWith({
      where: { cancelledByUserId: 'mvo-user' },
      data: { cancelledByUserId: null },
    });
    expect(tx.user.update).not.toHaveBeenCalledWith({
      where: { id: 'mvo-user' },
      data: { responsiblePersonId: null },
    });
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: 'mvo-user' } });
    expect(tx.user.delete.mock.invocationCallOrder[0]).toBeLessThan(
      tx.responsiblePerson.delete.mock.invocationCallOrder[0],
    );
  });

  it('detaches a linked non-MVO user and keeps the account', async () => {
    const { service, prisma, tx } = createService();
    prisma.responsiblePerson.findUnique.mockResolvedValue({
      id: 'person-a', lastName: 'A', firstName: 'Person', middleName: null,
      stockBalances: [], user: { id: 'linked-user', role: UserRole.DPP_ADMIN },
      _count: { stockTransactions: 0, importRows: 0 },
    });
    prisma.custodyBalance.count.mockResolvedValue(0);
    prisma.stockDocument.count.mockResolvedValue(0);
    prisma.stockDocumentLine.count.mockResolvedValue(0);
    prisma.stockDocumentAttachment.count.mockResolvedValue(0);
    prisma.issueRealization.count.mockResolvedValue(0);
    prisma.accountingTransferExportBatch.count.mockResolvedValue(0);
    prisma.stockDocumentAttachment.findMany.mockResolvedValue([]);
    prisma.issueRealizationAttachment.findMany.mockResolvedValue([]);
    tx.responsiblePerson.findUniqueOrThrow.mockResolvedValue({
      id: 'person-a', lastName: 'A', firstName: 'Person', middleName: null,
    });
    tx.user.findUnique.mockResolvedValue({
      id: 'linked-user', role: UserRole.DPP_ADMIN,
    });
    tx.custodyBalance.findMany.mockResolvedValue([]);
    tx.stockDocument.findMany.mockResolvedValue([]);
    tx.accountingTransferExportBatchDocument.findMany.mockResolvedValue([]);
    tx.issueRealization.findMany.mockResolvedValue([]);

    await service.delete(owner, 'responsible-persons', 'person-a', {
      confirmation: 'DELETE responsible-persons:person-a',
    }, {});

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'linked-user' },
      data: { responsiblePersonId: null },
    });
    expect(tx.user.delete).not.toHaveBeenCalled();
    expect(tx.responsiblePerson.delete).toHaveBeenCalledWith({
      where: { id: 'person-a' },
    });
  });

  it('rolls the whole transaction back when rollback fails', async () => {
    const { service, prisma, tx } = createService();
    prisma.importBatch.findUnique.mockResolvedValue({
      id: 'batch-id',
      originalFilename: 'test.csv',
      status: ImportStatus.COMPLETED,
    });
    tx.stockTransaction.findMany.mockResolvedValue([
      {
        responsiblePersonId: 'person-id',
        inventoryItemId: 'item-id',
        quantity: { toString: () => '5' },
      },
    ]);
    tx.stockBalance.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockRejectedValueOnce(new Error('transaction failed'));

    await expect(
      service.rollbackImport(owner, 'batch-id', { requestId: 'request-1' }),
    ).rejects.toThrow('transaction failed');
    expect(tx.importBatch.update).not.toHaveBeenCalled();
    expect(prisma.securityEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: SecurityEventType.OWNER_DESTRUCTIVE_ACTION,
          success: false,
        }),
      }),
    );
  });

  it('creates an audit event in a successful delete transaction', async () => {
    const { service, prisma, tx } = createService();
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      username: 'test-user',
      role: UserRole.MVO,
      isActive: true,
      _count: {
        sessions: 1, accessScopes: 2, createdStockDocuments: 1,
        uploadedStockDocumentAttachments: 1, createdIssueRealizations: 1,
        uploadedIssueRealizationAttachments: 1,
        accountingTransferExportBatches: 1,
      },
    });
    prisma.user.count.mockResolvedValue(1);
    tx.user.update.mockResolvedValue({});
    tx.user.delete.mockResolvedValue({});

    await service.delete(
      owner,
      'users',
      'user-id',
      { confirmation: 'DELETE users:user-id' },
      { requestId: 'request-2' },
    );

    expect(tx.securityEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: SecurityEventType.OWNER_DESTRUCTIVE_ACTION,
          actorUserId: owner.id,
          success: true,
          requestId: 'request-2',
        }),
      }),
    );
    expect(tx.stockDocument.updateMany).toHaveBeenCalledTimes(3);
    expect(tx.issueRealization.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-id' },
      data: { responsiblePersonId: null },
    });
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: 'user-id' } });
  });

  it('refuses the API reset without the separate business reset flag', async () => {
    const { service, businessDataReset } = createService();

    await expect(service.resetTestData(owner, {})).rejects.toThrow(
      'REFUSED: set ALLOW_BUSINESS_DATA_RESET=YES',
    );
    expect(businessDataReset.run).not.toHaveBeenCalled();
  });

  it('deletes an empty document and its attachments after removing its only item line', async () => {
    const h = createService();
    prepareInventoryDelete(h);
    h.prisma.stockDocumentAttachment.findMany.mockResolvedValue([
      { storagePath: 'document.pdf' },
    ]);
    h.attachmentStorage.stageForDeletion.mockResolvedValue({
      storagePath: 'document.pdf', stagedStoragePath: 'document.pdf.deleted',
    });

    await h.service.delete(owner, 'inventory-items', 'item-x', {
      confirmation: 'DELETE inventory-items:item-x',
    }, {});

    expect(h.tx.stockDocumentLine.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['line-x'] } },
    });
    expect(h.tx.stockDocumentAttachment.deleteMany).toHaveBeenCalledWith({
      where: { documentId: { in: ['document-id'] } },
    });
    expect(h.tx.stockDocument.deleteMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: { in: ['document-id'] } }),
    });
    expect(h.attachmentStorage.finalizeDeletion).toHaveBeenCalled();
  });

  it('keeps a multi-item document and its attachments', async () => {
    const h = createService();
    prepareInventoryDelete(h);
    h.tx.stockDocument.findMany.mockResolvedValue([
      { id: 'document-id', _count: { lines: 1 } },
    ]);

    await h.service.delete(owner, 'inventory-items', 'item-x', {
      confirmation: 'DELETE inventory-items:item-x',
    }, {});

    expect(h.tx.stockDocumentAttachment.deleteMany).toHaveBeenCalledWith({
      where: { documentId: { in: [] } },
    });
    expect(h.tx.stockDocument.deleteMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: { in: [] } }),
    });
  });

  it.each([
    ['keeps a realization containing another item', 1, []],
    ['deletes a realization containing only X', 0, ['realization-id']],
  ])('%s', async (_name, remainingLines, deletedIds) => {
    const h = createService();
    prepareInventoryDelete(h);
    h.tx.issueRealizationLine.findMany.mockResolvedValue([
      { id: 'realization-line-x', realizationId: 'realization-id' },
    ]);
    h.tx.issueRealization.findMany.mockResolvedValue([
      { id: 'realization-id', _count: { lines: remainingLines } },
    ]);

    await h.service.delete(owner, 'inventory-items', 'item-x', {
      confirmation: 'DELETE inventory-items:item-x',
    }, {});

    expect(h.tx.issueRealizationLine.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['realization-line-x'] } },
    });
    expect(h.tx.issueRealization.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: deletedIds } },
    });
  });

  it('deletes only X accounting records, detaches import history, and removes the affected export batch', async () => {
    const h = createService();
    prepareInventoryDelete(h);
    h.tx.accountingTransferExportBatchDocument.findMany
      .mockResolvedValueOnce([{ batchId: 'batch-id' }])
      .mockResolvedValueOnce([{ documentId: 'other-document' }]);

    await h.service.delete(owner, 'inventory-items', 'item-x', {
      confirmation: 'DELETE inventory-items:item-x',
    }, {});

    expect(h.tx.stockTransaction.deleteMany).toHaveBeenCalledWith({
      where: { inventoryItemId: 'item-x' },
    });
    expect(h.tx.stockBalance.deleteMany).toHaveBeenCalledWith({
      where: { inventoryItemId: 'item-x' },
    });
    expect(h.tx.custodyBalance.deleteMany).toHaveBeenCalledWith({
      where: { inventoryItemId: 'item-x' },
    });
    expect(h.tx.importRow.updateMany).toHaveBeenCalledWith({
      where: { inventoryItemId: 'item-x' },
      data: { inventoryItemId: null },
    });
    expect(h.tx.accountingTransferExportBatch.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['batch-id'] } },
    });
  });

  it('returns an unblocked InventoryItem dependency preview', async () => {
    const h = createService();
    prepareInventoryDelete(h);

    const preview = await h.service.deletionPreview(
      owner, 'inventory-items', 'item-x',
    );

    expect(preview.canDelete).toBe(true);
    expect(preview.dependencies).toEqual(expect.arrayContaining([
      { type: 'stockBalances', count: 1, action: 'DELETE' },
      { type: 'custodyBalances', count: 1, action: 'DELETE' },
      { type: 'documentsToDelete', count: 1, action: 'DELETE' },
      { type: 'documentsToKeep', count: 0, action: 'RETAIN' },
      { type: 'importRows', count: 1, action: 'DETACH' },
    ]));
  });

  it('rejects InventoryItem deletion preview for non-OWNER', async () => {
    const { service } = createService();
    await expect(service.deletionPreview(
      { ...owner, role: UserRole.MVO }, 'inventory-items', 'item-x',
    )).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a non-OWNER reset request', async () => {
    process.env.ALLOW_BUSINESS_DATA_RESET = 'YES';
    const { service, businessDataReset } = createService();

    await expect(
      service.resetTestData({ ...owner, role: UserRole.ACCOUNTANT }, {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(businessDataReset.run).not.toHaveBeenCalled();
  });

  it('delegates the API reset and returns deletion summary counts', async () => {
    process.env.ALLOW_BUSINESS_DATA_RESET = 'YES';
    const { service, businessDataReset } = createService();

    await expect(service.resetTestData(owner, {})).resolves.toMatchObject({
      reset: true,
      preservedOwners: 1,
      preservedOwnerSessions: 1,
      deletedUsers: 2,
      deletedUserAccessScopes: 3,
      deletedManagements: 1,
      deletedServices: 3,
      deletedResponsiblePersons: 4,
      deletedInventoryItems: 5,
      deletedBalances: 7,
      deletedTransactions: 8,
      deletedDocuments: 7,
      deletedTransfers: 3,
      deletedIssues: 4,
      deletedDocumentLines: 11,
      deletedRealizations: 2,
      deletedRealizationLines: 5,
      deletedAttachments: 3,
      deletedImports: 1,
      attachmentFilesDeleted: 3,
      orphanAttachmentFiles: 1,
    });
    expect(businessDataReset.run).toHaveBeenCalledWith(
      expect.objectContaining({
        allowedFlag: 'YES',
        onBeforeCommit: expect.any(Function),
      }),
    );
  });
});
