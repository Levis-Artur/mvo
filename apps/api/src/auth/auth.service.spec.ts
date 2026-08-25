import { UnauthorizedException } from '@nestjs/common';
import {
  PreAuthChallengeStage,
  SecurityEventType,
  UserRole,
} from '@prisma/client';
import * as argon2 from 'argon2';
import { AuthService, INVALID_CREDENTIALS_MESSAGE } from './auth.service';
import {
  InvalidRecoveryCodeException,
  InvalidTwoFactorTokenException,
} from './two-factor/two-factor.service';

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
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
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
    $transaction: jest.fn(),
  };

  prisma.$transaction.mockImplementation(
    async (
      input:
        | Promise<unknown>[]
        | ((client: {
            user: typeof prisma.user;
            userSession: typeof prisma.userSession;
            securityEvent: typeof prisma.securityEvent;
          }) => Promise<unknown>),
    ) =>
      typeof input === 'function'
        ? input({
            user: prisma.user,
            userSession: prisma.userSession,
            securityEvent: prisma.securityEvent,
          })
        : Promise.all(input),
  );

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
    twoFactorEnabled: false,
    twoFactorSecretEncrypted: null,
    twoFactorConfirmedAt: null,
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

function createPreAuthChallengeMock() {
  return {
    create: jest.fn().mockResolvedValue({
      token: 'pre-auth-token',
      expiresAt: new Date('2026-01-01T00:10:00.000Z'),
    }),
    validate: jest.fn().mockResolvedValue({
      id: 'change-password-challenge-id',
      userId,
    }),
    advance: jest.fn().mockResolvedValue({
      token: 'next-pre-auth-token',
      expiresAt: new Date('2026-01-01T00:20:00.000Z'),
    }),
    consume: jest.fn().mockResolvedValue(undefined),
    recordFailure: jest.fn().mockResolvedValue(undefined),
  };
}

function createTwoFactorMock() {
  return {
    beginEnrollment: jest.fn().mockResolvedValue({
      otpauthUrl: 'otpauth://totp/MVO%20Inventory%3Aowner',
      manualKey: 'MANUALKEY',
    }),
    confirmEnrollment: jest.fn().mockResolvedValue({
      recoveryCodes: Array.from(
        { length: 10 },
        (_, index) => `CODE-${index + 1}`,
      ),
    }),
    verifyEnabledToken: jest.fn().mockResolvedValue(undefined),
    consumeRecoveryCode: jest.fn().mockResolvedValue(undefined),
  };
}

function createService(
  prisma: MockPrisma,
  preAuthChallenges = createPreAuthChallengeMock(),
  twoFactor = createTwoFactorMock(),
) {
  return new AuthService(
    prisma as never,
    preAuthChallenges as never,
    twoFactor as never,
  );
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
    twoFactorEnabled: false,
    twoFactorSecretEncrypted: null,
    twoFactorConfirmedAt: null,
    responsiblePersonId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    createdById: null,
    ...overrides,
  };
}

