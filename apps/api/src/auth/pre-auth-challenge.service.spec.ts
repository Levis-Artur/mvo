import { UnauthorizedException } from '@nestjs/common';
import { PreAuthChallengeStage } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PreAuthChallengeService } from './pre-auth-challenge.service';

type Challenge = {
  id: string;
  userId: string;
  tokenHash: string;
  stage: PreAuthChallengeStage;
  expiresAt: Date;
  failedAttempts: number;
  createdAt: Date;
};

function createPrismaMock() {
  const records = new Map<string, Challenge>();
  let sequence = 0;

  function matches(record: Challenge, where: Record<string, any>): boolean {
    if (where.id !== undefined && record.id !== where.id) return false;
    if (where.userId !== undefined && record.userId !== where.userId) return false;
    if (where.expiresAt?.gt && record.expiresAt <= where.expiresAt.gt) {
      return false;
    }
    if (
      where.failedAttempts?.lt !== undefined &&
      record.failedAttempts >= where.failedAttempts.lt
    ) {
      return false;
    }
    return true;
  }

  const preAuthChallenge = {
    create: jest.fn(async ({ data }: { data: Omit<Challenge, 'id' | 'failedAttempts' | 'createdAt'> }) => {
      sequence += 1;
      const record: Challenge = {
        id: `challenge-${sequence}`,
        failedAttempts: 0,
        createdAt: new Date(),
        ...data,
      };
      records.set(record.id, record);
      return record;
    }),
    findUnique: jest.fn(async ({ where }: { where: { id?: string; tokenHash?: string } }) => {
      if (where.id) return records.get(where.id) ?? null;
      return (
        [...records.values()].find(
          (record) => record.tokenHash === where.tokenHash,
        ) ?? null
      );
    }),
    deleteMany: jest.fn(async ({ where }: { where: Record<string, any> }) => {
      let count = 0;
      for (const [id, record] of records) {
        if (matches(record, where)) {
          records.delete(id);
          count += 1;
        }
      }
      return { count };
    }),
    updateMany: jest.fn(
      async ({
        where,
        data,
      }: {
        where: Record<string, any>;
        data: { failedAttempts: { increment: number } };
      }) => {
        let count = 0;
        for (const record of records.values()) {
          if (matches(record, where)) {
            record.failedAttempts += data.failedAttempts.increment;
            count += 1;
          }
        }
        return { count };
      },
    ),
  };

  const prisma = {
    preAuthChallenge,
    $transaction: jest.fn(
      async (callback: (client: { preAuthChallenge: typeof preAuthChallenge }) => Promise<unknown>) =>
        callback({ preAuthChallenge }),
    ),
  };

  return { prisma, records };
}

describe('PreAuthChallengeService', () => {
  const userId = '11111111-1111-4111-8111-111111111111';

  it('returns a plaintext token while persisting only its SHA-256 hash', async () => {
    const { prisma, records } = createPrismaMock();
    const service = new PreAuthChallengeService(prisma as never);

    const result = await service.create(
      userId,
      PreAuthChallengeStage.CHANGE_PASSWORD,
    );
    const [stored] = [...records.values()];

    expect(Buffer.from(result.token, 'base64url')).toHaveLength(32);
    expect(stored.tokenHash).toBe(
      createHash('sha256').update(result.token).digest('hex'),
    );
    expect(JSON.stringify(stored)).not.toContain(result.token);
  });

  it('validates the correct token and stage', async () => {
    const { prisma } = createPrismaMock();
    const service = new PreAuthChallengeService(prisma as never);
    const created = await service.create(
      userId,
      PreAuthChallengeStage.ENROLL_2FA,
    );

    await expect(
      service.validate(created.token, PreAuthChallengeStage.ENROLL_2FA),
    ).resolves.toEqual({ id: 'challenge-1', userId });
  });

  it('rejects a token used for the wrong stage', async () => {
    const { prisma } = createPrismaMock();
    const service = new PreAuthChallengeService(prisma as never);
    const created = await service.create(
      userId,
      PreAuthChallengeStage.CHANGE_PASSWORD,
    );

    await expect(
      service.validate(created.token, PreAuthChallengeStage.VERIFY_2FA),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an expired challenge', async () => {
    const { prisma, records } = createPrismaMock();
    const service = new PreAuthChallengeService(prisma as never);
    const created = await service.create(
      userId,
      PreAuthChallengeStage.VERIFY_2FA,
    );
    records.get('challenge-1')!.expiresAt = new Date(Date.now() - 1);

    await expect(
      service.validate(created.token, PreAuthChallengeStage.VERIFY_2FA),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a challenge after five recorded failures', async () => {
    const { prisma } = createPrismaMock();
    const service = new PreAuthChallengeService(prisma as never);
    const created = await service.create(
      userId,
      PreAuthChallengeStage.VERIFY_2FA,
    );
    const validated = await service.validate(
      created.token,
      PreAuthChallengeStage.VERIFY_2FA,
    );

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await service.recordFailure(validated.id);
    }

    await expect(
      service.validate(created.token, PreAuthChallengeStage.VERIFY_2FA),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('advances with a new token and invalidates the old token', async () => {
    const { prisma } = createPrismaMock();
    const service = new PreAuthChallengeService(prisma as never);
    const created = await service.create(
      userId,
      PreAuthChallengeStage.CHANGE_PASSWORD,
    );
    const current = await service.validate(
      created.token,
      PreAuthChallengeStage.CHANGE_PASSWORD,
    );

    const advanced = await service.advance(
      current.id,
      PreAuthChallengeStage.ENROLL_2FA,
    );

    expect(advanced.token).not.toBe(created.token);
    await expect(
      service.validate(created.token, PreAuthChallengeStage.CHANGE_PASSWORD),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      service.validate(advanced.token, PreAuthChallengeStage.ENROLL_2FA),
    ).resolves.toEqual({ id: 'challenge-2', userId });
  });

  it('consume invalidates the challenge token', async () => {
    const { prisma } = createPrismaMock();
    const service = new PreAuthChallengeService(prisma as never);
    const created = await service.create(
      userId,
      PreAuthChallengeStage.VERIFY_2FA,
    );
    const current = await service.validate(
      created.token,
      PreAuthChallengeStage.VERIFY_2FA,
    );

    await service.consume(current.id);

    await expect(
      service.validate(created.token, PreAuthChallengeStage.VERIFY_2FA),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('creating a new challenge invalidates the previous challenge for the user', async () => {
    const { prisma } = createPrismaMock();
    const service = new PreAuthChallengeService(prisma as never);
    const first = await service.create(
      userId,
      PreAuthChallengeStage.CHANGE_PASSWORD,
    );
    const second = await service.create(
      userId,
      PreAuthChallengeStage.ENROLL_2FA,
    );

    await expect(
      service.validate(first.token, PreAuthChallengeStage.CHANGE_PASSWORD),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      service.validate(second.token, PreAuthChallengeStage.ENROLL_2FA),
    ).resolves.toEqual({ id: 'challenge-2', userId });
  });
});
