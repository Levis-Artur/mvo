import { ForbiddenException } from '@nestjs/common';
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
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
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

  return {
    service: new OwnerDestructiveActionsService(prisma as never),
    prisma,
    tx,
  };
}

describe('OwnerDestructiveActionsService', () => {
  beforeEach(() => {
    process.env.OWNER_DESTRUCTIVE_ACTIONS_ENABLED = 'true';
  });

  afterEach(() => {
    delete process.env.OWNER_DESTRUCTIVE_ACTIONS_ENABLED;
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

  it('rejects OWNER when the feature flag is false', async () => {
    process.env.OWNER_DESTRUCTIVE_ACTIONS_ENABLED = 'false';
    const { service } = createService();

    await expect(
      service.deletionPreview(owner, 'users', 'user-id'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns a deletion preview for OWNER', async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      username: 'test-user',
      role: UserRole.MVO,
      isActive: true,
      _count: { sessions: 2 },
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
      ],
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
      _count: { sessions: 0 },
    });
    prisma.user.count.mockResolvedValue(1);
    tx.userSession.deleteMany.mockResolvedValue({ count: 0 });

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
  });
});
