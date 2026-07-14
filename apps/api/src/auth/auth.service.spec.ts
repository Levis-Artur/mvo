import { UnauthorizedException } from '@nestjs/common';
import { SecurityEventType, UserRole } from '@prisma/client';
import { AuthService, INVALID_CREDENTIALS_MESSAGE } from './auth.service';

type MockPrisma = ReturnType<typeof createPrismaMock>;

const userId = '11111111-1111-4111-8111-111111111111';
const sessionId = '22222222-2222-4222-8222-222222222222';
const password = 'correct-password-123';
const wrongPassword = 'wrong-password-1234';
const context = {
  ipAddress: '127.0.0.1',
  userAgent: 'jest',
  requestId: 'request-1',
};

function createPrismaMock() {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    userSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    securityEvent: {
      create: jest.fn(),
    },
    $transaction: jest.fn(async (operations: Promise<unknown>[]) =>
      Promise.all(operations),
    ),
  };

  prisma.user.update.mockImplementation(async ({ data }) => ({
    id: userId,
    username: 'owner',
    passwordHash: 'hash',
    role: UserRole.OWNER,
    isActive: true,
    mustChangePassword: false,
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    passwordChangedAt: null,
    responsiblePersonId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    createdById: null,
    ...data,
  }));
  prisma.userSession.create.mockResolvedValue({ id: sessionId });
  prisma.userSession.update.mockResolvedValue({ id: sessionId });
  prisma.userSession.updateMany.mockResolvedValue({ count: 1 });
  prisma.securityEvent.create.mockResolvedValue({ id: 'event' });

  return prisma;
}

function createService(prisma: MockPrisma) {
  return new AuthService(prisma as never);
}

async function activeUser(overrides: Record<string, unknown> = {}) {
  const service = createService(createPrismaMock());

  return {
    id: userId,
    username: 'owner',
    passwordHash: await service.hashPassword(password),
    role: UserRole.OWNER,
    isActive: true,
    mustChangePassword: false,
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    passwordChangedAt: null,
    responsiblePersonId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    createdById: null,
    ...overrides,
  };
}

describe('AuthService', () => {
  it('logs in with a valid username and password', async () => {
    const prisma = createPrismaMock();
    const service = createService(prisma);
    prisma.user.findUnique.mockResolvedValue(await activeUser());

    const result = await service.login(' Owner ', password, context);

    expect(result.token).toHaveLength(43);
    expect(result.user).toEqual(
      expect.objectContaining({
        id: userId,
        username: 'owner',
        role: UserRole.OWNER,
      }),
    );
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { username: 'owner' },
    });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: expect.any(Date),
        }),
      }),
    );
    expect(prisma.userSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId,
          tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
          expiresAt: expect.any(Date),
        }),
      }),
    );
    expect(prisma.securityEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: SecurityEventType.LOGIN_SUCCESS,
          success: true,
        }),
      }),
    );
  });

  it('rejects an invalid password with a generic message', async () => {
    const prisma = createPrismaMock();
    const service = createService(prisma);
    prisma.user.findUnique.mockResolvedValue(await activeUser());

    await expect(service.login('owner', wrongPassword, context)).rejects.toThrow(
      INVALID_CREDENTIALS_MESSAGE,
    );
    expect(prisma.securityEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: SecurityEventType.LOGIN_FAILURE,
          success: false,
          metadata: { reason: 'INVALID_CREDENTIALS' },
        }),
      }),
    );
  });

  it('rejects an invalid username with the same generic message', async () => {
    const prisma = createPrismaMock();
    const service = createService(prisma);
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.login('missing', password, context)).rejects.toThrow(
      INVALID_CREDENTIALS_MESSAGE,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.securityEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: SecurityEventType.LOGIN_FAILURE,
          success: false,
          metadata: expect.objectContaining({ username: 'missing' }),
        }),
      }),
    );
  });

  it('locks a user after 5 failed attempts', async () => {
    const prisma = createPrismaMock();
    const service = createService(prisma);
    prisma.user.findUnique.mockResolvedValue(
      await activeUser({ failedLoginAttempts: 4 }),
    );

    await expect(service.login('owner', wrongPassword, context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          failedLoginAttempts: 5,
          lockedUntil: expect.any(Date),
        },
      }),
    );
  });

  it('rejects inactive users', async () => {
    const prisma = createPrismaMock();
    const service = createService(prisma);
    prisma.user.findUnique.mockResolvedValue(await activeUser({ isActive: false }));

    await expect(service.login('owner', password, context)).rejects.toThrow(
      INVALID_CREDENTIALS_MESSAGE,
    );
    expect(prisma.userSession.create).not.toHaveBeenCalled();
  });

  it('revokes the current session on logout', async () => {
    const prisma = createPrismaMock();
    const service = createService(prisma);
    const user = service.toCurrentUser(await activeUser());

    await service.logout(sessionId, user, context);

    expect(prisma.userSession.updateMany).toHaveBeenCalledWith({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.securityEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: SecurityEventType.LOGOUT }),
      }),
    );
  });

  it('rejects a revoked session', async () => {
    const prisma = createPrismaMock();
    const service = createService(prisma);
    prisma.userSession.findUnique.mockResolvedValue({
      id: sessionId,
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      user: await activeUser(),
    });

    await expect(service.authenticateSession('token')).resolves.toBeNull();
  });

  it('rejects an expired session', async () => {
    const prisma = createPrismaMock();
    const service = createService(prisma);
    prisma.userSession.findUnique.mockResolvedValue({
      id: sessionId,
      revokedAt: null,
      expiresAt: new Date(Date.now() - 60_000),
      user: await activeUser(),
    });

    await expect(service.authenticateSession('token')).resolves.toBeNull();
  });

  it('changes password and revokes other sessions', async () => {
    const prisma = createPrismaMock();
    const service = createService(prisma);
    const user = await activeUser();
    prisma.user.findUnique.mockResolvedValue(user);

    const result = await service.changePassword(
      service.toCurrentUser(user),
      sessionId,
      password,
      'new-correct-password-123',
      context,
    );

    expect(result).not.toHaveProperty('passwordHash');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          passwordHash: expect.any(String),
          mustChangePassword: false,
          passwordChangedAt: expect.any(Date),
        }),
      }),
    );
    expect(prisma.userSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId,
          revokedAt: null,
          id: { not: sessionId },
        },
      }),
    );
    expect(prisma.securityEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: SecurityEventType.PASSWORD_CHANGED,
          success: true,
        }),
      }),
    );
  });

  it('revokes all sessions on logout-all', async () => {
    const prisma = createPrismaMock();
    const service = createService(prisma);
    const user = service.toCurrentUser(await activeUser());

    await service.logoutAll(user, context);

    expect(prisma.userSession.updateMany).toHaveBeenCalledWith({
      where: { userId, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.securityEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: SecurityEventType.SESSIONS_REVOKED,
          success: true,
        }),
      }),
    );
  });
});
