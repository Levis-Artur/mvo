import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { authenticator } from 'otplib';
import { hashRecoveryCode } from './recovery-code';
import { encryptTotpSecret } from './totp-secret-crypto';
import { generateSecret } from './totp';
import {
  InvalidRecoveryCodeException,
  InvalidTwoFactorTokenException,
  TwoFactorService,
} from './two-factor.service';

const userId = '11111111-1111-4111-8111-111111111111';
const encryptionKey = Buffer.alloc(32, 7).toString('base64');

function user(overrides: Record<string, unknown> = {}) {
  return {
    id: userId,
    username: 'owner',
    isActive: true,
    twoFactorEnabled: false,
    twoFactorSecretEncrypted: null,
    ...overrides,
  };
}

function createPrismaMock() {
  const transaction = {
    user: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    twoFactorRecoveryCode: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 10 }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const prisma = {
    user: {
      findFirst: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: jest.fn(
      async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    ),
  };

  return { prisma, transaction };
}

function validPendingEnrollment() {
  const secret = generateSecret();
  const encryptedSecret = encryptTotpSecret(secret, encryptionKey);
  const token = authenticator
    .clone({ digits: 6, step: 30, window: 1 })
    .generate(secret);
  return { secret, encryptedSecret, token };
}

describe('TwoFactorService', () => {
  const previousKey = process.env.TOTP_ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.TOTP_ENCRYPTION_KEY = encryptionKey;
  });

  afterAll(() => {
    if (previousKey === undefined) delete process.env.TOTP_ENCRYPTION_KEY;
    else process.env.TOTP_ENCRYPTION_KEY = previousKey;
  });

  it('begins enrollment with an encrypted secret and valid otpauth URL', async () => {
    const { prisma } = createPrismaMock();
    prisma.user.findFirst.mockResolvedValue(user());
    const service = new TwoFactorService(prisma as never);

    const result = await service.beginEnrollment(userId);
    const storedSecret = prisma.user.updateMany.mock.calls[0][0].data
      .twoFactorSecretEncrypted as string;
    const url = new URL(result.otpauthUrl);

    expect(url.protocol).toBe('otpauth:');
    expect(url.searchParams.get('issuer')).toBe('MVO Inventory');
    expect(result.manualKey).toBeTruthy();
    expect(storedSecret).toMatch(/^v1:/);
    expect(prisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          twoFactorEnabled: false,
          twoFactorConfirmedAt: null,
        }),
      }),
    );
  });

  it('never stores the plaintext TOTP secret on User', async () => {
    const { prisma } = createPrismaMock();
    prisma.user.findFirst.mockResolvedValue(user());
    const service = new TwoFactorService(prisma as never);

    const result = await service.beginEnrollment(userId);
    const data = prisma.user.updateMany.mock.calls[0][0].data;

    expect(data.twoFactorSecretEncrypted).not.toBe(result.manualKey);
    expect(JSON.stringify(data)).not.toContain(result.manualKey);
  });

  it('rejects beginEnrollment for an enabled user', async () => {
    const { prisma } = createPrismaMock();
    prisma.user.findFirst.mockResolvedValue(user({ twoFactorEnabled: true }));
    const service = new TwoFactorService(prisma as never);

    await expect(service.beginEnrollment(userId)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('activates 2FA for a valid token', async () => {
    const { encryptedSecret, token } = validPendingEnrollment();
    const { prisma, transaction } = createPrismaMock();
    prisma.user.findFirst.mockResolvedValue(
      user({ twoFactorSecretEncrypted: encryptedSecret }),
    );
    const service = new TwoFactorService(prisma as never);

    await service.confirmEnrollment(userId, token);

    expect(transaction.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          twoFactorEnabled: true,
          twoFactorConfirmedAt: expect.any(Date),
        },
      }),
    );
  });

  it('does not activate 2FA for an invalid token', async () => {
    const { encryptedSecret } = validPendingEnrollment();
    const { prisma, transaction } = createPrismaMock();
    prisma.user.findFirst.mockResolvedValue(
      user({ twoFactorSecretEncrypted: encryptedSecret }),
    );
    const service = new TwoFactorService(prisma as never);

    await expect(
      service.confirmEnrollment(userId, 'invalid-token'),
    ).rejects.toThrow('Невірний код автентифікатора.');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(transaction.user.updateMany).not.toHaveBeenCalled();
  });

  it('replaces previous recovery codes with ten hashes', async () => {
    const { encryptedSecret, token } = validPendingEnrollment();
    const { prisma, transaction } = createPrismaMock();
    prisma.user.findFirst.mockResolvedValue(
      user({ twoFactorSecretEncrypted: encryptedSecret }),
    );
    const service = new TwoFactorService(prisma as never);

    const result = await service.confirmEnrollment(userId, token);
    const storedCodes = transaction.twoFactorRecoveryCode.createMany.mock
      .calls[0][0].data as Array<{ userId: string; codeHash: string }>;

    expect(result.recoveryCodes).toHaveLength(10);
    expect(new Set(result.recoveryCodes).size).toBe(10);
    expect(transaction.twoFactorRecoveryCode.deleteMany).toHaveBeenCalledWith({
      where: { userId },
    });
    expect(storedCodes).toHaveLength(10);
    expect(storedCodes.map(({ codeHash }) => codeHash)).toEqual(
      result.recoveryCodes.map(hashRecoveryCode),
    );
  });

  it('does not persist plaintext recovery codes', async () => {
    const { encryptedSecret, token } = validPendingEnrollment();
    const { prisma, transaction } = createPrismaMock();
    prisma.user.findFirst.mockResolvedValue(
      user({ twoFactorSecretEncrypted: encryptedSecret }),
    );
    const service = new TwoFactorService(prisma as never);

    const result = await service.confirmEnrollment(userId, token);
    const persistedData = JSON.stringify(
      transaction.twoFactorRecoveryCode.createMany.mock.calls[0][0].data,
    );

    for (const code of result.recoveryCodes) {
      expect(persistedData).not.toContain(code);
    }
  });

  it('does not partially update state on repeated confirmation', async () => {
    const { encryptedSecret, token } = validPendingEnrollment();
    const { prisma, transaction } = createPrismaMock();
    prisma.user.findFirst.mockResolvedValue(
      user({
        twoFactorEnabled: true,
        twoFactorSecretEncrypted: encryptedSecret,
      }),
    );
    const service = new TwoFactorService(prisma as never);

    await expect(service.confirmEnrollment(userId, token)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(transaction.user.updateMany).not.toHaveBeenCalled();
    expect(transaction.twoFactorRecoveryCode.deleteMany).not.toHaveBeenCalled();
    expect(transaction.twoFactorRecoveryCode.createMany).not.toHaveBeenCalled();
  });

  it('verifies a valid token for an enabled user', async () => {
    const { encryptedSecret, token } = validPendingEnrollment();
    const { prisma } = createPrismaMock();
    prisma.user.findFirst.mockResolvedValue(
      user({
        twoFactorEnabled: true,
        twoFactorSecretEncrypted: encryptedSecret,
      }),
    );
    const service = new TwoFactorService(prisma as never);

    await expect(service.verifyEnabledToken(userId, token)).resolves.toBeUndefined();
  });

  it('rejects an invalid token for an enabled user', async () => {
    const { encryptedSecret, token } = validPendingEnrollment();
    const { prisma } = createPrismaMock();
    prisma.user.findFirst.mockResolvedValue(
      user({
        twoFactorEnabled: true,
        twoFactorSecretEncrypted: encryptedSecret,
      }),
    );
    const service = new TwoFactorService(prisma as never);
    const invalidToken = token === '000000' ? '000001' : '000000';

    await expect(
      service.verifyEnabledToken(userId, invalidToken),
    ).rejects.toBeInstanceOf(InvalidTwoFactorTokenException);
  });

  it('rejects a user without enabled 2FA', async () => {
    const { encryptedSecret, token } = validPendingEnrollment();
    const { prisma } = createPrismaMock();
    prisma.user.findFirst.mockResolvedValue(
      user({ twoFactorSecretEncrypted: encryptedSecret }),
    );
    const service = new TwoFactorService(prisma as never);

    await expect(
      service.verifyEnabledToken(userId, token),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an enabled user without an encrypted secret', async () => {
    const { token } = validPendingEnrollment();
    const { prisma } = createPrismaMock();
    prisma.user.findFirst.mockResolvedValue(user({ twoFactorEnabled: true }));
    const service = new TwoFactorService(prisma as never);

    await expect(
      service.verifyEnabledToken(userId, token),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('normalizes and atomically consumes an unused recovery code', async () => {
    const { prisma, transaction } = createPrismaMock();
    prisma.user.findFirst.mockResolvedValue(user({ twoFactorEnabled: true }));
    const service = new TwoFactorService(prisma as never);

    await service.consumeRecoveryCode(
      userId,
      '  abcd-efgh-jklm-npqr  ',
      transaction as never,
    );

    expect(transaction.twoFactorRecoveryCode.updateMany).toHaveBeenCalledWith({
      where: {
        userId,
        codeHash: hashRecoveryCode('ABCD-EFGH-JKLM-NPQR'),
        usedAt: null,
      },
      data: { usedAt: expect.any(Date) },
    });
  });

  it('rejects a missing or already used recovery code', async () => {
    const { prisma, transaction } = createPrismaMock();
    prisma.user.findFirst.mockResolvedValue(user({ twoFactorEnabled: true }));
    transaction.twoFactorRecoveryCode.updateMany.mockResolvedValue({ count: 0 });
    const service = new TwoFactorService(prisma as never);

    await expect(
      service.consumeRecoveryCode(
        userId,
        'ABCD-EFGH-JKLM-NPQR',
        transaction as never,
      ),
    ).rejects.toBeInstanceOf(InvalidRecoveryCodeException);
  });

  it('rejects a malformed recovery code without querying stored hashes', async () => {
    const { prisma, transaction } = createPrismaMock();
    prisma.user.findFirst.mockResolvedValue(user({ twoFactorEnabled: true }));
    const service = new TwoFactorService(prisma as never);

    await expect(
      service.consumeRecoveryCode(userId, 'not-a-code', transaction as never),
    ).rejects.toBeInstanceOf(InvalidRecoveryCodeException);
    expect(transaction.twoFactorRecoveryCode.updateMany).not.toHaveBeenCalled();
  });

  it('allows only one concurrent consume of the same recovery code', async () => {
    const { prisma, transaction } = createPrismaMock();
    prisma.user.findFirst.mockResolvedValue(user({ twoFactorEnabled: true }));
    let available = true;
    transaction.twoFactorRecoveryCode.updateMany.mockImplementation(async () => {
      if (!available) return { count: 0 };
      available = false;
      return { count: 1 };
    });
    const service = new TwoFactorService(prisma as never);

    const outcomes = await Promise.allSettled([
      service.consumeRecoveryCode(
        userId,
        'ABCD-EFGH-JKLM-NPQR',
        transaction as never,
      ),
      service.consumeRecoveryCode(
        userId,
        'ABCD-EFGH-JKLM-NPQR',
        transaction as never,
      ),
    ]);

    expect(outcomes.map(({ status }) => status).sort()).toEqual([
      'fulfilled',
      'rejected',
    ]);
  });
});
