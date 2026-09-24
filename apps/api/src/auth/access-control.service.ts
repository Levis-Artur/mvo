import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SecurityEventType, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUser } from './auth.types';
import type { ReadAccessMode } from './dto/read-access-query.dto';

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

  // Use only for GET filtering; never replace the authenticated write actor.
  forRead(user: CurrentUser, mode: ReadAccessMode = 'SELF_ONLY'): CurrentUser {
    if (mode === 'SCOPED_READ') {
      if (
        user.role === UserRole.ORG_MANAGER ||
        (user.role === UserRole.MVO && this.accessScopeResponsiblePersonFilters(user).length > 0)
      ) {
        return user;
      }
      throw new ForbiddenException('Менеджерський перегляд потребує областей доступу.');
    }
    if (mode !== 'SELF_ONLY') {
      throw new ForbiddenException('Невідомий режим читання.');
    }
    return user.role === UserRole.MVO ? { ...user, accessScopes: [] } : user;
  }

  isPrivileged(user: CurrentUser): boolean {
    return user.role === UserRole.OWNER;
  }

  isGlobalReader(user: CurrentUser): boolean {
    return (
      user.role === UserRole.OWNER ||
      user.role === UserRole.ACCOUNTANT
    );
  }

  responsiblePersonFilter(
    user: CurrentUser,
  ): Prisma.ResponsiblePersonWhereInput {
    if (this.isGlobalReader(user)) return {};

    if (user.role === UserRole.MVO) {
      const filters = this.accessScopeResponsiblePersonFilters(user);
      if (user.responsiblePersonId) {
        filters.unshift({ id: user.responsiblePersonId });
      }
      return filters.length > 0 ? { OR: filters } : { id: { in: [] } };
    }

    if (user.role !== UserRole.ORG_MANAGER) {
      return { id: { in: [] } };
    }

    const scopedFilters = this.accessScopeResponsiblePersonFilters(user);

    return scopedFilters.length > 0
      ? { OR: scopedFilters }
      : { id: { in: [] } };
  }

  private accessScopeResponsiblePersonFilters(
    user: CurrentUser,
  ): Prisma.ResponsiblePersonWhereInput[] {
    return (user.accessScopes ?? []).flatMap(
      (scope): Prisma.ResponsiblePersonWhereInput[] => {
        const serviceCode = scope.serviceCode?.trim() ?? null;
        if (scope.serviceCode !== null && !serviceCode) return [];
        if (!scope.managementId && !serviceCode) return [];

        if (scope.managementId && serviceCode) {
          return [{ managementId: scope.managementId, service: { code: serviceCode } }];
        }
        if (scope.managementId) return [{ managementId: scope.managementId }];
        return [{ service: { code: serviceCode! } }];
      },
    );
  }

  stockDocumentFilter(user: CurrentUser): Prisma.StockDocumentWhereInput {
    if (this.isGlobalReader(user)) return {};

    const responsiblePerson = this.responsiblePersonFilter(user);
    if (user.role === UserRole.MVO) {
      const scopedFilters = this.accessScopeResponsiblePersonFilters(user);
      return {
        OR: [
          ...(user.responsiblePersonId
            ? [{ sourceResponsiblePersonId: user.responsiblePersonId }]
            : []),
          ...(scopedFilters.length > 0
            ? [
                { sourceResponsiblePerson: { OR: scopedFilters } },
                { destinationResponsiblePerson: { OR: scopedFilters } },
              ]
            : []),
        ],
      };
    }

    if (user.role === UserRole.ORG_MANAGER) {
      return {
        OR: [
          { sourceResponsiblePerson: responsiblePerson },
          { destinationResponsiblePerson: responsiblePerson },
        ],
      };
    }

    return { id: { in: [] } };
  }

  async assertManagerStockDocumentRead(user: CurrentUser, documentId: string) {
    if (user.role !== UserRole.ORG_MANAGER) return;
    const document = await this.prisma.stockDocument.findFirst({
      where: { AND: [{ id: documentId }, this.stockDocumentFilter(user)] },
      select: { id: true },
    });
    if (!document) throw new NotFoundException('Документ руху майна не знайдено');
  }

  async managerCanManageStockDocument(
    user: CurrentUser, documentId: string,
    client: Pick<PrismaService, 'stockDocument'> | Prisma.TransactionClient = this.prisma,
  ): Promise<boolean> {
    if (user.role !== UserRole.ORG_MANAGER && user.role !== UserRole.OWNER) return false;
    const sourceOwnerFilter: Prisma.StockDocumentWhereInput = user.role === UserRole.ORG_MANAGER
      ? { sourceResponsiblePerson: this.responsiblePersonFilter(user) }
      : {};
    return Boolean(await client.stockDocument.findFirst({
      where: { AND: [
        { id: documentId }, this.stockDocumentFilter(user),
        sourceOwnerFilter,
      ] },
      select: { id: true },
    }));
  }

  async operationResponsiblePersonId(
    actor: CurrentUser, targetResponsiblePersonId?: string,
    client: Pick<PrismaService, 'responsiblePerson'> | Prisma.TransactionClient = this.prisma,
  ): Promise<string> {
    if (actor.role === UserRole.MVO && actor.responsiblePersonId) {
      if (targetResponsiblePersonId !== undefined) {
        throw new ForbiddenException('МВО може виконувати операції лише від свого імені');
      }
      return actor.responsiblePersonId;
    }
    if ((actor.role !== UserRole.ORG_MANAGER && actor.role !== UserRole.OWNER) || !targetResponsiblePersonId) {
      throw new ForbiddenException('Для операції виберіть МВО');
    }
    const authorizationWhere: Prisma.ResponsiblePersonWhereInput = actor.role === UserRole.ORG_MANAGER
      ? this.responsiblePersonFilter(actor)
      : {};
    const person = await client.responsiblePerson.findFirst({
      where: { AND: [{ id: targetResponsiblePersonId, isActive: true }, authorizationWhere] },
      select: { id: true },
    });
    if (!person) throw new NotFoundException(actor.role === UserRole.ORG_MANAGER
      ? 'Картку МВО не знайдено в області доступу'
      : 'Активну картку МВО не знайдено');
    return person.id;
  }

  stockTransactionFilter(user: CurrentUser): Prisma.StockTransactionWhereInput {
    if (this.isGlobalReader(user)) return {};

    const responsiblePerson = this.responsiblePersonFilter(user);
    if (user.role === UserRole.MVO) {
      const scopedFilters = this.accessScopeResponsiblePersonFilters(user);
      return {
        OR: [
          ...(user.responsiblePersonId
            ? [{ responsiblePersonId: user.responsiblePersonId }]
            : []),
          ...(scopedFilters.length > 0
            ? [
                { responsiblePerson: { OR: scopedFilters } },
                { accountingOwnerResponsiblePerson: { OR: scopedFilters } },
                { sourceCustodianResponsiblePerson: { OR: scopedFilters } },
                { destinationCustodianResponsiblePerson: { OR: scopedFilters } },
                {
                  document: {
                    OR: [
                      { sourceResponsiblePerson: { OR: scopedFilters } },
                      { destinationResponsiblePerson: { OR: scopedFilters } },
                    ],
                  },
                },
              ]
            : []),
        ],
      };
    }

    if (user.role === UserRole.ORG_MANAGER) {
      return {
        OR: [
          { responsiblePerson },
          { accountingOwnerResponsiblePerson: responsiblePerson },
          { sourceCustodianResponsiblePerson: responsiblePerson },
          { destinationCustodianResponsiblePerson: responsiblePerson },
          {
            document: {
              OR: [
                { sourceResponsiblePerson: responsiblePerson },
                { destinationResponsiblePerson: responsiblePerson },
              ],
            },
          },
        ],
      };
    }

    return { id: { in: [] } };
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
