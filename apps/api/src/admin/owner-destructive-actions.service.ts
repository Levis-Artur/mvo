import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ImportStatus,
  Prisma,
  SecurityEventType,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUser } from '../auth/auth.types';

export type AdminEntityType =
  | 'imports'
  | 'responsible-persons'
  | 'managements'
  | 'services'
  | 'units'
  | 'users'
  | 'inventory-items';

type RequestAuditContext = {
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
};

type Dependency = {
  type: string;
  count: number;
  action: 'BLOCK' | 'DELETE' | 'DETACH' | 'RETAIN';
};

export type DeletionPreview = {
  entityType: AdminEntityType;
  entityId: string;
  displayName: string;
  canDelete: boolean;
  blockers: string[];
  dependencies: Dependency[];
};

@Injectable()
export class OwnerDestructiveActionsService {
  constructor(private readonly prisma: PrismaService) {}

  async deletionPreview(
    actor: CurrentUser,
    entityType: string,
    id: string,
  ): Promise<DeletionPreview> {
    this.assertEnabledOwner(actor);
    const type = this.parseEntityType(entityType);
    return this.buildPreview(type, id, actor.id);
  }

  async delete(
    actor: CurrentUser,
    entityType: string,
    id: string,
    options: { force?: boolean; confirmation: string },
    context: RequestAuditContext,
  ) {
    this.assertEnabledOwner(actor);
    const type = this.parseEntityType(entityType);
    if (options.confirmation !== `DELETE ${type}:${id}`) {
      throw new BadRequestException('Некоректне підтвердження видалення.');
    }

    const preview = await this.buildPreview(type, id, actor.id);
    if (!preview.canDelete && !options.force) {
      throw new ConflictException({
        message: 'Сутність має залежності. Використайте deletion preview.',
        details: preview,
      });
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const deletedDependencies = await this.deleteEntity(
          tx,
          type,
          id,
          actor,
          Boolean(options.force),
          preview,
        );
        await this.audit(tx, actor, type, id, preview.displayName, {
          action: 'DELETE',
          deletedDependencies,
          success: true,
          ...context,
        });
        return { deleted: true, entityType: type, entityId: id };
      });
      return result;
    } catch (error) {
      await this.audit(this.prisma, actor, type, id, preview.displayName, {
        action: 'DELETE',
        deletedDependencies: 0,
        success: false,
        reason: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
        ...context,
      });
      throw error;
    }
  }

  async rollbackImport(
    actor: CurrentUser,
    id: string,
    context: RequestAuditContext,
  ) {
    this.assertEnabledOwner(actor);
    const batch = await this.prisma.importBatch.findUnique({
      where: { id },
      select: { id: true, originalFilename: true, status: true },
    });
    if (!batch) throw new NotFoundException('Імпорт не знайдено.');
    const rollbackStatuses: ImportStatus[] = [
        ImportStatus.COMPLETED,
        ImportStatus.PARTIALLY_COMPLETED,
        ImportStatus.FAILED,
      ];
    if (!rollbackStatuses.includes(batch.status)) {
      throw new ConflictException('Цей імпорт не є проведеним.');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const transactions = await tx.stockTransaction.findMany({
          where: { importBatchId: id },
          orderBy: { createdAt: 'desc' },
        });
        const grouped = new Map<string, Prisma.Decimal>();
        for (const transaction of transactions) {
          const key = `${transaction.responsiblePersonId}:${transaction.inventoryItemId}`;
          grouped.set(
            key,
            (grouped.get(key) ?? new Prisma.Decimal(0)).add(
              transaction.quantity,
            ),
          );
        }

        for (const [key, quantity] of grouped) {
          const [responsiblePersonId, inventoryItemId] = key.split(':');
          const balance = await tx.stockBalance.findUnique({
            where: {
              responsiblePersonId_inventoryItemId: {
                responsiblePersonId,
                inventoryItemId,
              },
            },
          });
          if (!balance || balance.quantity.lessThan(quantity)) {
            throw new ConflictException(
              'Rollback призведе до від’ємного залишку або залишок відсутній.',
            );
          }
          await tx.stockBalance.update({
            where: { id: balance.id },
            data: { quantity: { decrement: quantity } },
          });
        }

        await tx.stockTransaction.deleteMany({ where: { importBatchId: id } });
        const updated = await tx.importBatch.update({
          where: { id },
          data: {
            status: ImportStatus.ROLLED_BACK,
            importedRows: 0,
            completedAt: null,
          },
        });
        await this.audit(tx, actor, 'imports', id, batch.originalFilename, {
          action: 'ROLLBACK',
          deletedDependencies: transactions.length,
          success: true,
          retainedDependency:
            'InventoryItem не має createdByImportId; автоматичне видалення номенклатури пропущено.',
          ...context,
        });
        return updated;
      });
    } catch (error) {
      await this.audit(
        this.prisma,
        actor,
        'imports',
        id,
        batch.originalFilename,
        {
          action: 'ROLLBACK',
          deletedDependencies: 0,
          success: false,
          reason: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
          ...context,
        },
      );
      throw error;
    }
  }

  async resetTestData(
    actor: CurrentUser,
    context: RequestAuditContext,
  ): Promise<{ reset: true }> {
    this.assertEnabledOwner(actor);
    return this.prisma.$transaction(async (tx) => {
      await tx.stockTransaction.deleteMany({});
      await tx.stockBalance.deleteMany({});
      await tx.importRow.deleteMany({});
      await tx.importBatch.deleteMany({});
      await tx.userSession.deleteMany({ where: { userId: { not: actor.id } } });
      await tx.user.deleteMany({ where: { id: { not: actor.id } } });
      await tx.responsiblePerson.deleteMany({});
      await tx.inventoryItem.deleteMany({});
      await tx.unit.deleteMany({});
      await tx.service.deleteMany({});
      await tx.management.deleteMany({});
      await this.audit(tx, actor, 'users', actor.id, actor.username, {
        action: 'TEST_DATA_RESET',
        deletedDependencies: 0,
        success: true,
        ...context,
      });
      return { reset: true as const };
    });
  }

  private assertEnabledOwner(actor: CurrentUser | undefined): void {
    if (!actor || actor.role !== UserRole.OWNER) {
      throw new ForbiddenException('Доступно лише OWNER.');
    }
    if (
      (process.env.OWNER_DESTRUCTIVE_ACTIONS_ENABLED ?? 'false').toLowerCase() !==
      'true'
    ) {
      throw new ForbiddenException(
        'Режим destructive administration вимкнений.',
      );
    }
  }

  private parseEntityType(value: string): AdminEntityType {
    const allowed: AdminEntityType[] = [
      'imports',
      'responsible-persons',
      'managements',
      'services',
      'units',
      'users',
      'inventory-items',
    ];
    if (!allowed.includes(value as AdminEntityType)) {
      throw new BadRequestException('Безпечний сценарій видалення не визначений.');
    }
    return value as AdminEntityType;
  }

  private async buildPreview(
    type: AdminEntityType,
    id: string,
    actorId: string,
  ): Promise<DeletionPreview> {
    switch (type) {
      case 'users':
        return this.userPreview(id, actorId);
      case 'imports':
        return this.importPreview(id);
      case 'responsible-persons':
        return this.personPreview(id);
      case 'inventory-items':
        return this.inventoryPreview(id);
      case 'units':
        return this.unitPreview(id);
      case 'services':
        return this.servicePreview(id);
      case 'managements':
        return this.managementPreview(id);
    }
  }

  private preview(
    type: AdminEntityType,
    id: string,
    displayName: string,
    dependencies: Dependency[],
    blockers: string[] = [],
  ): DeletionPreview {
    return {
      entityType: type,
      entityId: id,
      displayName,
      canDelete:
        blockers.length === 0 &&
        dependencies.every(
          (dependency) =>
            dependency.action !== 'BLOCK' || dependency.count === 0,
        ),
      blockers,
      dependencies,
    };
  }

  private async userPreview(id: string, actorId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { _count: { select: { sessions: true } } },
    });
    if (!user) throw new NotFoundException('Користувача не знайдено.');
    const activeOwners = await this.prisma.user.count({
      where: { role: UserRole.OWNER, isActive: true },
    });
    const blockers = [
      ...(id === actorId ? ['OWNER не може видалити самого себе.'] : []),
      ...(user.role === UserRole.OWNER && user.isActive && activeOwners <= 1
        ? ['Не можна видалити останнього активного OWNER.']
        : []),
    ];
    return this.preview(
      'users',
      id,
      user.username,
      [{ type: 'sessions', count: user._count.sessions, action: 'DELETE' }],
      blockers,
    );
  }

  private async importPreview(id: string) {
    const batch = await this.prisma.importBatch.findUnique({
      where: { id },
      include: { _count: { select: { rows: true, transactions: true } } },
    });
    if (!batch) throw new NotFoundException('Імпорт не знайдено.');
    const directlyDeletableStatuses: ImportStatus[] = [
      ImportStatus.UPLOADED,
      ImportStatus.VALIDATED,
      ImportStatus.CANCELLED,
      ImportStatus.FAILED,
      ImportStatus.ROLLED_BACK,
    ];
    const blockers = [
      ...(!directlyDeletableStatuses.includes(batch.status)
        ? ['Спочатку виконайте rollback проведеного імпорту.']
        : []),
      ...(batch._count.transactions > 0
        ? ['Імпорт має проведені складські операції.']
        : []),
    ];
    return this.preview(
      'imports',
      id,
      batch.originalFilename,
      [
        { type: 'importRows', count: batch._count.rows, action: 'DELETE' },
        {
          type: 'stockTransactions',
          count: batch._count.transactions,
          action: 'BLOCK',
        },
      ],
      blockers,
    );
  }

  private async personPreview(id: string) {
    const person = await this.prisma.responsiblePerson.findUnique({
      where: { id },
      include: {
        stockBalances: { select: { quantity: true } },
        _count: {
          select: {
            stockTransactions: true,
            importRows: true,
          },
        },
        user: { select: { id: true } },
      },
    });
    if (!person) throw new NotFoundException('МВО не знайдено.');
    const nonZero = person.stockBalances.filter((b) => !b.quantity.isZero())
      .length;
    return this.preview(
      'responsible-persons',
      id,
      [person.lastName, person.firstName, person.middleName]
        .filter(Boolean)
        .join(' '),
      [
        { type: 'stockBalances', count: nonZero, action: 'BLOCK' },
        {
          type: 'stockTransactions',
          count: person._count.stockTransactions,
          action: 'DELETE',
        },
        { type: 'importMappings', count: person._count.importRows, action: 'DETACH' },
        { type: 'userAccount', count: person.user ? 1 : 0, action: 'DELETE' },
      ],
      nonZero ? ['МВО має ненульові залишки.'] : [],
    );
  }

  private async inventoryPreview(id: string) {
    const item = await this.prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        stockBalances: { select: { quantity: true } },
        _count: { select: { stockTransactions: true, importRows: true } },
      },
    });
    if (!item) throw new NotFoundException('Номенклатуру не знайдено.');
    const balances = item.stockBalances.filter((b) => !b.quantity.isZero())
      .length;
    return this.preview(
      'inventory-items',
      id,
      `${item.externalCode} — ${item.name}`,
      [
        { type: 'stockBalances', count: balances, action: 'BLOCK' },
        {
          type: 'stockTransactions',
          count: item._count.stockTransactions,
          action: 'BLOCK',
        },
        { type: 'importRows', count: item._count.importRows, action: 'DETACH' },
      ],
    );
  }

  private async unitPreview(id: string) {
    const unit = await this.prisma.unit.findUnique({
      where: { id },
      include: { _count: { select: { responsiblePersons: true } } },
    });
    if (!unit) throw new NotFoundException('Підрозділ не знайдено.');
    return this.preview('units', id, unit.name, [
      {
        type: 'responsiblePersons',
        count: unit._count.responsiblePersons,
        action: 'BLOCK',
      },
    ]);
  }

  private async servicePreview(id: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: {
        _count: { select: { units: true, responsiblePersons: true } },
      },
    });
    if (!service) throw new NotFoundException('Службу не знайдено.');
    return this.preview('services', id, service.name, [
      { type: 'units', count: service._count.units, action: 'BLOCK' },
      {
        type: 'responsiblePersons',
        count: service._count.responsiblePersons,
        action: 'BLOCK',
      },
    ]);
  }

  private async managementPreview(id: string) {
    const management = await this.prisma.management.findUnique({
      where: { id },
      include: {
        _count: { select: { services: true, responsiblePersons: true } },
      },
    });
    if (!management) throw new NotFoundException('Управління не знайдено.');
    return this.preview('managements', id, management.name, [
      { type: 'services', count: management._count.services, action: 'BLOCK' },
      {
        type: 'responsiblePersons',
        count: management._count.responsiblePersons,
        action: 'BLOCK',
      },
    ]);
  }

  private async deleteEntity(
    tx: Prisma.TransactionClient,
    type: AdminEntityType,
    id: string,
    actor: CurrentUser,
    force: boolean,
    preview: DeletionPreview,
  ): Promise<number> {
    if (preview.blockers.length && !force) {
      throw new ConflictException(preview.blockers.join(' '));
    }
    switch (type) {
      case 'users': {
        if (preview.blockers.length) throw new ConflictException(preview.blockers.join(' '));
        const sessions = await tx.userSession.deleteMany({ where: { userId: id } });
        await tx.user.delete({ where: { id } });
        return sessions.count;
      }
      case 'imports': {
        if (preview.blockers.length) throw new ConflictException(preview.blockers.join(' '));
        const rows = await tx.importRow.deleteMany({ where: { importBatchId: id } });
        await tx.importBatch.delete({ where: { id } });
        return rows.count;
      }
      case 'responsible-persons': {
        if (
          !force &&
          preview.dependencies.some(
            (dependency) =>
              dependency.action === 'BLOCK' && dependency.count > 0,
          )
        ) {
          throw new ConflictException('Для залежного МВО потрібен force delete.');
        }
        const user = await tx.user.findUnique({ where: { responsiblePersonId: id } });
        if (user?.id === actor.id || user?.role === UserRole.OWNER) {
          throw new ConflictException('Пов’язаний OWNER не може бути видалений.');
        }
        await tx.importRow.updateMany({
          where: { responsiblePersonId: id },
          data: { responsiblePersonId: null },
        });
        await tx.stockTransaction.deleteMany({ where: { responsiblePersonId: id } });
        await tx.stockBalance.deleteMany({ where: { responsiblePersonId: id } });
        if (user) await tx.user.delete({ where: { id: user.id } });
        await tx.responsiblePerson.delete({ where: { id } });
        return preview.dependencies.reduce((sum, item) => sum + item.count, 0);
      }
      case 'inventory-items': {
        if (
          !force &&
          preview.dependencies.some(
            (dependency) =>
              dependency.action === 'BLOCK' && dependency.count > 0,
          )
        ) {
          throw new ConflictException('Номенклатура використовувалась; архівуйте її.');
        }
        await tx.importRow.updateMany({
          where: { inventoryItemId: id },
          data: { inventoryItemId: null },
        });
        await tx.stockTransaction.deleteMany({ where: { inventoryItemId: id } });
        await tx.stockBalance.deleteMany({ where: { inventoryItemId: id } });
        await tx.inventoryItem.delete({ where: { id } });
        return preview.dependencies.reduce((sum, item) => sum + item.count, 0);
      }
      case 'units':
        if (preview.dependencies.some((d) => d.count > 0))
          throw new ConflictException('Спочатку перемістіть або видаліть МВО.');
        await tx.unit.delete({ where: { id } });
        return 0;
      case 'services':
        if (preview.dependencies.some((d) => d.count > 0))
          throw new ConflictException('Спочатку перемістіть або видаліть залежності.');
        await tx.service.delete({ where: { id } });
        return 0;
      case 'managements':
        if (preview.dependencies.some((d) => d.count > 0))
          throw new ConflictException('Спочатку перемістіть або видаліть залежності.');
        await tx.management.delete({ where: { id } });
        return 0;
    }
  }

  private async audit(
    client: Pick<PrismaService, 'securityEvent'> | Prisma.TransactionClient,
    actor: CurrentUser,
    entityType: AdminEntityType,
    entityId: string,
    displayName: string,
    metadata: Record<string, unknown> & {
      success: boolean;
      requestId?: string;
      ipAddress?: string;
      userAgent?: string;
    },
  ) {
    await client.securityEvent.create({
      data: {
        type: SecurityEventType.OWNER_DESTRUCTIVE_ACTION,
        actorUserId: actor.id,
        targetUserId: entityType === 'users' ? entityId : undefined,
        requestId: metadata.requestId,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        success: metadata.success,
        metadata: {
          entityType,
          entityId,
          displayName,
          ...metadata,
        } as Prisma.InputJsonValue,
      },
    });
  }
}