describe('AuthService', () => {
  it('maps lightweight access scopes into the authenticated user context', async () => {
    const service = createService(createPrismaMock());
    const user = await activeUser({ role: UserRole.ORG_MANAGER });

    expect(
      service.toCurrentUser({
        ...user,
        accessScopes: [
          { managementId: 'management-1', serviceCode: 'IT' },
        ],
      }).accessScopes,
    ).toEqual([{ managementId: 'management-1', serviceCode: 'IT' }]);
  });

  it('routes a valid password to CHANGE_PASSWORD when required', async () => {
    const prisma = createPrismaMock();
    const preAuthChallenges = createPreAuthChallengeMock();
    const service = createService(prisma, preAuthChallenges);
    prisma.user.findUnique.mockResolvedValue(
      await activeUser({ mustChangePassword: true }),
    );

    const result = await service.login(' Owner ', password, context);

    expect(result).toEqual({
      requiresPreAuth: true,
      stage: PreAuthChallengeStage.CHANGE_PASSWORD,
      preAuthToken: 'pre-auth-token',
      user: {
        id: userId,
        username: 'owner',
        role: UserRole.OWNER,
      },
    });
    expect(preAuthChallenges.create).toHaveBeenCalledWith(
      userId,
      PreAuthChallengeStage.CHANGE_PASSWORD,
    );
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
    expect(prisma.userSession.create).not.toHaveBeenCalled();
    expect(prisma.securityEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: SecurityEventType.LOGIN_SUCCESS,
          success: true,
        }),
      }),
    );
  });

  it('routes a valid password to ENROLL_2FA when 2FA is disabled', async () => {
    const prisma = createPrismaMock();
    const preAuthChallenges = createPreAuthChallengeMock();
    const service = createService(prisma, preAuthChallenges);
    prisma.user.findUnique.mockResolvedValue(
      await activeUser({
        mustChangePassword: false,
        twoFactorEnabled: false,
      }),
    );

    const result = await service.login('owner', password, context);

    expect(result.stage).toBe(PreAuthChallengeStage.ENROLL_2FA);
    expect(preAuthChallenges.create).toHaveBeenCalledWith(
      userId,
      PreAuthChallengeStage.ENROLL_2FA,
    );
    expect(prisma.userSession.create).not.toHaveBeenCalled();
  });

  it('routes a valid password to VERIFY_2FA without exposing secrets', async () => {
    const prisma = createPrismaMock();
    const preAuthChallenges = createPreAuthChallengeMock();
    const service = createService(prisma, preAuthChallenges);
    const encryptedSecret = 'v1:encrypted-secret';
    prisma.user.findUnique.mockResolvedValue(
      await activeUser({
        mustChangePassword: false,
        twoFactorEnabled: true,
        twoFactorSecretEncrypted: encryptedSecret,
      }),
    );

    const result = await service.login('owner', password, context);

    expect(result.stage).toBe(PreAuthChallengeStage.VERIFY_2FA);
    expect(preAuthChallenges.create).toHaveBeenCalledWith(
      userId,
      PreAuthChallengeStage.VERIFY_2FA,
    );
    expect(result.user).toEqual({
      id: userId,
      username: 'owner',
      role: UserRole.OWNER,
    });
    expect(JSON.stringify(result)).not.toContain('passwordHash');
    expect(JSON.stringify(result)).not.toContain(encryptedSecret);
    expect(prisma.userSession.create).not.toHaveBeenCalled();
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
    const preAuthChallenges = createPreAuthChallengeMock();
    const service = createService(prisma, preAuthChallenges);
    prisma.user.findUnique.mockResolvedValue(await activeUser({ isActive: false }));

    await expect(service.login('owner', password, context)).rejects.toThrow(
      INVALID_CREDENTIALS_MESSAGE,
    );
    expect(prisma.userSession.create).not.toHaveBeenCalled();
    expect(preAuthChallenges.create).not.toHaveBeenCalled();
  });

  it('rejects locked users without creating a pre-auth challenge', async () => {
    const prisma = createPrismaMock();
    const preAuthChallenges = createPreAuthChallengeMock();
    const service = createService(prisma, preAuthChallenges);
    prisma.user.findUnique.mockResolvedValue(
      await activeUser({ lockedUntil: new Date(Date.now() + 60_000) }),
    );

    await expect(service.login('owner', password, context)).rejects.toThrow(
      INVALID_CREDENTIALS_MESSAGE,
    );
    expect(prisma.userSession.create).not.toHaveBeenCalled();
    expect(preAuthChallenges.create).not.toHaveBeenCalled();
  });

  it('changes a temporary password and advances to ENROLL_2FA', async () => {
    const prisma = createPrismaMock();
    const preAuthChallenges = createPreAuthChallengeMock();
    const service = createService(prisma, preAuthChallenges);
    prisma.user.findUnique.mockResolvedValue(
      await activeUser({
        mustChangePassword: true,
        twoFactorEnabled: false,
      }),
    );
    const newPassword = 'new-secure-password-123';

    const result = await service.changePasswordPreAuth(
      'change-password-token',
      newPassword,
    );
    const updateData = prisma.user.updateMany.mock.calls[0][0].data;

    expect(preAuthChallenges.validate).toHaveBeenCalledWith(
      'change-password-token',
      PreAuthChallengeStage.CHANGE_PASSWORD,
    );
    expect(updateData).toEqual({
      passwordHash: expect.any(String),
      mustChangePassword: false,
      passwordChangedAt: expect.any(Date),
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
    await expect(
      argon2.verify(updateData.passwordHash, newPassword),
    ).resolves.toBe(true);
    expect(preAuthChallenges.advance).toHaveBeenCalledWith(
      'change-password-challenge-id',
      PreAuthChallengeStage.ENROLL_2FA,
      expect.any(Object),
    );
    expect(result).toEqual({
      requiresPreAuth: true,
      stage: PreAuthChallengeStage.ENROLL_2FA,
      preAuthToken: 'next-pre-auth-token',
    });
    expect(prisma.userSession.create).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('passwordHash');
    expect(JSON.stringify(result)).not.toContain('twoFactorSecret');
  });

  it('advances to VERIFY_2FA when 2FA is already enabled', async () => {
    const prisma = createPrismaMock();
    const preAuthChallenges = createPreAuthChallengeMock();
    const service = createService(prisma, preAuthChallenges);
    prisma.user.findUnique.mockResolvedValue(
      await activeUser({
        mustChangePassword: true,
        twoFactorEnabled: true,
      }),
    );

    const result = await service.changePasswordPreAuth(
      'change-password-token',
      'new-secure-password-123',
    );

    expect(result.stage).toBe(PreAuthChallengeStage.VERIFY_2FA);
    expect(preAuthChallenges.advance).toHaveBeenCalledWith(
      'change-password-challenge-id',
      PreAuthChallengeStage.VERIFY_2FA,
      expect.any(Object),
    );
    expect(prisma.userSession.create).not.toHaveBeenCalled();
  });

  it('rejects an invalid pre-auth challenge without changing the password', async () => {
    const prisma = createPrismaMock();
    const preAuthChallenges = createPreAuthChallengeMock();
    preAuthChallenges.validate.mockRejectedValue(new UnauthorizedException());
    const service = createService(prisma, preAuthChallenges);

    await expect(
      service.changePasswordPreAuth(
        'invalid-change-password-token',
        'new-secure-password-123',
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
    expect(preAuthChallenges.advance).not.toHaveBeenCalled();
  });

  it('rejects a password that violates the existing password policy', async () => {
    const prisma = createPrismaMock();
    const preAuthChallenges = createPreAuthChallengeMock();
    const service = createService(prisma, preAuthChallenges);
    prisma.user.findUnique.mockResolvedValue(
      await activeUser({ mustChangePassword: true }),
    );

    await expect(
      service.changePasswordPreAuth('change-password-token', 'short'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
    expect(preAuthChallenges.advance).not.toHaveBeenCalled();
  });

  it('begins 2FA enrollment without creating a session', async () => {
    const prisma = createPrismaMock();
    const preAuthChallenges = createPreAuthChallengeMock();
    const twoFactor = createTwoFactorMock();
    const service = createService(prisma, preAuthChallenges, twoFactor);
    prisma.user.findUnique.mockResolvedValue(await activeUser());

    const result = await service.beginTwoFactorEnrollment('enroll-token');

    expect(preAuthChallenges.validate).toHaveBeenCalledWith(
      'enroll-token',
      PreAuthChallengeStage.ENROLL_2FA,
    );
    expect(twoFactor.beginEnrollment).toHaveBeenCalledWith(userId);
    expect(result).toEqual({
      otpauthUrl: 'otpauth://totp/MVO%20Inventory%3Aowner',
      manualKey: 'MANUALKEY',
    });
    expect(prisma.userSession.create).not.toHaveBeenCalled();
    expect(preAuthChallenges.consume).not.toHaveBeenCalled();
  });

  it('records a failed challenge attempt for an invalid TOTP', async () => {
    const prisma = createPrismaMock();
    const preAuthChallenges = createPreAuthChallengeMock();
    const twoFactor = createTwoFactorMock();
    twoFactor.confirmEnrollment.mockRejectedValue(
      new InvalidTwoFactorTokenException(),
    );
    const service = createService(prisma, preAuthChallenges, twoFactor);
    prisma.user.findUnique.mockResolvedValue(await activeUser());

    await expect(
      service.confirmTwoFactorEnrollment('enroll-token', '000000', context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(preAuthChallenges.recordFailure).toHaveBeenCalledWith(
      'change-password-challenge-id',
    );
    expect(preAuthChallenges.consume).not.toHaveBeenCalled();
    expect(prisma.userSession.create).not.toHaveBeenCalled();
    expect(prisma.securityEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: SecurityEventType.TWO_FACTOR_FAILED,
        actorUserId: userId,
        targetUserId: userId,
        metadata: { role: UserRole.OWNER, method: 'TOTP' },
        success: false,
      }),
    });
  });

  it('confirms 2FA, consumes pre-auth, and creates exactly one session', async () => {
    const prisma = createPrismaMock();
    const preAuthChallenges = createPreAuthChallengeMock();
    const twoFactor = createTwoFactorMock();
    const service = createService(prisma, preAuthChallenges, twoFactor);
    prisma.user.findUnique.mockResolvedValue(await activeUser());

    const result = await service.confirmTwoFactorEnrollment(
      'enroll-token',
      '123456',
      context,
    );

    expect(twoFactor.confirmEnrollment).toHaveBeenCalledWith(
      userId,
      '123456',
      expect.any(Object),
    );
    expect(preAuthChallenges.consume).toHaveBeenCalledWith(
      'change-password-challenge-id',
      expect.any(Object),
    );
    expect(result.authenticated).toBe(true);
    expect(result.recoveryCodes).toHaveLength(10);
    expect(result.user).toEqual({
      id: userId,
      username: 'owner',
      role: UserRole.OWNER,
    });
    expect(prisma.userSession.create).toHaveBeenCalledTimes(1);
    expect(prisma.userSession.create).toHaveBeenCalledWith({
      data: {
        userId,
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        expiresAt: expect.any(Date),
      },
    });
    expect(prisma.securityEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: SecurityEventType.TWO_FACTOR_ENABLED,
        actorUserId: userId,
        targetUserId: userId,
        metadata: { role: UserRole.OWNER, method: 'TOTP' },
        success: true,
      }),
    });
    const auditPayload = JSON.stringify(
      prisma.securityEvent.create.mock.calls[0][0],
    );
    expect(auditPayload).not.toContain('123456');
    expect(auditPayload).not.toContain('enroll-token');
    expect(auditPayload).not.toContain('passwordHash');
    expect(auditPayload).not.toContain('session-token');
    expect(JSON.stringify(result)).not.toContain('passwordHash');
    expect(JSON.stringify(result)).not.toContain('twoFactorSecret');
  });

  it('verifies enabled 2FA, consumes pre-auth, and creates one session', async () => {
    const prisma = createPrismaMock();
    const preAuthChallenges = createPreAuthChallengeMock();
    const twoFactor = createTwoFactorMock();
    const service = createService(prisma, preAuthChallenges, twoFactor);
    prisma.user.findUnique.mockResolvedValue(
      await activeUser({ twoFactorEnabled: true }),
    );

    const result = await service.verifyTwoFactor(
      'verify-token',
      '123456',
      context,
    );

    expect(preAuthChallenges.validate).toHaveBeenCalledWith(
      'verify-token',
      PreAuthChallengeStage.VERIFY_2FA,
    );
    expect(twoFactor.verifyEnabledToken).toHaveBeenCalledWith(userId, '123456');
    expect(preAuthChallenges.consume).toHaveBeenCalledWith(
      'change-password-challenge-id',
      expect.any(Object),
    );
    expect(prisma.userSession.create).toHaveBeenCalledTimes(1);
    expect(result.authenticated).toBe(true);
    expect(result.user).toEqual({
      id: userId,
      username: 'owner',
      role: UserRole.OWNER,
    });
    expect(prisma.securityEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: SecurityEventType.TWO_FACTOR_VERIFIED,
        actorUserId: userId,
        targetUserId: userId,
        metadata: { role: UserRole.OWNER, method: 'TOTP' },
        success: true,
      }),
    });
    expect(JSON.stringify(result)).not.toContain('passwordHash');
    expect(JSON.stringify(result)).not.toContain('twoFactorSecretEncrypted');
  });

  it('records a failed VERIFY_2FA attempt without creating a session', async () => {
    const prisma = createPrismaMock();
    const preAuthChallenges = createPreAuthChallengeMock();
    const twoFactor = createTwoFactorMock();
    twoFactor.verifyEnabledToken.mockRejectedValue(
      new InvalidTwoFactorTokenException(),
    );
    const service = createService(prisma, preAuthChallenges, twoFactor);
    prisma.user.findUnique.mockResolvedValue(
      await activeUser({ twoFactorEnabled: true }),
    );

    await expect(
      service.verifyTwoFactor('verify-token', '000000', context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(preAuthChallenges.recordFailure).toHaveBeenCalledWith(
      'change-password-challenge-id',
    );
    expect(preAuthChallenges.consume).not.toHaveBeenCalled();
    expect(prisma.userSession.create).not.toHaveBeenCalled();
    expect(prisma.securityEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: SecurityEventType.TWO_FACTOR_FAILED,
        actorUserId: userId,
        targetUserId: userId,
        metadata: { role: UserRole.OWNER, method: 'TOTP' },
        success: false,
      }),
    });
  });

  it('consumes a recovery code and challenge before creating one session', async () => {
    const prisma = createPrismaMock();
    const preAuthChallenges = createPreAuthChallengeMock();
    const twoFactor = createTwoFactorMock();
    const service = createService(prisma, preAuthChallenges, twoFactor);
    prisma.user.findUnique.mockResolvedValue(
      await activeUser({ twoFactorEnabled: true }),
    );

    const result = await service.verifyTwoFactorRecoveryCode(
      'verify-token',
      'ABCD-EFGH-JKLM-NPQR',
      context,
    );

    expect(preAuthChallenges.validate).toHaveBeenCalledWith(
      'verify-token',
      PreAuthChallengeStage.VERIFY_2FA,
    );
    expect(twoFactor.consumeRecoveryCode).toHaveBeenCalledWith(
      userId,
      'ABCD-EFGH-JKLM-NPQR',
      expect.any(Object),
    );
    expect(preAuthChallenges.consume).toHaveBeenCalledWith(
      'change-password-challenge-id',
      expect.any(Object),
    );
    expect(prisma.userSession.create).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      authenticated: true,
      user: {
        id: userId,
        username: 'owner',
        role: UserRole.OWNER,
      },
      session: expect.objectContaining({ token: expect.any(String) }),
    });
    expect(prisma.securityEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: SecurityEventType.TWO_FACTOR_RECOVERY_CODE_USED,
        actorUserId: userId,
        targetUserId: userId,
        metadata: { role: UserRole.OWNER, method: 'RECOVERY_CODE' },
        success: true,
      }),
    });
    expect(
      JSON.stringify(prisma.securityEvent.create.mock.calls[0][0]),
    ).not.toContain('ABCD-EFGH-JKLM-NPQR');
    expect(JSON.stringify(result)).not.toContain('passwordHash');
    expect(JSON.stringify(result)).not.toContain('twoFactorSecretEncrypted');
  });

  it('records an invalid recovery-code attempt without creating a session', async () => {
    const prisma = createPrismaMock();
    const preAuthChallenges = createPreAuthChallengeMock();
    const twoFactor = createTwoFactorMock();
    twoFactor.consumeRecoveryCode.mockRejectedValue(
      new InvalidRecoveryCodeException(),
    );
    const service = createService(prisma, preAuthChallenges, twoFactor);
    prisma.user.findUnique.mockResolvedValue(
      await activeUser({ twoFactorEnabled: true }),
    );

    await expect(
      service.verifyTwoFactorRecoveryCode(
        'verify-token',
        'ABCD-EFGH-JKLM-NPQR',
        context,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(preAuthChallenges.recordFailure).toHaveBeenCalledWith(
      'change-password-challenge-id',
    );
    expect(preAuthChallenges.consume).not.toHaveBeenCalled();
    expect(prisma.userSession.create).not.toHaveBeenCalled();
    expect(prisma.securityEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: SecurityEventType.TWO_FACTOR_FAILED,
        actorUserId: userId,
        targetUserId: userId,
        metadata: { role: UserRole.OWNER, method: 'RECOVERY_CODE' },
        success: false,
      }),
    });
  });

  it('creates only one session for concurrent use of one recovery code', async () => {
    const prisma = createPrismaMock();
    const preAuthChallenges = createPreAuthChallengeMock();
    const twoFactor = createTwoFactorMock();
    let available = true;
    twoFactor.consumeRecoveryCode.mockImplementation(async () => {
      if (!available) throw new InvalidRecoveryCodeException();
      available = false;
    });
    const service = createService(prisma, preAuthChallenges, twoFactor);
    prisma.user.findUnique.mockResolvedValue(
      await activeUser({ twoFactorEnabled: true }),
    );

    const outcomes = await Promise.allSettled([
      service.verifyTwoFactorRecoveryCode(
        'verify-token',
        'ABCD-EFGH-JKLM-NPQR',
        context,
      ),
      service.verifyTwoFactorRecoveryCode(
        'verify-token',
        'ABCD-EFGH-JKLM-NPQR',
        context,
      ),
    ]);

    expect(outcomes.map(({ status }) => status).sort()).toEqual([
      'fulfilled',
      'rejected',
    ]);
    expect(prisma.userSession.create).toHaveBeenCalledTimes(1);
    expect(preAuthChallenges.consume).toHaveBeenCalledTimes(1);
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
