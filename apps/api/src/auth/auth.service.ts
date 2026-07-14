import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
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

const INVALID_CREDENTIALS_MESSAGE = 'Невірний логін або пароль.';
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 20;

type RequestContext = {
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
};

type LoginResult = {
  token: string;
  expiresAt: Date;
  user: CurrentUser;
};

type RateLimitBucket = {
  attempts: number;
  resetAt: number;
};

@Injectable()
export class AuthService {
  private readonly rateLimitBuckets = new Map<string, RateLimitBucket>();

  constructor(private readonly prisma: PrismaService) {}

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
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    const token = this.createSessionToken();

    const [updatedUser] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: now,
        },
      }),
      this.prisma.userSession.create({
        data: {
          userId: user.id,
          tokenHash: this.hashSessionToken(token),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          expiresAt,
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

    return {
      token,
      expiresAt,
      user: this.toCurrentUser(updatedUser),
    };
  }

  async authenticateSession(token: string): Promise<{
    user: CurrentUser;
    session: UserSession;
  } | null> {
    const session = await this.prisma.userSession.findUnique({
      where: { tokenHash: this.hashSessionToken(token) },
      include: { user: true },
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

  toCurrentUser(user: Pick<
    User,
    | 'id'
    | 'username'
    | 'role'
    | 'isActive'
    | 'mustChangePassword'
    | 'responsiblePersonId'
  >): CurrentUser {
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
      responsiblePersonId: user.responsiblePersonId,
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
}

export { INVALID_CREDENTIALS_MESSAGE };
