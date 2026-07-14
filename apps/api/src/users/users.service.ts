import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SecurityEventType, User, UserRole } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { AuthService } from '../auth/auth.service';
import type { CurrentUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

type RequestContext = {
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
};

const userSelect = {
  id: true,
  username: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
  failedLoginAttempts: true,
  lockedUntil: true,
  lastLoginAt: true,
  passwordChangedAt: true,
  responsiblePersonId: true,
  createdAt: true,
  updatedAt: true,
  createdById: true,
  responsiblePerson: {
    select: {
      id: true,
      lastName: true,
      firstName: true,
      middleName: true,
      personnelNumber: true,
      isActive: true,
    },
  },
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async findAll(actor: CurrentUser) {
    this.assertCanAccessUsers(actor);

    return this.prisma.user.findMany({
      where: actor.role === UserRole.DPP_ADMIN ? { role: UserRole.MVO } : {},
      orderBy: { username: 'asc' },
      select: userSelect,
    });
  }

  async findOne(actor: CurrentUser, id: string) {
    this.assertCanAccessUsers(actor);

    const user = await this.prisma.user.findFirst({
      where: {
        id,
        ...(actor.role === UserRole.DPP_ADMIN ? { role: UserRole.MVO } : {}),
      },
      select: userSelect,
    });

    if (!user) {
      throw new NotFoundException('Користувача не знайдено');
    }

    return user;
  }

  async create(actor: CurrentUser, dto: CreateUserDto, context: RequestContext) {
    this.assertCanAccessUsers(actor);

    const role = this.resolveCreateRole(actor, dto.role);
    const username = this.authService.normalizeUsername(dto.username);

    if (role === UserRole.OWNER) {
      throw new BadRequestException('Неможливо створити другого OWNER');
    }

    if (role === UserRole.MVO && !dto.responsiblePersonId) {
      throw new BadRequestException('Для MVO потрібно вказати МВО');
    }

    if (dto.responsiblePersonId) {
      await this.ensureResponsiblePersonCanBeLinked(dto.responsiblePersonId);
    }

    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await this.authService.hashPassword(temporaryPassword);

    try {
      const user = await this.prisma.user.create({
        data: {
          username,
          passwordHash,
          role,
          responsiblePersonId: dto.responsiblePersonId,
          mustChangePassword: true,
          createdById: actor.id,
        },
        select: userSelect,
      });

      await this.recordEvent(SecurityEventType.USER_CREATED, actor, user.id, context);

      return { user, temporaryPassword };
    } catch (error) {
      this.handleUniqueError(error);
    }
  }

  async update(
    actor: CurrentUser,
    id: string,
    dto: UpdateUserDto,
    context: RequestContext,
  ) {
    const existing = await this.getEditableTarget(actor, id);

    if (existing.role === UserRole.OWNER && dto.role && dto.role !== UserRole.OWNER) {
      throw new ForbiddenException('OWNER не можна позбавити ролі OWNER');
    }

    if (actor.role === UserRole.DPP_ADMIN && dto.role && dto.role !== UserRole.MVO) {
      throw new ForbiddenException('DPP_ADMIN може керувати лише MVO');
    }

    const role = dto.role ?? existing.role;
    const responsiblePersonId =
      dto.responsiblePersonId === undefined
        ? existing.responsiblePersonId
        : dto.responsiblePersonId;

    if (role === UserRole.MVO && !responsiblePersonId) {
      throw new BadRequestException('Для MVO потрібно вказати МВО');
    }

    if (responsiblePersonId && responsiblePersonId !== existing.responsiblePersonId) {
      await this.ensureResponsiblePersonCanBeLinked(responsiblePersonId);
    }

    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: {
          username: dto.username
            ? this.authService.normalizeUsername(dto.username)
            : undefined,
          role,
          responsiblePersonId,
          mustChangePassword: dto.mustChangePassword,
        },
        select: userSelect,
      });

      await this.recordEvent(
        existing.role !== role
          ? SecurityEventType.ROLE_CHANGED
          : SecurityEventType.USER_UPDATED,
        actor,
        user.id,
        context,
      );

      return user;
    } catch (error) {
      this.handleUniqueError(error);
    }
  }

  async resetPassword(actor: CurrentUser, id: string, context: RequestContext) {
    await this.getEditableTarget(actor, id);
    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await this.authService.hashPassword(temporaryPassword);
    const now = new Date();

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        mustChangePassword: true,
        passwordChangedAt: now,
      },
      select: userSelect,
    });

    await this.prisma.userSession.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: now },
    });
    await this.recordEvent(SecurityEventType.PASSWORD_RESET, actor, id, context);

    return { user, temporaryPassword };
  }

  async block(actor: CurrentUser, id: string, context: RequestContext) {
    await this.getEditableTarget(actor, id);
    const user = await this.prisma.user.update({
      where: { id },
      data: { lockedUntil: new Date('9999-12-31T23:59:59.000Z') },
      select: userSelect,
    });
    await this.recordEvent(SecurityEventType.USER_BLOCKED, actor, id, context);
    return user;
  }

  async unblock(actor: CurrentUser, id: string, context: RequestContext) {
    await this.getEditableTarget(actor, id);
    const user = await this.prisma.user.update({
      where: { id },
      data: { lockedUntil: null, failedLoginAttempts: 0 },
      select: userSelect,
    });
    await this.recordEvent(SecurityEventType.USER_UNBLOCKED, actor, id, context);
    return user;
  }

  async revokeSessions(actor: CurrentUser, id: string, context: RequestContext) {
    await this.getEditableTarget(actor, id);
    await this.prisma.userSession.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.recordEvent(SecurityEventType.SESSIONS_REVOKED, actor, id, context);
    return { status: 'ok' };
  }

  async deactivate(actor: CurrentUser, id: string, context: RequestContext) {
    const target = await this.getEditableTarget(actor, id);

    if (target.id === actor.id && target.role === UserRole.OWNER) {
      throw new ForbiddenException('OWNER не може деактивувати себе');
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: userSelect,
    });
    await this.prisma.userSession.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.recordEvent(SecurityEventType.USER_DEACTIVATED, actor, id, context);
    return user;
  }

  async activate(actor: CurrentUser, id: string, context: RequestContext) {
    await this.getEditableTarget(actor, id);
    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive: true },
      select: userSelect,
    });
    await this.recordEvent(SecurityEventType.USER_ACTIVATED, actor, id, context);
    return user;
  }

  private assertCanAccessUsers(actor: CurrentUser): void {
    if (actor.role !== UserRole.OWNER && actor.role !== UserRole.DPP_ADMIN) {
      throw new ForbiddenException('Доступ заборонено.');
    }
  }

  private resolveCreateRole(actor: CurrentUser, requestedRole?: UserRole): UserRole {
    if (actor.role === UserRole.DPP_ADMIN) {
      if (requestedRole && requestedRole !== UserRole.MVO) {
        throw new ForbiddenException('DPP_ADMIN може створювати лише MVO');
      }
      return UserRole.MVO;
    }

    return requestedRole ?? UserRole.MVO;
  }

  private async getEditableTarget(actor: CurrentUser, id: string): Promise<User> {
    this.assertCanAccessUsers(actor);
    const target = await this.prisma.user.findFirst({
      where: {
        id,
        ...(actor.role === UserRole.DPP_ADMIN ? { role: UserRole.MVO } : {}),
      },
    });

    if (!target) {
      throw new NotFoundException('Користувача не знайдено');
    }

    return target;
  }

  private async ensureResponsiblePersonCanBeLinked(
    responsiblePersonId: string,
  ): Promise<void> {
    const responsiblePerson = await this.prisma.responsiblePerson.findUnique({
      where: { id: responsiblePersonId },
      select: { id: true, isActive: true, user: { select: { id: true } } },
    });

    if (!responsiblePerson || !responsiblePerson.isActive) {
      throw new BadRequestException('МВО неактивний або не існує');
    }

    if (responsiblePerson.user) {
      throw new ConflictException('Для цього МВО вже існує користувач');
    }
  }

  private generateTemporaryPassword(): string {
    return randomBytes(24).toString('base64url');
  }

  private async recordEvent(
    type: SecurityEventType,
    actor: CurrentUser,
    targetUserId: string,
    context: RequestContext,
  ): Promise<void> {
    await this.prisma.securityEvent.create({
      data: {
        type,
        actorUserId: actor.id,
        targetUserId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestId: context.requestId,
        success: true,
      },
    });
  }

  private handleUniqueError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Username або МВО вже використовується');
    }

    throw error;
  }
}
