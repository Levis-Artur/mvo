import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
  return {
    user: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    responsiblePerson: {
      findUnique: jest.fn(),
    },
    userSession: {
      updateMany: jest.fn(),
    },
    securityEvent: {
      create: jest.fn(),
    },
  };
}

function createService(prisma = createPrismaMock()) {
  const auth = {
    normalizeUsername: jest.fn((username: string) =>
      username.trim().toLowerCase(),
    ),
    hashPassword: jest.fn(async () => 'hashed-password'),
  };

  return {
    service: new UsersService(prisma as never, auth as never),
    prisma,
    auth,
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

