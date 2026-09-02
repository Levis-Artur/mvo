import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ImportStatus, SecurityEventType, UserRole } from '@prisma/client';
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
      deleteMany: jest.fn(),
    },
    stockBalance: {
      findUnique: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
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
    stockDocument: { updateMany: jest.fn() },
    issueRealization: { updateMany: jest.fn() },
    responsiblePerson: { delete: jest.fn(), deleteMany: jest.fn() },
    inventoryItem: { delete: jest.fn(), deleteMany: jest.fn() },
    unit: { delete: jest.fn(), deleteMany: jest.fn() },
    service: { delete: jest.fn(), deleteMany: jest.fn() },
    management: { delete: jest.fn(), deleteMany: jest.fn() },
    securityEvent: { create: jest.fn() },
  };
  const prisma = {
    user: { findUnique: jest.fn(), count: jest.fn() },
    importBatch: { findUnique: jest.fn() },
    responsiblePerson: { findUnique: jest.fn() },
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

  return {
    service: new OwnerDestructiveActionsService(
      prisma as never,
      businessDataReset as never,
    ),
    prisma,
    tx,
    businessDataReset,
  };
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
