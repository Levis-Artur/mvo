import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountingExportState,
  ImportStatus,
  Prisma,
  SecurityEventType,
  StockAccountingModel,
  StockDocumentStatus,
  StockDocumentType,
  StockSourceKind,
  StockTransactionType,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUser } from '../auth/auth.types';
import { StockService } from '../stock/stock.service';
import { StockDocumentsService } from '../stock-documents/stock-documents.service';
import {
  StockDocumentAttachmentStorageService,
  type StagedAttachmentFile,
} from '../stock-documents/stock-document-attachment-storage.service';
import {
  BUSINESS_DATA_RESET_REFUSAL,
  BusinessDataResetService,
  isBusinessDataResetAllowed,
} from './business-data-reset.service';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly businessDataReset: BusinessDataResetService,
    private readonly stockService: StockService,
    private readonly stockDocuments: StockDocumentsService,
    private readonly attachmentStorage: StockDocumentAttachmentStorageService,
  ) {}

  async deletionPreview(
    actor: CurrentUser,
    entityType: string,
    id: string,
  ): Promise<DeletionPreview> {
    this.assertOwner(actor);
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
    this.assertOwner(actor);
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

    let stagedAttachments: StagedAttachmentFile[] = [];
    let transactionCommitted = false;
    try {
      if (type === 'responsible-persons') {
        stagedAttachments = await this.stageResponsiblePersonAttachments(id);
      } else if (type === 'inventory-items') {
        stagedAttachments = await this.stageInventoryItemAttachments(id);
      }
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
      transactionCommitted = true;
      await this.attachmentStorage.finalizeDeletion(stagedAttachments);
      return result;
    } catch (error) {
      if (!transactionCommitted && stagedAttachments.length) {
        await this.attachmentStorage.restoreStaged(stagedAttachments);
      }
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
  ) {
    this.assertEnabledOwner(actor);
    if (!isBusinessDataResetAllowed(process.env.ALLOW_BUSINESS_DATA_RESET)) {
      throw new ForbiddenException(BUSINESS_DATA_RESET_REFUSAL);
    }
    const report = await this.businessDataReset.run({
      allowedFlag: process.env.ALLOW_BUSINESS_DATA_RESET,
      onBeforeCommit: async (tx) => {
        await this.audit(tx, actor, 'inventory-items', 'ALL', 'Business data', {
          action: 'TEST_DATA_RESET',
          deletedDependencies: 0,
          success: true,
          ...context,
        });
      },
    });
    const deleted = report.deleted ?? report.deleteCandidates;
    return {
      reset: true as const,
      preservedOwners: report.preserved.ownerUsers,
      preservedOwnerSessions: report.preserved.ownerSessions,
      deletedUsers: deleted.nonOwnerUsers,
      deletedUserAccessScopes: deleted.userAccessScopes,
      deletedManagements: deleted.managements,
      deletedServices: deleted.services,
      deletedUnits: deleted.units,
      deletedResponsiblePersons: deleted.responsiblePersons,
      deletedInventoryItems: deleted.inventoryItems,
      deletedStockBalances: deleted.stockBalances,
      deletedCustodyBalances: deleted.custodyBalances,
      deletedBalances: deleted.stockBalances + deleted.custodyBalances,
      deletedTransactions: deleted.stockTransactions,
      deletedDocuments: deleted.stockDocuments,
      deletedTransfers: deleted.mvoTransfers,
      deletedIssues: deleted.issues,
      deletedDocumentLines: deleted.stockDocumentLines,
      deletedRealizations: deleted.issueRealizations,
      deletedRealizationLines: deleted.issueRealizationLines,
      deletedAttachments:
        deleted.stockDocumentAttachments +
        deleted.issueRealizationAttachments,
      deletedImports: deleted.importBatches,
      deletedImportRows: deleted.importRows,
      deletedAccountingExportBatches: deleted.accountingExportBatches,
      deletedSecurityEvents: deleted.securityEvents,
      attachmentFilesDeleted: report.attachmentFilesDeleted,
      orphanAttachmentFiles: report.orphanAttachmentFiles,
    };
  }

  private assertEnabledOwner(actor: CurrentUser | undefined): void {
    this.assertOwner(actor);
    if (
      (process.env.OWNER_DESTRUCTIVE_ACTIONS_ENABLED ?? 'false').toLowerCase() !==
      'true'
    ) {
      throw new ForbiddenException(
        'Режим destructive administration вимкнений.',
      );
    }
  }

  private assertOwner(actor: CurrentUser | undefined): asserts actor is CurrentUser {
    if (!actor || actor.role !== UserRole.OWNER) {
      throw new ForbiddenException('Доступно лише OWNER.');
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
      throw new BadRequestException(
        `Безпечний сценарій видалення для entityType "${value}" не визначений.`,
      );
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
      include: {
        _count: {
          select: {
            sessions: true,
            accessScopes: true,
            createdStockDocuments: true,
            uploadedStockDocumentAttachments: true,
            createdIssueRealizations: true,
            uploadedIssueRealizationAttachments: true,
            accountingTransferExportBatches: true,
          },
        },
      },
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
      [
        { type: 'sessions', count: user._count.sessions, action: 'DELETE' },
        { type: 'accessScopes', count: user._count.accessScopes, action: 'DELETE' },
        { type: 'createdStockDocuments', count: user._count.createdStockDocuments, action: 'DETACH' },
        { type: 'uploadedStockDocumentAttachments', count: user._count.uploadedStockDocumentAttachments, action: 'DETACH' },
        { type: 'createdIssueRealizations', count: user._count.createdIssueRealizations, action: 'DETACH' },
        { type: 'uploadedIssueRealizationAttachments', count: user._count.uploadedIssueRealizationAttachments, action: 'DETACH' },
        { type: 'accountingTransferExportBatches', count: user._count.accountingTransferExportBatches, action: 'DETACH' },
      ],
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
        stockBalances: { select: { id: true } },
        _count: {
          select: {
            stockTransactions: true,
            importRows: true,
          },
        },
        user: { select: { id: true, role: true } },
      },
    });
    if (!person) throw new NotFoundException('МВО не знайдено.');
    const directlyAffectedDocuments = this.responsiblePersonDocumentWhere(id);
    const documentWhere: Prisma.StockDocumentWhereInput = {
      OR: [directlyAffectedDocuments, { sourceTransfer: directlyAffectedDocuments }],
    };
    const [custodyBalances, custodyReturns, documents, documentLines,
      attachments, realizations, accountingExportBatches] = await Promise.all([
      this.prisma.custodyBalance.count({ where: { OR: [
        { accountingOwnerResponsiblePersonId: id },
        { custodianResponsiblePersonId: id },
      ] } }),
      this.prisma.custodyBalance.count({ where: {
        custodianResponsiblePersonId: id,
        accountingOwnerResponsiblePersonId: { not: id },
        quantity: { gt: 0 },
      } }),
      this.prisma.stockDocument.count({ where: documentWhere }),
      this.prisma.stockDocumentLine.count({ where: { document: documentWhere } }),
      this.prisma.stockDocumentAttachment.count({ where: { document: documentWhere } }),
      this.prisma.issueRealization.count({ where: { issue: documentWhere } }),
      this.prisma.accountingTransferExportBatch.count({
        where: { documents: { some: { document: documentWhere } } },
      }),
    ]);
    return this.preview(
      'responsible-persons',
      id,
      [person.lastName, person.firstName, person.middleName]
        .filter(Boolean)
        .join(' '),
      [
        {
          type: 'linkedUsers',
          count: person.user ? 1 : 0,
          action: person.user?.role === UserRole.MVO ? 'DELETE' : 'DETACH',
        },
        { type: 'stockBalances', count: person.stockBalances.length, action: 'DELETE' },
        { type: 'custodyBalances', count: custodyBalances, action: 'DELETE' },
        { type: 'custodyReturnsToOwners', count: custodyReturns, action: 'DETACH' },
        {
          type: 'stockTransactions',
          count: person._count.stockTransactions,
          action: 'DELETE',
        },
        { type: 'documents', count: documents, action: 'DELETE' },
        { type: 'documentLines', count: documentLines, action: 'DELETE' },
        { type: 'attachments', count: attachments, action: 'DELETE' },
        { type: 'realizations', count: realizations, action: 'DELETE' },
        { type: 'importRows', count: person._count.importRows, action: 'DETACH' },
        { type: 'accountingExportBatches', count: accountingExportBatches, action: 'DELETE' },
      ],
    );
  }

  private async inventoryPreview(id: string) {
    const item = await this.prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            stockBalances: true,
            custodyBalances: true,
            stockTransactions: true,
            stockDocumentLines: true,
            importRows: true,
          },
        },
      },
    });
    if (!item) throw new NotFoundException('Номенклатуру не знайдено.');
    const affectedDocumentsWhere: Prisma.StockDocumentWhereInput = {
      lines: { some: { inventoryItemId: id } },
    };
    const documentsToDeleteWhere: Prisma.StockDocumentWhereInput = {
      AND: [
        affectedDocumentsWhere,
        { lines: { none: { inventoryItemId: { not: id } } } },
      ],
    };
    const realizationsToDeleteWhere: Prisma.IssueRealizationWhereInput = {
      AND: [
        { lines: { some: { issueLine: { inventoryItemId: id } } } },
        { lines: { none: { issueLine: { inventoryItemId: { not: id } } } } },
      ],
    };
    const [affectedDocuments, documentsToDelete, realizationLines,
      realizationsToDelete, documentAttachments, realizationAttachments,
      accountingExportBatches] = await Promise.all([
      this.prisma.stockDocument.count({ where: affectedDocumentsWhere }),
      this.prisma.stockDocument.count({ where: documentsToDeleteWhere }),
      this.prisma.issueRealizationLine.count({
        where: { issueLine: { inventoryItemId: id } },
      }),
      this.prisma.issueRealization.count({ where: realizationsToDeleteWhere }),
      this.prisma.stockDocumentAttachment.count({
        where: { document: documentsToDeleteWhere },
      }),
      this.prisma.issueRealizationAttachment.count({
        where: { realization: realizationsToDeleteWhere },
      }),
      this.prisma.accountingTransferExportBatch.count({
        where: { documents: { some: { document: affectedDocumentsWhere } } },
      }),
    ]);
    return this.preview(
      'inventory-items',
      id,
      `${item.externalCode} — ${item.name}`,
      [
        { type: 'stockBalances', count: item._count.stockBalances, action: 'DELETE' },
        { type: 'custodyBalances', count: item._count.custodyBalances, action: 'DELETE' },
        { type: 'transactions', count: item._count.stockTransactions, action: 'DELETE' },
        { type: 'documentLines', count: item._count.stockDocumentLines, action: 'DELETE' },
        { type: 'affectedDocuments', count: affectedDocuments, action: 'RETAIN' },
        { type: 'documentsToDelete', count: documentsToDelete, action: 'DELETE' },
        { type: 'documentsToKeep', count: affectedDocuments - documentsToDelete, action: 'RETAIN' },
        { type: 'realizationLines', count: realizationLines, action: 'DELETE' },
        { type: 'realizationsToDelete', count: realizationsToDelete, action: 'DELETE' },
        { type: 'attachmentsToDelete', count: documentAttachments + realizationAttachments, action: 'DELETE' },
        { type: 'importRows', count: item._count.importRows, action: 'DETACH' },
        { type: 'accountingExportBatches', count: accountingExportBatches, action: 'DELETE' },
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
        action: 'DETACH',
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
    const [managementScopes, globalScopes, sameCodeElsewhere] = await Promise.all([
      this.prisma.userAccessScope.count({
        where: {
          managementId: service.managementId,
          serviceCode: service.code,
        },
      }),
      this.prisma.userAccessScope.count({
        where: { managementId: null, serviceCode: service.code },
      }),
      this.prisma.service.count({
        where: { code: service.code, id: { not: id } },
      }),
    ]);
    return this.preview('services', id, service.name, [
      { type: 'units', count: service._count.units, action: 'BLOCK' },
      {
        type: 'responsiblePersons',
        count: service._count.responsiblePersons,
        action: 'BLOCK',
      },
      {
        type: 'managementAccessScopes',
        count: managementScopes,
        action: 'DELETE',
      },
      {
        type: 'globalServiceAccessScopes',
        count: globalScopes,
        action: sameCodeElsewhere > 0 ? 'RETAIN' : 'DELETE',
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
    const scopes = await this.prisma.userAccessScope.count({
      where: { managementId: id },
    });
    return this.preview('managements', id, management.name, [
      { type: 'services', count: management._count.services, action: 'BLOCK' },
      {
        type: 'responsiblePersons',
        count: management._count.responsiblePersons,
        action: 'BLOCK',
      },
      { type: 'accessScopes', count: scopes, action: 'DELETE' },
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
        await this.deleteUserInTx(tx, id);
        return preview.dependencies
          .filter((dependency) => dependency.action === 'DELETE')
          .reduce((sum, dependency) => sum + dependency.count, 0);
      }
      case 'imports': {
        if (preview.blockers.length) throw new ConflictException(preview.blockers.join(' '));
        const rows = await tx.importRow.deleteMany({ where: { importBatchId: id } });
        await tx.importBatch.delete({ where: { id } });
        return rows.count;
      }
      case 'responsible-persons': {
        await this.deleteResponsiblePersonInTx(tx, id, actor);
        return preview.dependencies.reduce((sum, item) => sum + item.count, 0);
      }
      case 'inventory-items': {
        await this.deleteInventoryItemInTx(tx, id);
        return preview.dependencies.reduce((sum, item) => sum + item.count, 0);
      }
      case 'units':
        await tx.responsiblePerson.updateMany({
          where: { unitId: id },
          data: { unitId: null },
        });
        await tx.unit.delete({ where: { id } });
        return preview.dependencies.reduce((sum, item) => sum + item.count, 0);
      case 'services': {
        if (preview.dependencies.some((d) => d.action === 'BLOCK' && d.count > 0))
          throw new ConflictException('Спочатку перемістіть або видаліть залежності.');
        const service = await tx.service.findUniqueOrThrow({ where: { id } });
        const sameCodeElsewhere = await tx.service.count({
          where: { code: service.code, id: { not: id } },
        });
        await tx.userAccessScope.deleteMany({
          where: {
            OR: [
              {
                managementId: service.managementId,
                serviceCode: service.code,
              },
              ...(sameCodeElsewhere === 0
                ? [{ managementId: null, serviceCode: service.code }]
                : []),
            ],
          },
        });
        await tx.service.delete({ where: { id } });
        return preview.dependencies
          .filter((dependency) => dependency.action === 'DELETE')
          .reduce((sum, dependency) => sum + dependency.count, 0);
      }
      case 'managements':
        if (preview.dependencies.some((d) => d.action === 'BLOCK' && d.count > 0))
          throw new ConflictException('Спочатку перемістіть або видаліть залежності.');
        await tx.userAccessScope.deleteMany({ where: { managementId: id } });
        await tx.management.delete({ where: { id } });
        return preview.dependencies
          .filter((dependency) => dependency.action === 'DELETE')
          .reduce((sum, dependency) => sum + dependency.count, 0);
    }
  }

  private responsiblePersonDocumentWhere(
    id: string,
  ): Prisma.StockDocumentWhereInput {
    return {
      OR: [
        { sourceResponsiblePersonId: id },
        { destinationResponsiblePersonId: id },
        { lines: { some: { accountingOwnerResponsiblePersonId: id } } },
        { lines: { some: { sourceCustodianResponsiblePersonId: id } } },
        { transactions: { some: { accountingOwnerResponsiblePersonId: id } } },
        { transactions: { some: { sourceCustodianResponsiblePersonId: id } } },
        { transactions: { some: { destinationCustodianResponsiblePersonId: id } } },
      ],
    };
  }

  private async stageResponsiblePersonAttachments(id: string) {
    const affected = this.responsiblePersonDocumentWhere(id);
    const documentWhere: Prisma.StockDocumentWhereInput = {
      OR: [affected, { sourceTransfer: affected }],
    };
    const [documentAttachments, realizationAttachments] = await Promise.all([
      this.prisma.stockDocumentAttachment.findMany({
        where: { document: documentWhere },
        select: { storagePath: true },
      }),
      this.prisma.issueRealizationAttachment.findMany({
        where: { realization: { issue: documentWhere } },
        select: { storagePath: true },
      }),
    ]);
    const staged: StagedAttachmentFile[] = [];
    try {
      for (const storagePath of [
        ...documentAttachments.map((item) => item.storagePath),
        ...realizationAttachments.map((item) => item.storagePath),
      ]) {
        staged.push(await this.attachmentStorage.stageForDeletion(storagePath));
      }
      return staged;
    } catch (error) {
      await this.attachmentStorage.restoreStaged(staged);
      throw error;
    }
  }

  private async stageInventoryItemAttachments(id: string) {
    const emptyDocuments: Prisma.StockDocumentWhereInput = {
      AND: [
        { lines: { some: { inventoryItemId: id } } },
        { lines: { none: { inventoryItemId: { not: id } } } },
      ],
    };
    const emptyRealizations: Prisma.IssueRealizationWhereInput = {
      AND: [
        { lines: { some: { issueLine: { inventoryItemId: id } } } },
        { lines: { none: { issueLine: { inventoryItemId: { not: id } } } } },
      ],
    };
    const [documentAttachments, realizationAttachments] = await Promise.all([
      this.prisma.stockDocumentAttachment.findMany({
        where: { document: emptyDocuments },
        select: { storagePath: true },
      }),
      this.prisma.issueRealizationAttachment.findMany({
        where: { realization: emptyRealizations },
        select: { storagePath: true },
      }),
    ]);
    const staged: StagedAttachmentFile[] = [];
    try {
      for (const storagePath of [
        ...documentAttachments.map((item) => item.storagePath),
        ...realizationAttachments.map((item) => item.storagePath),
      ]) {
        staged.push(await this.attachmentStorage.stageForDeletion(storagePath));
      }
      return staged;
    } catch (error) {
      await this.attachmentStorage.restoreStaged(staged);
      throw error;
    }
  }

  private async deleteInventoryItemInTx(
    tx: Prisma.TransactionClient,
    id: string,
  ) {
    await tx.$queryRaw`
      SELECT "id" FROM "InventoryItem" WHERE "id" = ${id}::uuid FOR UPDATE
    `;
    await tx.inventoryItem.findUniqueOrThrow({ where: { id } });
    await tx.$queryRaw`
      SELECT "id" FROM "StockDocumentLine"
      WHERE "inventoryItemId" = ${id}::uuid FOR UPDATE
    `;
    await tx.$queryRaw`
      SELECT d."id" FROM "StockDocument" d
      WHERE EXISTS (
        SELECT 1 FROM "StockDocumentLine" l
        WHERE l."documentId" = d."id"
          AND l."inventoryItemId" = ${id}::uuid
      ) FOR UPDATE
    `;

    const lines = await tx.stockDocumentLine.findMany({
      where: { inventoryItemId: id },
      select: { id: true, documentId: true },
    });
    const lineIds = lines.map((line) => line.id);
    const documentIds = [...new Set(lines.map((line) => line.documentId))];
    const documents = await tx.stockDocument.findMany({
      where: { id: { in: documentIds } },
      select: {
        id: true,
        _count: { select: { lines: { where: { inventoryItemId: { not: id } } } } },
      },
    });
    const emptyDocumentIds = documents
      .filter((document) => document._count.lines === 0)
      .map((document) => document.id);

    const realizationLines = await tx.issueRealizationLine.findMany({
      where: { issueLineId: { in: lineIds } },
      select: { id: true, realizationId: true },
    });
    const realizationIds = [...new Set(realizationLines.map((line) => line.realizationId))];
    const realizations = await tx.issueRealization.findMany({
      where: { id: { in: realizationIds } },
      select: {
        id: true,
        _count: {
          select: { lines: { where: { issueLineId: { notIn: lineIds } } } },
        },
      },
    });
    const emptyRealizationIds = realizations
      .filter((realization) => realization._count.lines === 0)
      .map((realization) => realization.id);

    const exportLinks = await tx.accountingTransferExportBatchDocument.findMany({
      where: { documentId: { in: documentIds } },
      select: { batchId: true },
      distinct: ['batchId'],
    });
    const batchIds = exportLinks.map((link) => link.batchId);
    const allBatchLinks = await tx.accountingTransferExportBatchDocument.findMany({
      where: { batchId: { in: batchIds } },
      select: { documentId: true },
    });
    await tx.stockDocument.updateMany({
      where: { id: { in: allBatchLinks.map((link) => link.documentId) } },
      data: {
        accountingExportState: AccountingExportState.NOT_EXPORTED,
        exportedAt: null,
        exportedByUserId: null,
      },
    });
    await tx.accountingTransferExportBatch.deleteMany({
      where: { id: { in: batchIds } },
    });

    await tx.issueRealizationLine.deleteMany({
      where: { id: { in: realizationLines.map((line) => line.id) } },
    });
    await tx.issueRealizationAttachment.deleteMany({
      where: { realizationId: { in: emptyRealizationIds } },
    });
    await tx.issueRealization.deleteMany({
      where: { id: { in: emptyRealizationIds } },
    });

    await tx.stockDocumentLine.updateMany({
      where: { sourceTransferLineId: { in: lineIds } },
      data: { sourceTransferLineId: null },
    });
    const transactions = await tx.stockTransaction.findMany({
      where: { inventoryItemId: id },
      select: { id: true },
    });
    const transactionIds = transactions.map((transaction) => transaction.id);
    await tx.stockTransaction.updateMany({
      where: { reversalOfTransactionId: { in: transactionIds } },
      data: { reversalOfTransactionId: null },
    });
    await tx.stockTransaction.updateMany({
      where: {
        documentLineId: { in: lineIds },
        inventoryItemId: { not: id },
      },
      data: { documentLineId: null },
    });
    await tx.stockTransaction.updateMany({
      where: {
        documentId: { in: emptyDocumentIds },
        inventoryItemId: { not: id },
      },
      data: { documentId: null, documentLineId: null },
    });
    await tx.stockTransaction.deleteMany({ where: { inventoryItemId: id } });
    await tx.stockDocumentLine.deleteMany({ where: { id: { in: lineIds } } });

    await tx.stockDocument.updateMany({
      where: { sourceTransferId: { in: emptyDocumentIds } },
      data: { sourceTransferId: null },
    });
    await tx.stockDocumentAttachment.deleteMany({
      where: { documentId: { in: emptyDocumentIds } },
    });
    await tx.stockDocument.deleteMany({
      where: {
        id: { in: emptyDocumentIds },
        lines: { none: {} },
        transactions: { none: {} },
      },
    });

    const custody = await tx.custodyBalance.findMany({
      where: { inventoryItemId: id },
      select: { id: true },
    });
    const stockBalances = await tx.stockBalance.findMany({
      where: { inventoryItemId: id },
      select: { id: true },
    });
    await tx.stockDocumentLine.updateMany({
      where: { sourceCustodyBalanceId: { in: custody.map((item) => item.id) } },
      data: { sourceCustodyBalanceId: null },
    });
    await tx.stockDocumentLine.updateMany({
      where: { sourceBalanceId: { in: stockBalances.map((item) => item.id) } },
      data: { sourceBalanceId: null },
    });
    await tx.custodyBalance.deleteMany({ where: { inventoryItemId: id } });
    await tx.stockBalance.deleteMany({ where: { inventoryItemId: id } });
    await tx.importRow.updateMany({
      where: { inventoryItemId: id },
      data: { inventoryItemId: null },
    });
    await tx.inventoryItem.delete({ where: { id } });
  }

  private async deleteResponsiblePersonInTx(
    tx: Prisma.TransactionClient,
    id: string,
    actor: CurrentUser,
  ) {
    const person = await tx.responsiblePerson.findUniqueOrThrow({ where: { id } });
    const linkedUser = await tx.user.findUnique({
      where: { responsiblePersonId: id },
    });
    if (linkedUser?.id === actor.id || linkedUser?.role === UserRole.OWNER) {
      throw new ConflictException('Пов’язаний OWNER не може бути видалений.');
    }

    const custody = await tx.custodyBalance.findMany({
      where: { OR: [
        { accountingOwnerResponsiblePersonId: id },
        { custodianResponsiblePersonId: id },
      ] },
    });
    const displayName = [person.lastName, person.firstName, person.middleName]
      .filter(Boolean).join(' ');
    for (const balance of custody) {
      if (
        balance.custodianResponsiblePersonId === id &&
        balance.accountingOwnerResponsiblePersonId !== id &&
        balance.quantity.greaterThan(0)
      ) {
        await this.stockService.createIncreasingTransactionInTx(tx, {
          type: StockTransactionType.ASSIGNMENT_REVERSAL,
          responsiblePersonId: balance.accountingOwnerResponsiblePersonId,
          inventoryItemId: balance.inventoryItemId,
          quantity: balance.quantity,
          occurredAt: new Date(),
          sourceDocument: `OWNER DELETE MVO ${id}`,
          comment: `Повернення від видаленого custodian ${displayName} (${id})`,
          documentId: null,
          documentLineId: null,
          importBatchId: null,
          importRowId: null,
          accountingModel: StockAccountingModel.DIRECT_BALANCE,
          bucketKind: StockSourceKind.DIRECT,
        });
      }
    }

    const baseDocumentWhere = this.responsiblePersonDocumentWhere(id);
    const documents = await tx.stockDocument.findMany({
      where: { OR: [baseDocumentWhere, { sourceTransfer: baseDocumentWhere }] },
      select: { id: true, type: true, status: true, accountingModel: true },
    });
    const documentIds = documents.map((item) => item.id);
    const issueIds = documents
      .filter((item) => item.type === StockDocumentType.ISSUE)
      .map((item) => item.id);

    await tx.issueRealization.updateMany({
      where: { issueId: { in: issueIds }, status: 'POSTED' },
      data: { status: 'CANCELLED', cancelledByUserId: actor.id, cancelledAt: new Date() },
    });
    for (const document of [
      ...documents.filter((item) => item.type === StockDocumentType.ISSUE),
      ...documents.filter((item) => item.type === StockDocumentType.MVO_TRANSFER),
    ]) {
      if (
        document.accountingModel === StockAccountingModel.DIRECT_BALANCE &&
        document.status === StockDocumentStatus.POSTED
      ) {
        await this.stockDocuments.cancelForOwnerDeletionInTx(tx, document.id, actor);
      }
    }

    const exportLinks = await tx.accountingTransferExportBatchDocument.findMany({
      where: { documentId: { in: documentIds } },
      select: { batchId: true },
      distinct: ['batchId'],
    });
    const affectedBatchIds = exportLinks.map((item) => item.batchId);
    const allBatchLinks = await tx.accountingTransferExportBatchDocument.findMany({
      where: { batchId: { in: affectedBatchIds } },
      select: { documentId: true },
    });
    await tx.stockDocument.updateMany({
      where: { id: { in: allBatchLinks.map((item) => item.documentId) } },
      data: {
        accountingExportState: AccountingExportState.NOT_EXPORTED,
        exportedAt: null,
        exportedByUserId: null,
      },
    });
    await tx.accountingTransferExportBatch.deleteMany({
      where: { id: { in: affectedBatchIds } },
    });

    const realizations = await tx.issueRealization.findMany({
      where: { issueId: { in: issueIds } },
      select: { id: true },
    });
    const realizationIds = realizations.map((item) => item.id);
    await tx.issueRealizationAttachment.deleteMany({
      where: { realizationId: { in: realizationIds } },
    });
    await tx.issueRealizationLine.deleteMany({
      where: { realizationId: { in: realizationIds } },
    });
    await tx.issueRealization.deleteMany({ where: { id: { in: realizationIds } } });
    await tx.stockDocumentAttachment.deleteMany({
      where: { documentId: { in: documentIds } },
    });

    await tx.stockTransaction.updateMany({
      where: { reversalOfTransaction: { documentId: { in: documentIds } } },
      data: { reversalOfTransactionId: null },
    });
    await tx.stockTransaction.deleteMany({ where: { OR: [
      { documentId: { in: documentIds } },
      { responsiblePersonId: id },
      { accountingOwnerResponsiblePersonId: id },
      { sourceCustodianResponsiblePersonId: id },
      { destinationCustodianResponsiblePersonId: id },
    ] } });
    await tx.stockDocumentLine.updateMany({
      where: { documentId: { in: documentIds } },
      data: { sourceTransferLineId: null, sourceCustodyBalanceId: null, sourceBalanceId: null },
    });
    await tx.stockDocumentLine.deleteMany({ where: { documentId: { in: issueIds } } });
    await tx.stockDocument.updateMany({
      where: { id: { in: documentIds } },
      data: { sourceTransferId: null },
    });
    await tx.stockDocumentLine.deleteMany({ where: { documentId: { in: documentIds } } });
    await tx.stockDocument.deleteMany({ where: { id: { in: issueIds } } });
    await tx.stockDocument.deleteMany({ where: { id: { in: documentIds } } });

    await tx.custodyBalance.deleteMany({ where: { id: { in: custody.map((item) => item.id) } } });
    await tx.importRow.updateMany({
      where: { responsiblePersonId: id }, data: { responsiblePersonId: null },
    });
    await tx.stockBalance.deleteMany({ where: { responsiblePersonId: id } });

    if (linkedUser?.role === UserRole.MVO) {
      await this.deleteUserInTx(tx, linkedUser.id, {
        skipResponsiblePersonDetach: true,
      });
    } else if (linkedUser) {
      await tx.user.update({ where: { id: linkedUser.id }, data: { responsiblePersonId: null } });
    }
    await tx.responsiblePerson.delete({ where: { id } });
  }

  private async deleteUserInTx(
    tx: Prisma.TransactionClient,
    id: string,
    options: { skipResponsiblePersonDetach?: boolean } = {},
  ) {
    await tx.stockDocument.updateMany({ where: { postedByUserId: id }, data: { postedByUserId: null } });
    await tx.stockDocument.updateMany({ where: { cancelledByUserId: id }, data: { cancelledByUserId: null } });
    await tx.stockDocument.updateMany({ where: { exportedByUserId: id }, data: { exportedByUserId: null } });
    await tx.issueRealization.updateMany({ where: { cancelledByUserId: id }, data: { cancelledByUserId: null } });
    if (!options.skipResponsiblePersonDetach) {
      await tx.user.update({ where: { id }, data: { responsiblePersonId: null } });
    }
    await tx.user.delete({ where: { id } });
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
        targetUserId:
          entityType === 'users' && metadata.action !== 'DELETE'
            ? entityId
            : undefined,
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
