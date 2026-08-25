import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PreAuthChallengeStage } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const INVALID_CHALLENGE_MESSAGE = 'Недійсний або прострочений запит підтвердження.';

type ChallengeRecord = {
  id: string;
  userId: string;
  stage: PreAuthChallengeStage;
  expiresAt: Date;
  failedAttempts: number;
};

type IssuedChallenge = {
  token: string;
  expiresAt: Date;
};

@Injectable()
export class PreAuthChallengeService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    stage: PreAuthChallengeStage,
  ): Promise<IssuedChallenge> {
    const issued = this.issueToken();

    await this.prisma.$transaction(async (transaction) => {
      await transaction.preAuthChallenge.deleteMany({ where: { userId } });
      await transaction.preAuthChallenge.create({
        data: {
          userId,
          tokenHash: issued.tokenHash,
          stage,
          expiresAt: issued.expiresAt,
        },
      });
    });

    return { token: issued.token, expiresAt: issued.expiresAt };
  }

  async validate(
    token: string,
    expectedStage: PreAuthChallengeStage,
  ): Promise<{ id: string; userId: string }> {
    const challenge = await this.prisma.preAuthChallenge.findUnique({
      where: { tokenHash: this.hashToken(token) },
      select: {
        id: true,
        userId: true,
        stage: true,
        expiresAt: true,
        failedAttempts: true,
      },
    });

    this.assertValid(challenge, expectedStage);
    return { id: challenge.id, userId: challenge.userId };
  }

  async recordFailure(challengeId: string): Promise<void> {
    const updated = await this.prisma.preAuthChallenge.updateMany({
      where: {
        id: challengeId,
        expiresAt: { gt: new Date() },
        failedAttempts: { lt: MAX_FAILED_ATTEMPTS },
      },
      data: { failedAttempts: { increment: 1 } },
    });

    if (updated.count !== 1) this.reject();
  }

  async advance(
    challengeId: string,
    nextStage: PreAuthChallengeStage,
  ): Promise<IssuedChallenge> {
    const issued = this.issueToken();

    await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.preAuthChallenge.findUnique({
        where: { id: challengeId },
        select: {
          id: true,
          userId: true,
          stage: true,
          expiresAt: true,
          failedAttempts: true,
        },
      });
      this.assertValid(current);

      const removed = await transaction.preAuthChallenge.deleteMany({
        where: {
          id: current.id,
          expiresAt: { gt: new Date() },
          failedAttempts: { lt: MAX_FAILED_ATTEMPTS },
        },
      });
      if (removed.count !== 1) this.reject();

      await transaction.preAuthChallenge.deleteMany({
        where: { userId: current.userId },
      });
      await transaction.preAuthChallenge.create({
        data: {
          userId: current.userId,
          tokenHash: issued.tokenHash,
          stage: nextStage,
          expiresAt: issued.expiresAt,
        },
      });
    });

    return { token: issued.token, expiresAt: issued.expiresAt };
  }

  async consume(challengeId: string): Promise<void> {
    await this.prisma.preAuthChallenge.deleteMany({
      where: { id: challengeId },
    });
  }

  private issueToken(): IssuedChallenge & { tokenHash: string } {
    const token = randomBytes(32).toString('base64url');
    return {
      token,
      tokenHash: this.hashToken(token),
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }

  private assertValid(
    challenge: ChallengeRecord | null,
    expectedStage?: PreAuthChallengeStage,
  ): asserts challenge is ChallengeRecord {
    if (
      !challenge ||
      challenge.expiresAt <= new Date() ||
      challenge.failedAttempts >= MAX_FAILED_ATTEMPTS ||
      (expectedStage !== undefined && challenge.stage !== expectedStage)
    ) {
      this.reject();
    }
  }

  private reject(): never {
    throw new UnauthorizedException(INVALID_CHALLENGE_MESSAGE);
  }
}
