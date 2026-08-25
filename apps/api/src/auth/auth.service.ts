import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  PreAuthChallengeStage,
  Prisma,
  SecurityEventType,
  User,
  UserSession,
} from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  ACCOUNT_LOCK_MS,
  MAX_FAILED_LOGIN_ATTEMPTS,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  SESSION_TTL_MS,
} from './auth.constants';
import type { CurrentUser } from './auth.types';
import { PreAuthChallengeService } from './pre-auth-challenge.service';
import {
  InvalidRecoveryCodeException,
  InvalidTwoFactorTokenException,
  TwoFactorService,
} from './two-factor/two-factor.service';

const currentUserInclude = {
  accessScopes: {
    select: {
      managementId: true,
      serviceCode: true,
    },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.UserInclude;

type CurrentUserSource = Pick<
  User,
  | 'id'
  | 'username'
  | 'role'
  | 'isActive'
  | 'mustChangePassword'
  | 'responsiblePersonId'
> & {
  accessScopes?: Array<{
    managementId: string | null;
    serviceCode: string | null;
  }>;
};

const INVALID_CREDENTIALS_MESSAGE = 'Невірний логін або пароль.';
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 20;

type RequestContext = {
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
};

type LoginResult = {
  requiresPreAuth: true;
  stage: PreAuthChallengeStage;
  preAuthToken: string;
  user: Pick<User, 'id' | 'username' | 'role'>;
};

type RateLimitBucket = {
  attempts: number;
  resetAt: number;
};

@Injectable()
export class AuthService {
  private readonly rateLimitBuckets = new Map<string, RateLimitBucket>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly preAuthChallenges: PreAuthChallengeService,
    private readonly twoFactor: TwoFactorService,
  ) {}

  normalizeUsername(username: string): string {
    return username.trim().toLowerCase();
  }

  async hashPassword(password: string): Promise<string> {
    this.assertValidPassword(password);
    return argon2.hash(password, { type: argon2.argon2id });
  }

  async login(
    username: string,
    password: string,
    context: RequestContext,
  ): Promise<LoginResult> {
    const normalizedUsername = this.normalizeUsername(username);
    this.assertRateLimit(context.ipAddress, normalizedUsername);
    this.assertValidPassword(password);

    const user = await this.prisma.user.findUnique({
      where: { username: normalizedUsername },
    });

    if (!user) {
      await this.recordSecurityEvent(SecurityEventType.LOGIN_FAILURE, {
        context,
        success: false,
        metadata: { username: normalizedUsername, reason: 'INVALID_CREDENTIALS' },
      });
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    if (!user.isActive || this.isLocked(user)) {
      await this.recordSecurityEvent(SecurityEventType.LOGIN_FAILURE, {
        context,
        targetUserId: user.id,
        success: false,
        metadata: {
          username: normalizedUsername,
          reason: user.isActive ? 'LOCKED' : 'INACTIVE',
        },
      });
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    const passwordMatches = await argon2.verify(user.passwordHash, password);

    if (!passwordMatches) {
      await this.handleFailedPassword(user, context);
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    const now = new Date();
    const stage = user.mustChangePassword
      ? PreAuthChallengeStage.CHANGE_PASSWORD
      : user.twoFactorEnabled
        ? PreAuthChallengeStage.VERIFY_2FA
        : PreAuthChallengeStage.ENROLL_2FA;

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: now,
        },
      }),
      this.prisma.securityEvent.create({
        data: {
          type: SecurityEventType.LOGIN_SUCCESS,
          actorUserId: user.id,
          targetUserId: user.id,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          requestId: context.requestId,
          success: true,
        },
      }),
    ]);
    const challenge = await this.preAuthChallenges.create(user.id, stage);

    return {
      requiresPreAuth: true,
      stage,
      preAuthToken: challenge.token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    };
  }

  async authenticateSession(token: string): Promise<{
    user: CurrentUser;
    session: UserSession;
  } | null> {
    const session = await this.prisma.userSession.findUnique({
      where: { tokenHash: this.hashSessionToken(token) },
      include: { user: { include: currentUserInclude } },
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      return null;
    }

    if (!session.user.isActive) {
      return null;
    }

    await this.prisma.userSession.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    });

    return {
      session,
      user: this.toCurrentUser(session.user),
    };
  }

  async changePasswordPreAuth(
    preAuthToken: string,
    newPassword: string,
  ): Promise<{
    requiresPreAuth: true;
    stage: PreAuthChallengeStage;
    preAuthToken: string;
  }> {
    const challenge = await this.preAuthChallenges.validate(
      preAuthToken,
      PreAuthChallengeStage.CHANGE_PASSWORD,
    );
    const user = await this.prisma.user.findUnique({
      where: { id: challenge.userId },
      select: {
        id: true,
        isActive: true,
        mustChangePassword: true,
        twoFactorEnabled: true,
      },
    });

    if (!user?.isActive || !user.mustChangePassword) {
      throw new UnauthorizedException();
    }

    const passwordHash = await this.hashPassword(newPassword);
    const nextStage = user.twoFactorEnabled
      ? PreAuthChallengeStage.VERIFY_2FA
      : PreAuthChallengeStage.ENROLL_2FA;
    const now = new Date();

    const nextChallenge = await this.prisma.$transaction(
      async (transaction) => {
        const updated = await transaction.user.updateMany({
          where: {
            id: user.id,
            isActive: true,
            mustChangePassword: true,
          },
          data: {
            passwordHash,
            mustChangePassword: false,
            passwordChangedAt: now,
            failedLoginAttempts: 0,
            lockedUntil: null,
          },
        });

        if (updated.count !== 1) throw new UnauthorizedException();
        return this.preAuthChallenges.advance(
          challenge.id,
          nextStage,
          transaction,
        );
      },
    );

    return {
      requiresPreAuth: true,
      stage: nextStage,
      preAuthToken: nextChallenge.token,
    };
  }

  async beginTwoFactorEnrollment(preAuthToken: string): Promise<{
    otpauthUrl: string;
    manualKey: string;
  }> {
    const challenge = await this.preAuthChallenges.validate(
      preAuthToken,
      PreAuthChallengeStage.ENROLL_2FA,
    );
    await this.assertActivePreAuthUser(challenge.userId);
    return this.twoFactor.beginEnrollment(challenge.userId);
  }

  async confirmTwoFactorEnrollment(
    preAuthToken: string,
    token: string,
    context: RequestContext,
  ): Promise<{
    authenticated: true;
    recoveryCodes: string[];
    user: Pick<User, 'id' | 'username' | 'role'>;
    session: { token: string; expiresAt: Date };
  }> {
    const challenge = await this.preAuthChallenges.validate(
      preAuthToken,
      PreAuthChallengeStage.ENROLL_2FA,
    );
    const user = await this.assertActivePreAuthUser(challenge.userId);

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const confirmation = await this.twoFactor.confirmEnrollment(
          user.id,
          token,
          transaction,
        );
        await this.preAuthChallenges.consume(challenge.id, transaction);
        const session = await this.createAuthenticatedSession(
          user.id,
          context,
          transaction,
        );
        await transaction.securityEvent.create({
          data: this.twoFactorEventData(
            SecurityEventType.TWO_FACTOR_ENABLED,
            user,
            context,
            true,
            'TOTP',
          ),
        });

        return {
          authenticated: true,
          recoveryCodes: confirmation.recoveryCodes,
          user: {
            id: user.id,
            username: user.username,
            role: user.role,
          },
          session,
        };
      });
    } catch (error) {
      if (error instanceof InvalidTwoFactorTokenException) {
        await this.preAuthChallenges.recordFailure(challenge.id);
        await this.recordTwoFactorFailure(user, context, 'TOTP');
        throw new UnauthorizedException('Невірні дані підтвердження.');
      }
      throw error;
    }
  }

  async verifyTwoFactor(
    preAuthToken: string,
    token: string,
    context: RequestContext,
  ): Promise<{
    authenticated: true;
    user: Pick<User, 'id' | 'username' | 'role'>;
    session: { token: string; expiresAt: Date };
  }> {
    const challenge = await this.preAuthChallenges.validate(
      preAuthToken,
      PreAuthChallengeStage.VERIFY_2FA,
    );
    const user = await this.assertActivePreAuthUser(challenge.userId);

    try {
      await this.twoFactor.verifyEnabledToken(user.id, token);
    } catch (error) {
      if (error instanceof InvalidTwoFactorTokenException) {
        await this.preAuthChallenges.recordFailure(challenge.id);
        await this.recordTwoFactorFailure(user, context, 'TOTP');
        throw new UnauthorizedException('Невірні дані підтвердження.');
      }
      throw error;
    }

    return this.prisma.$transaction(async (transaction) => {
      await this.preAuthChallenges.consume(challenge.id, transaction);
      const session = await this.createAuthenticatedSession(
        user.id,
        context,
        transaction,
      );
      await transaction.securityEvent.create({
        data: this.twoFactorEventData(
          SecurityEventType.TWO_FACTOR_VERIFIED,
          user,
          context,
          true,
          'TOTP',
        ),
      });

      return {
        authenticated: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
        },
        session,
      };
    });
  }

  async verifyTwoFactorRecoveryCode(
    preAuthToken: string,
    recoveryCode: string,
    context: RequestContext,
  ): Promise<{
    authenticated: true;
    user: Pick<User, 'id' | 'username' | 'role'>;
    session: { token: string; expiresAt: Date };
  }> {
    const challenge = await this.preAuthChallenges.validate(
      preAuthToken,
      PreAuthChallengeStage.VERIFY_2FA,
    );
    const user = await this.assertActivePreAuthUser(challenge.userId);

    try {
      return await this.prisma.$transaction(async (transaction) => {
        await this.twoFactor.consumeRecoveryCode(
          user.id,
          recoveryCode,
          transaction,
        );
        await this.preAuthChallenges.consume(challenge.id, transaction);
        const session = await this.createAuthenticatedSession(
          user.id,
          context,
          transaction,
        );
        await transaction.securityEvent.create({
          data: this.twoFactorEventData(
            SecurityEventType.TWO_FACTOR_RECOVERY_CODE_USED,
            user,
            context,
            true,
            'RECOVERY_CODE',
          ),
        });

        return {
          authenticated: true,
          user: {
            id: user.id,
            username: user.username,
            role: user.role,
          },
          session,
        };
      });
    } catch (error) {
      if (error instanceof InvalidRecoveryCodeException) {
        await this.preAuthChallenges.recordFailure(challenge.id);
        await this.recordTwoFactorFailure(user, context, 'RECOVERY_CODE');
        throw new UnauthorizedException('Невірні дані підтвердження.');
      }
      throw error;
    }
  }

  async logout(
    sessionId: string | undefined,
    user: CurrentUser | undefined,
    context: RequestContext,
  ): Promise<void> {
    if (sessionId) {
      await this.prisma.userSession.updateMany({
        where: { id: sessionId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await this.recordSecurityEvent(SecurityEventType.LOGOUT, {
      actorUserId: user?.id,
      targetUserId: user?.id,
      context,
      success: true,
    });
  }

  async logoutAll(user: CurrentUser, context: RequestContext): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.recordSecurityEvent(SecurityEventType.SESSIONS_REVOKED, {
      actorUserId: user.id,
      targetUserId: user.id,
      context,
      success: true,
    });
  }

  async changePassword(
    user: CurrentUser,
    currentSessionId: string | undefined,
    oldPassword: string,
    newPassword: string,
    context: RequestContext,
  ): Promise<CurrentUser> {
    this.assertValidPassword(oldPassword);
    this.assertValidPassword(newPassword);

    const fullUser = await this.prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!fullUser || !fullUser.isActive) {
      throw new UnauthorizedException();
    }

    const oldPasswordMatches = await argon2.verify(
      fullUser.passwordHash,
      oldPassword,
    );

    if (!oldPasswordMatches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    const passwordHash = await this.hashPassword(newPassword);
    const now = new Date();

    const [updatedUser] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          mustChangePassword: false,
          passwordChangedAt: now,
        },
        include: currentUserInclude,
      }),
      this.prisma.userSession.updateMany({
        where: {
          userId: user.id,
          revokedAt: null,
          id: currentSessionId ? { not: currentSessionId } : undefined,
        },
        data: { revokedAt: now },
      }),
      this.prisma.securityEvent.create({
        data: {
          type: SecurityEventType.PASSWORD_CHANGED,
          actorUserId: user.id,
          targetUserId: user.id,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          requestId: context.requestId,
          success: true,
        },
      }),
    ]);

    return this.toCurrentUser(updatedUser);
  }

  hashSessionToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  createSessionToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private async assertActivePreAuthUser(
    userId: string,
  ): Promise<Pick<User, 'id' | 'username' | 'role'>> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        role: true,
        isActive: true,
      },
    });
    if (!user?.isActive) throw new UnauthorizedException();
    return user;
  }

  private async createAuthenticatedSession(
    userId: string,
    context: RequestContext,
    transaction: Prisma.TransactionClient,
  ): Promise<{ token: string; expiresAt: Date }> {
    const token = this.createSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await transaction.userSession.create({
      data: {
        userId,
        tokenHash: this.hashSessionToken(token),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        expiresAt,
      },
    });

    return { token, expiresAt };
  }

  toCurrentUser(user: CurrentUserSource): CurrentUser {
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
      responsiblePersonId: user.responsiblePersonId,
      accessScopes: (user.accessScopes ?? []).map((scope) => ({
        managementId: scope.managementId,
        serviceCode: scope.serviceCode,
      })),
    };
  }

  private assertValidPassword(password: string): void {
    if (
      password.length < PASSWORD_MIN_LENGTH ||
      password.length > PASSWORD_MAX_LENGTH
    ) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }
  }

  private assertRateLimit(ipAddress: string | undefined, username: string): void {
    const now = Date.now();
    const key = `${ipAddress ?? 'unknown'}:${username}`;
    const current = this.rateLimitBuckets.get(key);

    if (!current || current.resetAt <= now) {
      this.rateLimitBuckets.set(key, {
        attempts: 1,
        resetAt: now + RATE_LIMIT_WINDOW_MS,
      });
      return;
    }

    current.attempts += 1;

    if (current.attempts > RATE_LIMIT_MAX_ATTEMPTS) {
      throw new HttpException(
        'Забагато спроб входу. Спробуйте пізніше.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private isLocked(user: User): boolean {
    return Boolean(user.lockedUntil && user.lockedUntil > new Date());
  }

  private async handleFailedPassword(
    user: User,
    context: RequestContext,
  ): Promise<void> {
    const failedLoginAttempts = user.failedLoginAttempts + 1;
    const lockedUntil =
      failedLoginAttempts >= MAX_FAILED_LOGIN_ATTEMPTS
        ? new Date(Date.now() + ACCOUNT_LOCK_MS)
        : null;

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts, lockedUntil },
      }),
      this.prisma.securityEvent.create({
        data: {
          type: SecurityEventType.LOGIN_FAILURE,
          actorUserId: user.id,
          targetUserId: user.id,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          requestId: context.requestId,
          metadata: { reason: 'INVALID_CREDENTIALS' },
          success: false,
        },
      }),
    ]);
  }

  private async recordSecurityEvent(
    type: SecurityEventType,
    input: {
      actorUserId?: string;
      targetUserId?: string;
      context: RequestContext;
      metadata?: Prisma.InputJsonValue;
      success: boolean;
    },
  ): Promise<void> {
    await this.prisma.securityEvent.create({
      data: {
        type,
        actorUserId: input.actorUserId,
        targetUserId: input.targetUserId,
        ipAddress: input.context.ipAddress,
        userAgent: input.context.userAgent,
        requestId: input.context.requestId,
        metadata: input.metadata,
        success: input.success,
      },
    });
  }

  private async recordTwoFactorFailure(
    user: Pick<User, 'id' | 'role'>,
    context: RequestContext,
    method: 'TOTP' | 'RECOVERY_CODE',
  ): Promise<void> {
    await this.recordSecurityEvent(SecurityEventType.TWO_FACTOR_FAILED, {
      actorUserId: user.id,
      targetUserId: user.id,
      context,
      metadata: { role: user.role, method },
      success: false,
    });
  }

  private twoFactorEventData(
    type: SecurityEventType,
    user: Pick<User, 'id' | 'role'>,
    context: RequestContext,
    success: boolean,
    method: 'TOTP' | 'RECOVERY_CODE',
  ): Prisma.SecurityEventUncheckedCreateInput {
    return {
      type,
      actorUserId: user.id,
      targetUserId: user.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      requestId: context.requestId,
      metadata: { role: user.role, method },
      success,
    };
  }
}

export { INVALID_CREDENTIALS_MESSAGE };
