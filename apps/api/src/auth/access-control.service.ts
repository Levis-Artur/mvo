import { ForbiddenException, Injectable } from '@nestjs/common';
import { SecurityEventType, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUser } from './auth.types';

type AuditInput = {
  user?: CurrentUser;
  path?: string;
  method?: string;
  reason: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
};

@Injectable()
export class AccessControlService {
  constructor(private readonly prisma: PrismaService) {}

  async deny(input: AuditInput): Promise<never> {
    await this.recordAccessDenied(input);
    throw new ForbiddenException('Доступ заборонено.');
  }

  async recordAccessDenied(input: AuditInput): Promise<void> {
    await this.prisma.securityEvent.create({
      data: {
        type: SecurityEventType.ACCESS_DENIED,
        actorUserId: input.user?.id,
        targetUserId: input.user?.id,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        requestId: input.requestId,
        metadata: {
          path: input.path,
          method: input.method,
          reason: input.reason,
        },
        success: false,
      },
    });
  }

  isReadMethod(method: string): boolean {
    return ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
  }

  isPrivileged(user: CurrentUser): boolean {
    return user.role === UserRole.OWNER || user.role === UserRole.DPP_ADMIN;
  }

  isGlobalReader(user: CurrentUser): boolean {
    return user.role !== UserRole.MVO;
  }

  ownResponsiblePersonId(user: CurrentUser): string | undefined {
    return user.role === UserRole.MVO
      ? (user.responsiblePersonId ?? undefined)
      : undefined;
  }

  async assertMvoResponsiblePersonAccess(
    user: CurrentUser,
    responsiblePersonId: string,
    audit: Omit<AuditInput, 'user' | 'reason'>,
  ): Promise<void> {
    if (user.role !== UserRole.MVO) return;

    if (user.responsiblePersonId !== responsiblePersonId) {
      await this.deny({
        ...audit,
        user,
        reason: 'MVO_RESPONSIBLE_PERSON_SCOPE',
      });
    }
  }
}
