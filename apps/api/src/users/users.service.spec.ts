import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SecurityEventType, UserRole } from '@prisma/client';
import { UsersService } from './users.service';

const owner = {
  id: 'owner-id',
  username: 'owner',
  role: UserRole.OWNER,
  isActive: true,
  mustChangePassword: false,
  responsiblePersonId: null,
};
const dppAdmin = {
  id: 'dpp-id',
  username: 'dpp',
  role: UserRole.DPP_ADMIN,
  isActive: true,
  mustChangePassword: false,
  responsiblePersonId: null,
};
const context = {
  ipAddress: '127.0.0.1',
  userAgent: 'jest',
  requestId: 'request-id',
};

function createPrismaMock() {
  const prisma = {
    user: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    responsiblePerson: {
      findUnique: jest.fn(),
    },
    userSession: {
      updateMany: jest.fn(),
    },
    preAuthChallenge: {
      deleteMany: jest.fn(),
    },
    twoFactorRecoveryCode: {
      deleteMany: jest.fn(),
    },
    securityEvent: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  prisma.$transaction.mockImplementation(
    async (callback: (client: typeof prisma) => Promise<unknown>) =>
      callback(prisma),
  );

  return prisma;
}

function createService(prisma = createPrismaMock()) {
  const auth = {
    normalizeUsername: jest.fn((username: string) =>
      username.trim().toLowerCase(),
    ),
    hashPassword: jest.fn(async () => 'hashed-password'),
  };
  const accessScopes = {
    listForUser: jest.fn().mockResolvedValue([]),
    replaceForUser: jest.fn().mockResolvedValue([]),
  };

  return {
    service: new UsersService(
      prisma as never,
      auth as never,
      accessScopes as never,
    ),
    prisma,
    auth,
    accessScopes,
  };
}

function user(role: UserRole, overrides: Record<string, unknown> = {}) {
  return {
    id: `${role.toLowerCase()}-id`,
    username: role.toLowerCase(),
    role,
    isActive: true,
    mustChangePassword: true,
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    passwordChangedAt: null,
    responsiblePersonId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    createdById: owner.id,
    responsiblePerson: null,
    ...overrides,
  };
}

describe('UsersService', () => {
  it('allows OWNER to create AUDITOR', async () => {
    const { service, prisma } = createService();
    prisma.user.create.mockResolvedValue(user(UserRole.AUDITOR));

    const result = await service.create(
      owner,
      { username: ' Auditor ', role: UserRole.AUDITOR },
      context,
    );

    expect(result.temporaryPassword).toBeDefined();
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          username: 'auditor',
          role: UserRole.AUDITOR,
          passwordHash: 'hashed-password',
          createdById: owner.id,
        }),
      }),
    );
  });

  it('allows OWNER to create DPP_ADMIN', async () => {
    const { service, prisma } = createService();
    prisma.user.create.mockResolvedValue(user(UserRole.DPP_ADMIN));

    await service.create(
      owner,
      { username: 'dpp', role: UserRole.DPP_ADMIN },
      context,
    );

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: UserRole.DPP_ADMIN }),
      }),
    );
  });

  it('creates ACCOUNTANT without a ResponsiblePerson link', async () => {
    const { service, prisma } = createService();
    prisma.user.create.mockResolvedValue(user(UserRole.ACCOUNTANT));

    await service.create(
      owner,
      {
        username: 'accountant',
        role: UserRole.ACCOUNTANT,
        responsiblePersonId: 'person-id',
      },
      context,
    );

    expect(prisma.responsiblePerson.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: UserRole.ACCOUNTANT,
          responsiblePersonId: null,
        }),
      }),
    );
  });

  it('creates ORG_MANAGER without a ResponsiblePerson link', async () => {
    const { service, prisma } = createService();
    prisma.user.create.mockResolvedValue(user(UserRole.ORG_MANAGER));

    await service.create(
      owner,
      {
        username: 'org-manager',
        role: UserRole.ORG_MANAGER,
      },
      context,
    );

    expect(prisma.responsiblePerson.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: UserRole.ORG_MANAGER,
          responsiblePersonId: null,
        }),
      }),
    );
  });

  it('allows only OWNER to read and replace manager scopes', async () => {
    const { service, accessScopes } = createService();
    accessScopes.listForUser.mockResolvedValue([{ id: 'scope-1' }]);

    await expect(service.findAccessScopes(owner, 'manager-id')).resolves.toEqual([
      { id: 'scope-1' },
    ]);
    await service.replaceAccessScopes(
      owner,
      'manager-id',
      [{ managementId: 'management-1' }],
      context,
    );

    expect(accessScopes.listForUser).toHaveBeenCalledWith('manager-id');
    expect(accessScopes.replaceForUser).toHaveBeenCalledWith('manager-id', [
      { managementId: 'management-1' },
    ]);
    await expect(
      service.findAccessScopes(dppAdmin, 'manager-id'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.replaceAccessScopes(dppAdmin, 'manager-id', [], context),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('atomically clears scopes when ORG_MANAGER changes to another role', async () => {
    const { service, prisma } = createService();
    prisma.user.findFirst.mockResolvedValue(user(UserRole.ORG_MANAGER));
    prisma.user.update.mockResolvedValue(user(UserRole.AUDITOR));

    await service.update(
      owner,
      'manager-id',
      { role: UserRole.AUDITOR },
      context,
    );

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: UserRole.AUDITOR,
          accessScopes: { deleteMany: {} },
        }),
      }),
    );
  });

  it('clears a ResponsiblePerson link when changing a user to ACCOUNTANT', async () => {
    const { service, prisma } = createService();
    prisma.user.findFirst.mockResolvedValue(
      user(UserRole.MVO, { responsiblePersonId: 'person-id' }),
    );
    prisma.user.update.mockResolvedValue(user(UserRole.ACCOUNTANT));

    await service.update(
      owner,
      'mvo-id',
      { role: UserRole.ACCOUNTANT },
      context,
    );

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: UserRole.ACCOUNTANT,
          responsiblePersonId: null,
        }),
      }),
    );
  });

  it('allows OWNER to create MVO', async () => {
    const { service, prisma } = createService();
    prisma.responsiblePerson.findUnique.mockResolvedValue({
      id: 'person-id',
      isActive: true,
      user: null,
    });
    prisma.user.create.mockResolvedValue(
      user(UserRole.MVO, { responsiblePersonId: 'person-id' }),
    );

    await service.create(
      owner,
      {
        username: 'mvo',
        role: UserRole.MVO,
        responsiblePersonId: 'person-id',
      },
      context,
    );

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: UserRole.MVO,
          responsiblePersonId: 'person-id',
        }),
      }),
    );
  });

  it('does not create a second OWNER', async () => {
    const { service } = createService();

    await expect(
      service.create(owner, { username: 'owner2', role: UserRole.OWNER }, context),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows DPP_ADMIN to create MVO', async () => {
    const { service, prisma } = createService();
    prisma.responsiblePerson.findUnique.mockResolvedValue({
      id: 'person-id',
      isActive: true,
      user: null,
    });
    prisma.user.create.mockResolvedValue(
      user(UserRole.MVO, { responsiblePersonId: 'person-id' }),
    );

    await service.create(
      dppAdmin,
      { username: 'mvo', responsiblePersonId: 'person-id' },
      context,
    );

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: UserRole.MVO }),
      }),
    );
  });

  it('does not allow DPP_ADMIN to create AUDITOR', async () => {
    const { service } = createService();

    await expect(
      service.create(
        dppAdmin,
        { username: 'auditor', role: UserRole.AUDITOR },
        context,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not create MVO without responsiblePersonId', async () => {
    const { service } = createService();

    await expect(
      service.create(owner, { username: 'mvo', role: UserRole.MVO }, context),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not link one ResponsiblePerson twice', async () => {
    const { service, prisma } = createService();
    prisma.responsiblePerson.findUnique.mockResolvedValue({
      id: 'person-id',
      isActive: true,
      user: { id: 'existing-user-id' },
    });

    await expect(
      service.create(
        owner,
        {
          username: 'mvo',
          role: UserRole.MVO,
          responsiblePersonId: 'person-id',
        },
        context,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('reset-password revokes sessions', async () => {
    const { service, prisma } = createService();
    prisma.user.findFirst.mockResolvedValue(user(UserRole.MVO));
    prisma.user.update.mockResolvedValue(user(UserRole.MVO));
    prisma.userSession.updateMany.mockResolvedValue({ count: 2 });

    const result = await service.resetPassword(owner, 'mvo-id', context);

    expect(result.temporaryPassword).toBeDefined();
    expect(prisma.userSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'mvo-id', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.securityEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: SecurityEventType.PASSWORD_RESET,
        }),
      }),
    );
  });

  it('allows OWNER to atomically reset 2FA for a non-OWNER user', async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValue({
      id: 'mvo-id',
      role: UserRole.MVO,
    });
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    prisma.twoFactorRecoveryCode.deleteMany.mockResolvedValue({ count: 10 });
    prisma.preAuthChallenge.deleteMany.mockResolvedValue({ count: 1 });
    prisma.userSession.updateMany.mockResolvedValue({ count: 2 });

    await expect(service.resetTwoFactor(owner, 'mvo-id')).resolves.toEqual({
      success: true,
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'mvo-id', role: { not: UserRole.OWNER } },
      data: {
        twoFactorEnabled: false,
        twoFactorSecretEncrypted: null,
        twoFactorConfirmedAt: null,
      },
    });
    expect(prisma.twoFactorRecoveryCode.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'mvo-id' },
    });
    expect(prisma.preAuthChallenge.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'mvo-id' },
    });
    expect(prisma.userSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'mvo-id', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });

    const updateData = prisma.user.updateMany.mock.calls[0][0].data;
    expect(updateData).not.toHaveProperty('passwordHash');
    expect(updateData).not.toHaveProperty('mustChangePassword');
    expect(updateData).not.toHaveProperty('role');
    expect(updateData).not.toHaveProperty('responsiblePersonId');
    expect(updateData).not.toHaveProperty('isActive');
  });

  it.each([
    UserRole.DPP_ADMIN,
    UserRole.ORG_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.AUDITOR,
    UserRole.MVO,
  ])('rejects 2FA reset by %s', async (role) => {
    const { service, prisma } = createService();

    await expect(
      service.resetTwoFactor({ ...owner, role }, 'mvo-id'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects resetting 2FA for an OWNER target', async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValue({
      id: 'another-owner-id',
      role: UserRole.OWNER,
    });

    await expect(
      service.resetTwoFactor(owner, 'another-owner-id'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('returns not found for an unknown 2FA reset target', async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.resetTwoFactor(owner, 'unknown-id'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('keeps the reset inside one transaction when a mutation fails', async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValue({
      id: 'mvo-id',
      role: UserRole.MVO,
    });
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    prisma.twoFactorRecoveryCode.deleteMany.mockResolvedValue({ count: 10 });
    prisma.preAuthChallenge.deleteMany.mockRejectedValue(
      new Error('transaction failed'),
    );

    await expect(service.resetTwoFactor(owner, 'mvo-id')).rejects.toThrow(
      'transaction failed',
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.userSession.updateMany).not.toHaveBeenCalled();
  });

  it('deactivate revokes sessions', async () => {
    const { service, prisma } = createService();
    prisma.user.findFirst.mockResolvedValue(user(UserRole.MVO));
    prisma.user.update.mockResolvedValue(user(UserRole.MVO, { isActive: false }));
    prisma.userSession.updateMany.mockResolvedValue({ count: 2 });

    await service.deactivate(owner, 'mvo-id', context);

    expect(prisma.userSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'mvo-id', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.securityEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: SecurityEventType.USER_DEACTIVATED,
        }),
      }),
    );
  });
});
