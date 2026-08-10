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
  type StoredAttachment,
  type StagedAttachmentFile,
  StockDocumentAttachmentStorageService,
} from './stock-document-attachment-storage.service';
import {
  CreateIssueDto,
  CreateMvoTransferDto,
  CreateStockDocumentDto,
  CreateTransferIssueDto,
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
      issueLines: {
        select: {
          quantity: true,
          document: { select: { status: true } },
        },
      },
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
  sourceTransfer: {
    select: {
      id: true,
      displayNumber: true,
      documentDate: true,
      status: true,
      sourceResponsiblePerson: true,
      destinationResponsiblePerson: true,
    },
  },
  issues: {
    include: {
      sourceResponsiblePerson: true,
      destinationResponsiblePerson: true,
      createdByUser: { select: { id: true, username: true, role: true } },
      postedByUser: { select: { id: true, username: true, role: true } },
      cancelledByUser: { select: { id: true, username: true, role: true } },
      lines: {
        include: { inventoryItem: true },
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
    },
    orderBy: [{ documentDate: 'desc' as const }, { createdAt: 'desc' as const }],
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
      sourceResponsiblePersonId: mvoId ?? query.sourceResponsiblePersonId,
      destinationResponsiblePersonId:
        actor.role === UserRole.MVO
          ? undefined
          : query.destinationResponsiblePersonId,
      documentDate: {
        gte: query.documentDateFrom
          ? new Date(query.documentDateFrom)
          : undefined,
        lte: query.documentDateTo ? new Date(query.documentDateTo) : undefined,
      },
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
    if (dto.type === StockDocumentType.MVO_TRANSFER) {
      throw new BadRequestException(
        'Нову передачу потрібно одразу підтвердити та провести',
      );
    }
    if (dto.type === StockDocumentType.ISSUE) {
      throw new BadRequestException(
        'Нову видачу потрібно одразу підтвердити та провести',
      );
    }
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

  async createAndPostMvoTransfer(
    dto: CreateMvoTransferDto,
    actor: CurrentUser,
    context: AuditContext,
  ) {
    this.assertCanWrite(actor);
    if (actor.role !== UserRole.MVO || !actor.responsiblePersonId) {
      throw new ForbiddenException(
        'Передачу може створити лише користувач із пов’язаною карткою МВО',
      );
    }
    const sourceResponsiblePersonId = actor.responsiblePersonId;

    const documentId = randomUUID();
    const normalized = this.validateDto(
      {
        ...dto,
        type: StockDocumentType.MVO_TRANSFER,
        sourceResponsiblePersonId,
      },
      actor,
    );
    const destinationResponsiblePersonId =
      normalized.destinationResponsiblePersonId;
    if (!destinationResponsiblePersonId) {
      throw new BadRequestException(
        'Для передачі обов’язково вкажіть МВО-одержувача',
      );
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await this.assertActiveMvoSender(
          tx,
          sourceResponsiblePersonId,
        );
        await this.assertActiveTransferRecipient(
          tx,
          StockDocumentType.MVO_TRANSFER,
          sourceResponsiblePersonId,
          destinationResponsiblePersonId,
        );
        const now = new Date();
        const document = await tx.stockDocument.create({
          data: {
            id: documentId,
            documentNumber: `MOV-${randomUUID().slice(0, 8).toUpperCase()}`,
            documentDate: new Date(dto.documentDate),
            type: StockDocumentType.MVO_TRANSFER,
            accountingModel: StockAccountingModel.DIRECT_BALANCE,
            status: StockDocumentStatus.POSTED,
            sourceResponsiblePersonId,
            destinationResponsiblePersonId,
            recipientName: null,
            recipientUnit: null,
            basis: null,
            note: dto.note?.trim() || null,
            createdByUserId: actor.id,
            postedByUserId: actor.id,
            postedAt: now,
            lines: { create: normalized.lines },
          },
          include: {
            lines: true,
            attachments: { select: { id: true, storagePath: true } },
          },
        });

        for (const line of document.lines) {
          await this.postLine(tx, document, line);
        }
        await this.auditInTx(
          tx,
          actor,
          documentId,
          'CREATE',
          StockDocumentStatus.POSTED,
          true,
          context,
        );
        await this.auditInTx(
          tx,
          actor,
          documentId,
          'POST',
          StockDocumentStatus.POSTED,
          true,
          context,
        );
      });
    } catch (error) {
      await this.audit(
        actor,
        documentId,
        'CREATE_AND_POST',
        'FAILED',
        false,
        context,
        error,
      );
      throw error;
    }

    return this.findOne(documentId, actor);
  }

  async createAndPostIssue(
    _dto: CreateIssueDto,
    _files: Express.Multer.File[],
    _actor: CurrentUser,
    _context: AuditContext,
  ): Promise<{ status: StockDocumentStatus; displayNumber: number }> {
    void _dto;
    void _files;
    void _actor;
    void _context;
    throw new BadRequestException(
      'Нову видачу можна оформити лише з власної проведеної передачі',
    );
  }

  async createAndPostTransferIssue(
    transferId: string,
    dto: CreateTransferIssueDto,
    files: Express.Multer.File[],
    actor: CurrentUser,
    context: AuditContext,
  ) {
    this.assertCanWrite(actor);
    if (actor.role !== UserRole.MVO || !actor.responsiblePersonId) {
      throw new ForbiddenException(
        'Видачу може створити лише МВО-відправник проведеної передачі',
      );
    }
    if (!dto.recipientName?.trim()) {
      throw new BadRequestException('Для видачі обов’язково вкажіть одержувача');
    }
    if (!Array.isArray(dto.lines) || dto.lines.length === 0) {
      throw new BadRequestException(
        'Документ повинен містити щонайменше одну позицію',
      );
    }
    if (!files.length) {
      throw new BadRequestException(
        'Для видачі додайте хоча б одне фото або скан накладної',
      );
    }

    const normalizedLines = this.normalizeTransferIssueLines(dto.lines);
    const documentId = randomUUID();
    const storedAttachments: StoredAttachment[] = [];

    try {
      for (const file of files) {
        storedAttachments.push(await this.attachmentStorage.store(file));
      }
      await this.attachmentStorage.assertStoredFilesExist(
        storedAttachments.map((attachment) => attachment.storagePath),
      );

      await this.prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`
            SELECT "id"
            FROM "StockDocument"
            WHERE "id" = ${transferId}::uuid
            FOR UPDATE
          `;
          const transfer = await tx.stockDocument.findUnique({
            where: { id: transferId },
            include: { lines: true },
          });
          if (!transfer) {
            throw new NotFoundException('Передачу не знайдено');
          }
          if (
            transfer.type !== StockDocumentType.MVO_TRANSFER ||
            transfer.status !== StockDocumentStatus.POSTED
          ) {
            throw new ConflictException(
              'Видачу можна оформити лише з проведеної передачі',
            );
          }
          if (transfer.sourceResponsiblePersonId !== actor.responsiblePersonId) {
            throw new ForbiddenException(
              'Видачу може оформити лише МВО-відправник цієї передачі',
            );
          }
          await this.assertActiveMvoSender(
            tx,
            transfer.sourceResponsiblePersonId,
          );

          const transferLines = new Map(
            transfer.lines.map((line) => [line.id, line]),
          );
          const sourceLineIds = normalizedLines.map(
            (line) => line.sourceTransferLineId,
          );
          const issued = await tx.stockDocumentLine.groupBy({
            by: ['sourceTransferLineId'],
            where: {
              sourceTransferLineId: { in: sourceLineIds },
              document: {
                type: StockDocumentType.ISSUE,
                status: StockDocumentStatus.POSTED,
              },
            },
            _sum: { quantity: true },
          });
          const issuedByLine = new Map(
            issued.map((entry) => [
              entry.sourceTransferLineId,
              entry._sum.quantity ?? new Prisma.Decimal(0),
            ]),
          );

          const issueLines = normalizedLines.map((requested) => {
            const sourceLine = transferLines.get(requested.sourceTransferLineId);
            if (!sourceLine) {
              throw new BadRequestException(
                'Вибрана позиція не належить цій передачі',
              );
            }
            const available = sourceLine.quantity.minus(
              issuedByLine.get(sourceLine.id) ?? new Prisma.Decimal(0),
            );
            if (requested.quantity.gt(available)) {
              throw new ConflictException(
                'Недостатня кількість, доступна для оформлення видачі',
              );
            }
            return {
              inventoryItemId: sourceLine.inventoryItemId,
              sourceTransferLineId: sourceLine.id,
              sourceBalanceId: null,
              sourceKind: null,
              accountingOwnerResponsiblePersonId: null,
              sourceCustodianResponsiblePersonId: null,
              sourceCustodyBalanceId: null,
              quantityBefore: null,
              quantityAfter: null,
              quantity: requested.quantity,
              note: requested.note,
            };
          });

          const now = new Date();
          const issue = await tx.stockDocument.create({
            data: {
              id: documentId,
              documentNumber: `MOV-${randomUUID().slice(0, 8).toUpperCase()}`,
              documentDate: new Date(dto.documentDate),
              type: StockDocumentType.ISSUE,
              accountingModel: StockAccountingModel.DIRECT_BALANCE,
              status: StockDocumentStatus.POSTED,
              sourceTransferId: transfer.id,
              sourceResponsiblePersonId: transfer.sourceResponsiblePersonId,
              destinationResponsiblePersonId: null,
              recipientName: dto.recipientName.trim(),
              recipientUnit: dto.recipientUnit?.trim() || null,
              basis: dto.basis?.trim() || null,
              note: dto.note?.trim() || null,
              createdByUserId: actor.id,
              postedByUserId: actor.id,
              postedAt: now,
              lines: { create: issueLines },
              attachments: {
                create: storedAttachments.map((attachment) => ({
                  ...attachment,
                  uploadedByUserId: actor.id,
                })),
              },
            },
            include: { lines: true },
          });

          for (const line of issue.lines) {
            await this.createDocumentaryIssueTransaction(tx, issue, line);
          }
          await this.auditInTx(
            tx,
            actor,
            documentId,
            'CREATE',
            StockDocumentStatus.POSTED,
            true,
            context,
          );
          await this.auditInTx(
            tx,
            actor,
            documentId,
            'POST',
            StockDocumentStatus.POSTED,
            true,
            context,
          );
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      let cleanupError: unknown;
      for (const attachment of [...storedAttachments].reverse()) {
        try {
          await this.attachmentStorage.removeAfterMetadataFailure(
            attachment.storagePath,
          );
        } catch (reason) {
          cleanupError ??= reason;
        }
      }
      await this.audit(
        actor,
        documentId,
        'CREATE_AND_POST',
        'FAILED',
        false,
        context,
        error,
      );
      throw cleanupError ?? error;
    }

    return this.findOne(documentId, actor);
  }

  async update(
    id: string,
    dto: UpdateStockDocumentDto,
    actor: CurrentUser,
    context: AuditContext,
  ) {
    this.assertCanWrite(actor);
    const current = await this.findRaw(id);
    this.assertDraftWorkflowDocument(current);
    this.assertNewDocumentType(dto.type);
    if (dto.type !== current.type) {
      throw new BadRequestException('Тип документа не можна змінювати');
    }
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
    this.assertDraftWorkflowDocument(document);
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
            sourceTransferId: true,
          },
        });
        if (!current) {
          throw new NotFoundException('Документ руху майна не знайдено');
        }
        this.assertMvoOwnSource(actor, current.sourceResponsiblePersonId);
        this.assertDraftWorkflowDocument(current);
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
        await tx.$queryRaw`
          SELECT "id"
          FROM "StockDocument"
          WHERE "id" = ${id}::uuid
          FOR UPDATE
        `;
        const current = await tx.stockDocument.findUnique({
          where: { id },
          select: {
            type: true,
            accountingModel: true,
            accountingExportState: true,
            status: true,
            sourceResponsiblePersonId: true,
            sourceTransferId: true,
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
        if (current.type === StockDocumentType.MVO_TRANSFER) {
          const activeIssues = await tx.stockDocument.count({
            where: {
              sourceTransferId: id,
              type: StockDocumentType.ISSUE,
              status: StockDocumentStatus.POSTED,
            },
          });
          if (activeIssues > 0) {
            throw new ConflictException(
              'Передачу неможливо скасувати, оскільки з переданого майна вже оформлено видачу.',
            );
          }
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
              sourceTransferId: true,
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

  private async createDocumentaryIssueTransaction(
    tx: Prisma.TransactionClient,
    document: {
      id: string;
      documentNumber: string;
      documentDate: Date;
      sourceResponsiblePersonId: string;
      basis: string | null;
      note: string | null;
    },
    line: { id: string; inventoryItemId: string; quantity: Prisma.Decimal },
  ) {
    const balance = await tx.stockBalance.findUnique({
      where: {
        responsiblePersonId_inventoryItemId: {
          responsiblePersonId: document.sourceResponsiblePersonId,
          inventoryItemId: line.inventoryItemId,
        },
      },
      select: { quantity: true },
    });
    const unchangedBalance = balance?.quantity ?? new Prisma.Decimal(0);
    await tx.stockDocumentLine.update({
      where: { id: line.id },
      data: {
        quantityBefore: unchangedBalance,
        quantityAfter: unchangedBalance,
      },
    });
    await tx.stockTransaction.create({
      data: {
        type: StockTransactionType.ISSUE_OUT,
        responsiblePersonId: document.sourceResponsiblePersonId,
        inventoryItemId: line.inventoryItemId,
        quantity: line.quantity,
        balanceBefore: unchangedBalance,
        balanceAfter: unchangedBalance,
        occurredAt: document.documentDate,
        sourceDocument: document.documentNumber,
        comment: document.basis ?? document.note,
        documentId: document.id,
        documentLineId: line.id,
        accountingModel: StockAccountingModel.DIRECT_BALANCE,
        bucketKind: null,
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
      document.sourceTransferId
    ) {
      await this.reverseDocumentaryIssueLine(tx, document, line);
      return;
    }
    throw new BadRequestException(
      'Документ старої моделі доступний лише для перегляду',
    );
  }

  private async reverseDocumentaryIssueLine(
    tx: Prisma.TransactionClient,
    document: CancellationDocument,
    line: CancellationLine,
  ) {
    const original = this.transactionOfType(
      line,
      StockTransactionType.ISSUE_OUT,
    );
    const balance = await tx.stockBalance.findUnique({
      where: {
        responsiblePersonId_inventoryItemId: {
          responsiblePersonId: document.sourceResponsiblePersonId,
          inventoryItemId: line.inventoryItemId,
        },
      },
      select: { quantity: true },
    });
    const unchangedBalance = balance?.quantity ?? new Prisma.Decimal(0);
    await tx.stockTransaction.create({
      data: {
        type: StockTransactionType.ISSUE_REVERSAL,
        responsiblePersonId: document.sourceResponsiblePersonId,
        inventoryItemId: line.inventoryItemId,
        quantity: line.quantity,
        balanceBefore: unchangedBalance,
        balanceAfter: unchangedBalance,
        occurredAt: new Date(),
        sourceDocument: document.documentNumber,
        comment: 'Скасування видачі з передачі',
        documentId: document.id,
        documentLineId: line.id,
        accountingModel: StockAccountingModel.DIRECT_BALANCE,
        bucketKind: null,
        reversalOfTransactionId: original.id,
      },
    });
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
      select: { id: true, isActive: true, externalAccountingCode: true },
    });
    if (!recipient?.isActive) {
      throw new BadRequestException(
        'МВО-одержувача не знайдено або його деактивовано',
      );
    }
    if (!/^\d{4}$/.test(recipient.externalAccountingCode ?? '')) {
      throw new BadRequestException(
        'МВО-одержувач не має дійсного бухгалтерського коду',
      );
    }
  }

  private async assertActiveMvoSender(
    client: PrismaService | Prisma.TransactionClient,
    sourceResponsiblePersonId: string,
  ) {
    const sender = await client.responsiblePerson.findUnique({
      where: { id: sourceResponsiblePersonId },
      select: { id: true, isActive: true },
    });
    if (!sender?.isActive) {
      throw new ForbiddenException(
        'Картку МВО-відправника не знайдено або її деактивовано',
      );
    }
  }

  private validateDto(
    dto: CreateStockDocumentDto,
    actor: CurrentUser,
    options: { requireIssueBasis?: boolean } = {},
  ) {
    this.assertMvoOwnSource(actor, dto.sourceResponsiblePersonId);
    const isMvoTransfer = dto.type === StockDocumentType.MVO_TRANSFER;

    if (!Array.isArray(dto.lines) || dto.lines.length === 0) {
      throw new BadRequestException(
        'Документ повинен містити щонайменше одну позицію',
      );
    }

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
      if (options.requireIssueBasis !== false && !dto.basis?.trim()) {
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
      let quantity: Prisma.Decimal;
      try {
        quantity = new Prisma.Decimal(line.quantity);
      } catch {
        throw new BadRequestException(
          'Кількість у кожному рядку має бути коректним числом',
        );
      }
      if (!quantity.isFinite()) {
        throw new BadRequestException(
          'Кількість у кожному рядку має бути коректним числом',
        );
      }
      if (quantity.lte(0)) {
        throw new BadRequestException(
          'Кількість у кожному рядку має бути додатною',
        );
      }
      if (
        quantity.decimalPlaces() > 4 ||
        quantity.gt(new Prisma.Decimal('99999999999999.9999'))
      ) {
        throw new BadRequestException(
          'Кількість підтримує не більше 4 знаків після коми та 14 знаків до коми',
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

  private normalizeTransferIssueLines(
    lines: CreateTransferIssueDto['lines'],
  ) {
    const seen = new Set<string>();
    return lines.map((line) => {
      if (seen.has(line.sourceTransferLineId)) {
        throw new BadRequestException(
          'Один рядок передачі не можна додавати до видачі двічі',
        );
      }
      seen.add(line.sourceTransferLineId);
      let quantity: Prisma.Decimal;
      try {
        quantity = new Prisma.Decimal(line.quantity);
      } catch {
        throw new BadRequestException(
          'Кількість у кожному рядку має бути коректним числом',
        );
      }
      if (
        !quantity.isFinite() ||
        quantity.lte(0) ||
        quantity.decimalPlaces() > 4 ||
        quantity.gt(new Prisma.Decimal('99999999999999.9999'))
      ) {
        throw new BadRequestException(
          'Кількість у кожному рядку має бути додатною і містити не більше 4 знаків після коми',
        );
      }
      return {
        sourceTransferLineId: line.sourceTransferLineId,
        quantity,
        note: line.note?.trim() || null,
      };
    });
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
      sourceResponsiblePersonId: string;
    },
  ) {
    const responsiblePersonId = actor.responsiblePersonId;
    if (
      actor.role === UserRole.MVO &&
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
    sourceTransferId?: string | null;
  }) {
    this.assertNewDocumentType(document.type);
    if (document.accountingModel !== StockAccountingModel.DIRECT_BALANCE) {
      throw new BadRequestException(
        'Документ старої моделі доступний лише для перегляду',
      );
    }
    if (
      document.type === StockDocumentType.ISSUE &&
      !document.sourceTransferId
    ) {
      throw new BadRequestException(
        'Видача старої моделі доступна лише для перегляду',
      );
    }
  }

  private assertDraftWorkflowDocument(document: {
    type: StockDocumentType;
    accountingModel: StockAccountingModel | null;
    sourceTransferId?: string | null;
  }) {
    this.assertMutableDocument(document);
    if (document.type === StockDocumentType.ISSUE) {
      throw new BadRequestException(
        'Видача з передачі створюється і проводиться однією операцією без чернетки',
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
    const serializedLines = document.lines.map((line) => {
      const issuedQuantity = (line.issueLines ?? [])
        .filter(
          (issueLine) =>
            issueLine.document.status === StockDocumentStatus.POSTED,
        )
        .reduce(
          (sum, issueLine) => sum.plus(issueLine.quantity),
          new Prisma.Decimal(0),
        );
      return {
        ...line,
        quantity: line.quantity.toString(),
        quantityBefore: line.quantityBefore?.toString() ?? null,
        quantityAfter: line.quantityAfter?.toString() ?? null,
        issuedQuantity:
          document.type === StockDocumentType.MVO_TRANSFER
            ? issuedQuantity.toString()
            : null,
        availableToIssue:
          document.type === StockDocumentType.MVO_TRANSFER
            ? Prisma.Decimal.max(
                line.quantity.minus(issuedQuantity),
                new Prisma.Decimal(0),
              ).toString()
            : null,
        issueLines: undefined,
      };
    });
    return {
      ...document,
      lines: serializedLines,
      issues: (document.issues ?? []).map((issue) => ({
        ...issue,
        lines: issue.lines.map((line) => ({
          ...line,
          quantity: line.quantity.toString(),
          quantityBefore: line.quantityBefore?.toString() ?? null,
          quantityAfter: line.quantityAfter?.toString() ?? null,
        })),
        totalPositions: issue.lines.length,
        totalQuantity: issue.lines
          .reduce(
            (sum, line) => sum.plus(line.quantity),
            new Prisma.Decimal(0),
          )
          .toString(),
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
