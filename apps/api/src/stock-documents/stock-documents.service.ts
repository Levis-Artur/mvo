import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountingExportState,
  Prisma,
  SecurityEventType,
  StockAccountingModel,
  StockDocumentStatus,
  StockDocumentType,
  StockSourceKind,
  StockTransactionType,
  UserRole,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { CurrentUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../stock/stock.service';
import {
  type StagedAttachmentFile,
  StockDocumentAttachmentStorageService,
} from './stock-document-attachment-storage.service';
import {
  CreateStockDocumentDto,
  ListStockDocumentsQueryDto,
  UpdateStockDocumentDto,
} from './dto/stock-document.dto';

type AuditContext = {
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
};

const documentInclude = {
  sourceResponsiblePerson: true,
  destinationResponsiblePerson: true,
  createdByUser: { select: { id: true, username: true, role: true } },
  postedByUser: { select: { id: true, username: true, role: true } },
  cancelledByUser: { select: { id: true, username: true, role: true } },
  lines: {
    include: {
      inventoryItem: true,
      accountingOwnerResponsiblePerson: true,
      sourceCustodianResponsiblePerson: true,
      sourceCustodyBalance: true,
    },
    orderBy: { createdAt: 'asc' as const },
  },
  attachments: {
    select: {
      id: true,
      documentId: true,
      originalFileName: true,
      mimeType: true,
      sizeBytes: true,
      sha256: true,
      uploadedByUserId: true,
      uploadedByUser: { select: { id: true, username: true, role: true } },
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.StockDocumentInclude;

type PostingDocument = Prisma.StockDocumentGetPayload<{
  include: {
    lines: true;
    attachments: { select: { id: true; storagePath: true } };
  };
}>;
type PostingLine = PostingDocument['lines'][number];
type CancellationDocument = Prisma.StockDocumentGetPayload<{
  include: { lines: { include: { transactions: true } } };
}>;
type CancellationLine = CancellationDocument['lines'][number];

@Injectable()
export class StockDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
    private readonly attachmentStorage: StockDocumentAttachmentStorageService,
  ) {}

  async list(query: ListStockDocumentsQueryDto, actor: CurrentUser) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const mvoId =
      actor.role === UserRole.MVO
        ? (actor.responsiblePersonId ?? '__no_mvo_person__')
        : undefined;
    const where: Prisma.StockDocumentWhereInput = {
      type: query.type,
      status: query.status,
      sourceResponsiblePersonId: query.sourceResponsiblePersonId,
      destinationResponsiblePersonId: query.destinationResponsiblePersonId,
      documentDate: {
        gte: query.documentDateFrom
          ? new Date(query.documentDateFrom)
          : undefined,
        lte: query.documentDateTo ? new Date(query.documentDateTo) : undefined,
      },
      OR: mvoId
        ? [
            { createdByUserId: actor.id },
            { sourceResponsiblePersonId: mvoId },
          ]
        : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.stockDocument.findMany({
        where,
        include: documentInclude,
        orderBy: [{ documentDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.stockDocument.count({ where }),
    ]);
    return {
      items: items.map((item) => this.serialize(item)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, actor: CurrentUser) {
    const document = await this.prisma.stockDocument.findUnique({
      where: { id },
      include: documentInclude,
    });
    if (!document) {
      throw new NotFoundException('Документ руху майна не знайдено');
    }
    this.assertReadAccess(actor, document);
    return this.serialize(document);
  }

  async create(
    dto: CreateStockDocumentDto,
    actor: CurrentUser,
    context: AuditContext,
  ) {
    this.assertCanWrite(actor);
    this.assertNewDocumentType(dto.type);
    const normalized = this.validateDto(dto, actor);
    await this.assertActiveTransferRecipient(
      this.prisma,
      dto.type,
      normalized.sourceResponsiblePersonId,
      normalized.destinationResponsiblePersonId ?? null,
    );
    const document = await this.prisma.stockDocument.create({
      data: {
        documentNumber:
          dto.documentNumber?.trim() ??
          `MOV-${randomUUID().slice(0, 8).toUpperCase()}`,
        documentDate: new Date(dto.documentDate),
        type: dto.type,
        accountingModel: normalized.accountingModel,
        sourceResponsiblePersonId: normalized.sourceResponsiblePersonId,
        destinationResponsiblePersonId:
          normalized.destinationResponsiblePersonId,
        recipientName: normalized.recipientName,
        recipientUnit: normalized.recipientUnit,
        basis: dto.basis?.trim() || null,
        note: dto.note?.trim() || null,
        createdByUserId: actor.id,
        lines: { create: normalized.lines },
      },
      include: documentInclude,
    });
    await this.audit(actor, document.id, 'CREATE', document.status, true, context);
    return this.serialize(document);
  }

  async update(
    id: string,
    dto: UpdateStockDocumentDto,
    actor: CurrentUser,
    context: AuditContext,
  ) {
    this.assertCanWrite(actor);
    const current = await this.findRaw(id);
    this.assertMutableDocument(current);
    this.assertNewDocumentType(dto.type);
    this.assertDraft(current.status);
    this.assertMvoOwnSource(actor, current.sourceResponsiblePersonId);
    const normalized = this.validateDto(dto, actor);
    await this.assertActiveTransferRecipient(
      this.prisma,
      dto.type,
      normalized.sourceResponsiblePersonId,
      normalized.destinationResponsiblePersonId ?? null,
    );
    const document = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.stockDocument.updateMany({
        where: { id, status: StockDocumentStatus.DRAFT },
        data: { updatedAt: new Date() },
      });
      if (claim.count !== 1) this.assertDraft(StockDocumentStatus.POSTED);
      await tx.stockDocumentLine.deleteMany({ where: { documentId: id } });
      return tx.stockDocument.update({
        where: { id },
        data: {
          documentNumber: dto.documentNumber?.trim() ?? current.documentNumber,
          documentDate: new Date(dto.documentDate),
          type: dto.type,
          accountingModel: normalized.accountingModel,
          sourceResponsiblePersonId: normalized.sourceResponsiblePersonId,
          destinationResponsiblePersonId:
            normalized.destinationResponsiblePersonId,
          recipientName: normalized.recipientName,
          recipientUnit: normalized.recipientUnit,
          basis: dto.basis?.trim() || null,
          note: dto.note?.trim() || null,
          lines: { create: normalized.lines },
        },
        include: documentInclude,
      });
    });
    await this.audit(actor, id, 'UPDATE', document.status, true, context);
    return this.serialize(document);
  }

  async remove(id: string, actor: CurrentUser, context: AuditContext) {
    this.assertCanWrite(actor);
    const document = await this.findRaw(id);
    this.assertMutableDocument(document);
    this.assertDraft(document.status);
    this.assertMvoOwnSource(actor, document.sourceResponsiblePersonId);
    const attachments = await this.prisma.stockDocumentAttachment.findMany({
      where: { documentId: id },
      select: { storagePath: true },
    });
    const staged = await this.stageAttachmentFiles(
      attachments.map((attachment) => attachment.storagePath),
    );
    try {
      await this.prisma.$transaction(async (tx) => {
        const claim = await tx.stockDocument.updateMany({
          where: { id, status: StockDocumentStatus.DRAFT },
          data: { updatedAt: new Date() },
        });
        if (claim.count !== 1) this.assertDraft(StockDocumentStatus.POSTED);
        await tx.stockDocumentAttachment.deleteMany({
          where: { documentId: id },
        });
        await tx.stockDocument.delete({ where: { id } });
        await this.auditInTx(
          tx,
          actor,
          id,
          'DELETE',
          document.status,
          true,
          context,
        );
      });
    } catch (error) {
      await this.attachmentStorage.restoreStaged(staged);
      throw error;
    }
    await this.attachmentStorage.finalizeDeletion(staged);
    return { deleted: true, id };
  }

  async post(id: string, actor: CurrentUser, context: AuditContext) {
    this.assertCanWrite(actor);
    try {
      const posted = await this.prisma.$transaction(async (tx) => {
        const current = await tx.stockDocument.findUnique({
          where: { id },
          select: {
            type: true,
            accountingModel: true,
            status: true,
            sourceResponsiblePersonId: true,
          },
        });
        if (!current) {
          throw new NotFoundException('Документ руху майна не знайдено');
        }
        this.assertMvoOwnSource(actor, current.sourceResponsiblePersonId);
        this.assertMutableDocument(current);
        if (current.status === StockDocumentStatus.POSTED) return false;
        this.assertDraft(current.status);

        const claim = await tx.stockDocument.updateMany({
          where: { id, status: StockDocumentStatus.DRAFT },
          data: { updatedAt: new Date() },
        });
        if (claim.count === 0) {
          const concurrent = await tx.stockDocument.findUnique({
            where: { id },
            select: { status: true, sourceResponsiblePersonId: true },
          });
          if (!concurrent) {
            throw new NotFoundException('Документ руху майна не знайдено');
          }
          this.assertMvoOwnSource(actor, concurrent.sourceResponsiblePersonId);
          if (concurrent.status === StockDocumentStatus.POSTED) return false;
          this.assertDraft(concurrent.status);
        }

        const document = await tx.stockDocument.findUnique({
          where: { id },
          include: {
            lines: true,
            attachments: { select: { id: true, storagePath: true } },
          },
        });
        if (!document) {
          throw new NotFoundException('Документ руху майна не знайдено');
        }
        this.assertMvoOwnSource(actor, document.sourceResponsiblePersonId);
        await this.assertActiveTransferRecipient(
          tx,
          document.type,
          document.sourceResponsiblePersonId,
          document.destinationResponsiblePersonId,
        );
        if (!document.lines.length) {
          throw new BadRequestException(
            'Документ повинен містити хоча б один рядок',
          );
        }
        if (document.type === StockDocumentType.ISSUE) {
          if (document.accountingModel !== StockAccountingModel.DIRECT_BALANCE) {
            throw new BadRequestException(
              'Legacy-чернетка видачі не містить надійного джерела залишку',
            );
          }
          if (!document.recipientName?.trim()) {
            throw new BadRequestException(
              'Для проведення видачі обов’язково вкажіть одержувача',
            );
          }
          if (!document.basis?.trim()) {
            throw new BadRequestException(
              'Для проведення видачі обов’язково вкажіть мету або підставу',
            );
          }
          if (!document.attachments.length) {
            throw new BadRequestException(
              'Для проведення видачі додайте хоча б одне фото або скан накладної',
            );
          }
          await this.attachmentStorage.assertStoredFilesExist(
            document.attachments.map((attachment) => attachment.storagePath),
          );
        }

        for (const line of document.lines) {
          await this.postLine(tx, document, line);
        }
        await tx.stockDocument.update({
          where: { id },
          data: {
            status: StockDocumentStatus.POSTED,
            postedByUserId: actor.id,
            postedAt: new Date(),
          },
        });
        await this.auditInTx(
          tx,
          actor,
          id,
          'POST',
          StockDocumentStatus.POSTED,
          true,
          context,
        );
        return true;
      });
      if (!posted) return this.findOne(id, actor);
    } catch (error) {
      await this.audit(actor, id, 'POST', 'FAILED', false, context, error);
      throw error;
    }
    return this.findOne(id, actor);
  }

  async cancel(id: string, actor: CurrentUser, context: AuditContext) {
    this.assertCanWrite(actor);
    try {
      const cancelled = await this.prisma.$transaction(async (tx) => {
        const current = await tx.stockDocument.findUnique({
          where: { id },
          select: {
            type: true,
            accountingModel: true,
            accountingExportState: true,
            status: true,
            sourceResponsiblePersonId: true,
          },
        });
        if (!current) {
          throw new NotFoundException('Документ руху майна не знайдено');
        }
        this.assertMvoOwnSource(actor, current.sourceResponsiblePersonId);
        this.assertMutableDocument(current);
        if (current.status === StockDocumentStatus.CANCELLED) return false;
        if (current.status !== StockDocumentStatus.POSTED) {
          throw new BadRequestException(
            'Скасувати можна лише проведений документ',
          );
        }
        this.assertCancellationExportAllowed(current);

        const claim = await tx.stockDocument.updateMany({
          where: {
            id,
            status: StockDocumentStatus.POSTED,
            accountingExportState:
              current.type === StockDocumentType.MVO_TRANSFER
                ? AccountingExportState.NOT_EXPORTED
                : undefined,
          },
          data: { updatedAt: new Date() },
        });
        if (claim.count === 0) {
          const concurrent = await tx.stockDocument.findUnique({
            where: { id },
            select: {
              type: true,
              accountingExportState: true,
              status: true,
              sourceResponsiblePersonId: true,
            },
          });
          if (!concurrent) {
            throw new NotFoundException('Документ руху майна не знайдено');
          }
          this.assertMvoOwnSource(actor, concurrent.sourceResponsiblePersonId);
          if (concurrent.status === StockDocumentStatus.CANCELLED) return false;
          this.assertCancellationExportAllowed(concurrent);
          throw new BadRequestException(
            'Скасувати можна лише проведений документ',
          );
        }

        const document = await tx.stockDocument.findUnique({
          where: { id },
          include: { lines: { include: { transactions: true } } },
        });
        if (!document) {
          throw new NotFoundException('Документ руху майна не знайдено');
        }
        this.assertMvoOwnSource(actor, document.sourceResponsiblePersonId);

        for (const line of document.lines) {
          await this.reverseLine(tx, document, line);
        }
        await tx.stockDocument.update({
          where: { id },
          data: {
            status: StockDocumentStatus.CANCELLED,
            cancelledByUserId: actor.id,
            cancelledAt: new Date(),
          },
        });
        await this.auditInTx(
          tx,
          actor,
          id,
          'CANCEL',
          StockDocumentStatus.CANCELLED,
          true,
          context,
        );
        return true;
      });
      if (!cancelled) return this.findOne(id, actor);
    } catch (error) {
      await this.audit(actor, id, 'CANCEL', 'FAILED', false, context, error);
      throw error;
    }
    return this.findOne(id, actor);
  }

  private assertCancellationExportAllowed(document: {
    type: StockDocumentType;
    accountingExportState: AccountingExportState;
  }) {
    if (
      document.type === StockDocumentType.MVO_TRANSFER &&
      document.accountingExportState === AccountingExportState.EXPORTED
    ) {
      throw new ConflictException(
        'Передачу вже передано бухгалтерії. Звичайне скасування неможливе.',
      );
    }
  }

  private async postLine(
    tx: Prisma.TransactionClient,
    document: PostingDocument,
    line: PostingLine,
  ) {
    if (document.type === StockDocumentType.MVO_TRANSFER) {
      await this.postDirectBalanceLine(
        tx,
        document,
        line,
        StockTransactionType.MVO_TRANSFER_OUT,
      );
      return;
    }
    if (
      document.type === StockDocumentType.ISSUE &&
      document.accountingModel === StockAccountingModel.DIRECT_BALANCE
    ) {
      await this.postDirectBalanceLine(
        tx,
        document,
        line,
        StockTransactionType.ISSUE_OUT,
      );
      return;
    }
    throw new BadRequestException(
      'Документ старої моделі доступний лише для перегляду',
    );
  }

  private async postDirectBalanceLine(
    tx: Prisma.TransactionClient,
    document: PostingDocument,
    line: PostingLine,
    type: StockTransactionType,
  ) {
    await this.assertDirectBalanceReference(
      tx,
      line,
      document.sourceResponsiblePersonId,
    );
    const transaction = await this.stockService.createDecreasingTransactionInTx(
      tx,
      {
        type,
        responsiblePersonId: document.sourceResponsiblePersonId,
        inventoryItemId: line.inventoryItemId,
        quantity: line.quantity,
        occurredAt: document.documentDate,
        sourceDocument: document.documentNumber,
        comment: document.basis,
        documentId: document.id,
        documentLineId: line.id,
        accountingModel: StockAccountingModel.DIRECT_BALANCE,
        bucketKind: StockSourceKind.DIRECT,
      },
    );
    await tx.stockDocumentLine.update({
      where: { id: line.id },
      data: {
        quantityBefore: transaction.balanceBefore,
        quantityAfter: transaction.balanceAfter,
      },
    });
  }

  private async reverseLine(
    tx: Prisma.TransactionClient,
    document: CancellationDocument,
    line: CancellationLine,
  ) {
    if (document.type === StockDocumentType.MVO_TRANSFER) {
      await this.reverseDirectBalanceLine(
        tx,
        document,
        line,
        StockTransactionType.MVO_TRANSFER_OUT,
        StockTransactionType.MVO_TRANSFER_REVERSAL,
        'Скасування передачі',
      );
      return;
    }
    if (
      document.type === StockDocumentType.ISSUE &&
      document.accountingModel === StockAccountingModel.DIRECT_BALANCE
    ) {
      await this.reverseDirectBalanceLine(
        tx,
        document,
        line,
        StockTransactionType.ISSUE_OUT,
        StockTransactionType.ISSUE_REVERSAL,
        'Скасування видачі',
      );
      return;
    }
    throw new BadRequestException(
      'Документ старої моделі доступний лише для перегляду',
    );
  }

  private async reverseDirectBalanceLine(
    tx: Prisma.TransactionClient,
    document: CancellationDocument,
    line: CancellationLine,
    originalType: StockTransactionType,
    reversalType: StockTransactionType,
    comment: string,
  ) {
    const original = this.transactionOfType(line, originalType);
    await this.stockService.createIncreasingTransactionInTx(tx, {
      type: reversalType,
      responsiblePersonId: document.sourceResponsiblePersonId,
      inventoryItemId: line.inventoryItemId,
      quantity: line.quantity,
      occurredAt: new Date(),
      sourceDocument: document.documentNumber,
      comment,
      documentId: document.id,
      documentLineId: line.id,
      accountingModel: StockAccountingModel.DIRECT_BALANCE,
      bucketKind: StockSourceKind.DIRECT,
      reversalOfTransactionId: original.id,
    });
  }

  private transactionOfType(
    line: CancellationLine,
    type: StockTransactionType,
  ) {
    const transaction = line.transactions.find((item) => item.type === type);
    if (!transaction) {
      throw new BadRequestException(
        'Історія рухів документа неповна; безпечне скасування неможливе',
      );
    }
    return transaction;
  }

  private async assertDirectBalanceReference(
    tx: Prisma.TransactionClient,
    line: PostingLine,
    sourceResponsiblePersonId: string,
  ) {
    if (!line.sourceBalanceId) {
      throw new BadRequestException(
        'Рядок документа не містить посилання на прямий залишок',
      );
    }
    const balance = await tx.stockBalance.findUnique({
      where: { id: line.sourceBalanceId },
      select: { responsiblePersonId: true, inventoryItemId: true },
    });
    if (
      !balance ||
      balance.responsiblePersonId !== sourceResponsiblePersonId ||
      balance.inventoryItemId !== line.inventoryItemId
    ) {
      throw new ForbiddenException(
        'Вибраний залишок не належить МВО-відправнику',
      );
    }
  }

  private async assertActiveTransferRecipient(
    client: PrismaService | Prisma.TransactionClient,
    type: StockDocumentType,
    sourceResponsiblePersonId: string,
    destinationResponsiblePersonId: string | null,
  ) {
    if (type !== StockDocumentType.MVO_TRANSFER) return;
    if (!destinationResponsiblePersonId) {
      throw new BadRequestException(
        'Для передачі обов’язково вкажіть МВО-одержувача',
      );
    }
    if (destinationResponsiblePersonId === sourceResponsiblePersonId) {
      throw new BadRequestException(
        'Відправник і одержувач не можуть бути одним МВО',
      );
    }
    const recipient = await client.responsiblePerson.findUnique({
      where: { id: destinationResponsiblePersonId },
      select: { id: true, isActive: true },
    });
    if (!recipient?.isActive) {
      throw new BadRequestException(
        'МВО-одержувача не знайдено або його деактивовано',
      );
    }
  }

  private validateDto(dto: CreateStockDocumentDto, actor: CurrentUser) {
    this.assertMvoOwnSource(actor, dto.sourceResponsiblePersonId);
    const isMvoTransfer = dto.type === StockDocumentType.MVO_TRANSFER;

    if (isMvoTransfer) {
      if (!dto.destinationResponsiblePersonId) {
        throw new BadRequestException(
          'Для передачі обов’язково вкажіть МВО-одержувача',
        );
      }
      if (dto.destinationResponsiblePersonId === dto.sourceResponsiblePersonId) {
        throw new BadRequestException(
          'Відправник і одержувач не можуть бути одним МВО',
        );
      }
      if (dto.recipientName || dto.recipientUnit) {
        throw new BadRequestException(
          'Зовнішній одержувач не використовується для передачі',
        );
      }
    } else {
      if (dto.destinationResponsiblePersonId) {
        throw new BadRequestException(
          'Для видачі МВО-одержувач повинен бути відсутній',
        );
      }
      if (!dto.recipientName?.trim()) {
        throw new BadRequestException(
          'Для видачі обов’язково вкажіть одержувача',
        );
      }
      if (!dto.basis?.trim()) {
        throw new BadRequestException(
          'Для видачі обов’язково вкажіть мету або підставу',
        );
      }
    }

    const seen = new Set<string>();
    const lines = dto.lines.map((line) => {
      if (!line.sourceBalanceId) {
        throw new BadRequestException(
          'Для кожного рядка виберіть прямий залишок МВО',
        );
      }
      const sourceKey = line.sourceBalanceId;
      if (seen.has(sourceKey)) {
        throw new BadRequestException(
          'Одне джерело майна не може дублюватися в документі',
        );
      }
      seen.add(sourceKey);
      const quantity = new Prisma.Decimal(line.quantity);
      if (quantity.lte(0)) {
        throw new BadRequestException(
          'Кількість у кожному рядку має бути додатною',
        );
      }

      return {
        inventoryItemId: line.inventoryItemId,
        quantity,
        sourceKind: null,
        accountingOwnerResponsiblePersonId: null,
        sourceCustodianResponsiblePersonId: null,
        sourceCustodyBalanceId: null,
        sourceBalanceId: line.sourceBalanceId,
        quantityBefore: null,
        quantityAfter: null,
        note: line.note?.trim() || null,
      };
    });

    return {
      accountingModel: StockAccountingModel.DIRECT_BALANCE,
      sourceResponsiblePersonId: dto.sourceResponsiblePersonId,
      destinationResponsiblePersonId:
        isMvoTransfer
          ? dto.destinationResponsiblePersonId
          : null,
      recipientName:
        dto.type === StockDocumentType.ISSUE
          ? dto.recipientName!.trim()
          : null,
      recipientUnit:
        dto.type === StockDocumentType.ISSUE
          ? dto.recipientUnit?.trim() || null
          : null,
      lines,
    };
  }

  private async stageAttachmentFiles(storagePaths: string[]) {
    const staged: StagedAttachmentFile[] = [];
    try {
      for (const storagePath of storagePaths) {
        staged.push(
          await this.attachmentStorage.stageForDeletion(storagePath),
        );
      }
      return staged;
    } catch (error) {
      await this.attachmentStorage.restoreStaged(staged);
      throw error;
    }
  }

  private assertCanWrite(actor: CurrentUser) {
    if (actor.role === UserRole.AUDITOR) {
      throw new ForbiddenException(
        'AUDITOR має доступ лише для перегляду',
      );
    }
    if (actor.role === UserRole.ACCOUNTANT) {
      throw new ForbiddenException(
        'ACCOUNTANT не може створювати, проводити або скасовувати документи руху',
      );
    }
  }

  private assertMvoOwnSource(actor: CurrentUser, sourceId: string) {
    if (
      actor.role === UserRole.MVO &&
      actor.responsiblePersonId !== sourceId
    ) {
      throw new ForbiddenException(
        'МВО може створювати документи лише від свого імені',
      );
    }
  }

  private assertReadAccess(
    actor: CurrentUser,
    document: {
      createdByUserId: string;
      sourceResponsiblePersonId: string;
    },
  ) {
    const responsiblePersonId = actor.responsiblePersonId;
    if (
      actor.role === UserRole.MVO &&
      actor.id !== document.createdByUserId &&
      responsiblePersonId !== document.sourceResponsiblePersonId
    ) {
      throw new NotFoundException('Документ руху майна не знайдено');
    }
  }

  private assertDraft(status: StockDocumentStatus) {
    if (status !== StockDocumentStatus.DRAFT) {
      throw new BadRequestException(
        'Змінювати або видаляти можна лише чернетку',
      );
    }
  }

  private assertNewDocumentType(type: StockDocumentType) {
    if (type !== StockDocumentType.MVO_TRANSFER && type !== StockDocumentType.ISSUE) {
      throw new BadRequestException(
        'Старі документи TRANSFER та ASSIGNMENT доступні лише для перегляду',
      );
    }
  }

  private assertMutableDocument(document: {
    type: StockDocumentType;
    accountingModel: StockAccountingModel | null;
  }) {
    this.assertNewDocumentType(document.type);
    if (document.accountingModel !== StockAccountingModel.DIRECT_BALANCE) {
      throw new BadRequestException(
        'Документ старої моделі доступний лише для перегляду',
      );
    }
  }

  private async findRaw(id: string) {
    const document = await this.prisma.stockDocument.findUnique({ where: { id } });
    if (!document) {
      throw new NotFoundException('Документ руху майна не знайдено');
    }
    return document;
  }

  private serialize(
    document: Prisma.StockDocumentGetPayload<{
      include: typeof documentInclude;
    }>,
  ) {
    return {
      ...document,
      lines: document.lines.map((line) => ({
        ...line,
        quantity: line.quantity.toString(),
        quantityBefore: line.quantityBefore?.toString() ?? null,
        quantityAfter: line.quantityAfter?.toString() ?? null,
      })),
      totalPositions: document.lines.length,
      totalQuantity: document.lines
        .reduce(
          (sum, line) => sum.plus(line.quantity),
          new Prisma.Decimal(0),
        )
        .toString(),
    };
  }

  private audit(
    actor: CurrentUser,
    documentId: string,
    action: string,
    status: string,
    success: boolean,
    context: AuditContext,
    error?: unknown,
  ) {
    return this.auditInTx(
      this.prisma,
      actor,
      documentId,
      action,
      status,
      success,
      context,
      error,
    );
  }

  private auditInTx(
    client: Pick<PrismaService, 'securityEvent'> | Prisma.TransactionClient,
    actor: CurrentUser,
    documentId: string,
    action: string,
    status: string,
    success: boolean,
    context: AuditContext,
    error?: unknown,
  ) {
    return client.securityEvent.create({
      data: {
        type: SecurityEventType.STOCK_DOCUMENT_ACTION,
        actorUserId: actor.id,
        requestId: context.requestId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        success,
        metadata: {
          documentId,
          action,
          status,
          result: success ? 'SUCCESS' : 'FAILURE',
          reason: error instanceof Error ? error.message : undefined,
        },
      },
    });
  }
}
