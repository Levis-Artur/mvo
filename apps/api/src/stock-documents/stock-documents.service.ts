import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  SecurityEventType,
  StockDocumentStatus,
  StockDocumentType,
  StockTransactionType,
  UserRole,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { CurrentUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../stock/stock.service';
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
    include: { inventoryItem: true },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.StockDocumentInclude;

@Injectable()
export class StockDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
  ) {}

  async list(query: ListStockDocumentsQueryDto, actor: CurrentUser) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const mvoId = actor.role === UserRole.MVO
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
            { sourceResponsiblePersonId: mvoId },
            { destinationResponsiblePersonId: mvoId },
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
    if (!document) throw new NotFoundException('Документ руху майна не знайдено');
    this.assertReadAccess(actor, document);
    return this.serialize(document);
  }

  async create(
    dto: CreateStockDocumentDto,
    actor: CurrentUser,
    context: AuditContext,
  ) {
    this.assertCanWrite(actor);
    const normalized = this.validateDto(dto, actor);
    const document = await this.prisma.stockDocument.create({
      data: {
        documentNumber:
          dto.documentNumber?.trim() ??
          `MOV-${randomUUID().slice(0, 8).toUpperCase()}`,
        documentDate: new Date(dto.documentDate),
        type: dto.type,
        sourceResponsiblePersonId: normalized.sourceResponsiblePersonId,
        destinationResponsiblePersonId: normalized.destinationResponsiblePersonId,
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
    this.assertDraft(current.status);
    this.assertMvoOwnSource(actor, current.sourceResponsiblePersonId);
    const normalized = this.validateDto(dto, actor);
    const document = await this.prisma.$transaction(async (tx) => {
      await tx.stockDocumentLine.deleteMany({ where: { documentId: id } });
      return tx.stockDocument.update({
        where: { id },
        data: {
          documentNumber: dto.documentNumber?.trim() ?? current.documentNumber,
          documentDate: new Date(dto.documentDate),
          type: dto.type,
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
    this.assertDraft(document.status);
    this.assertMvoOwnSource(actor, document.sourceResponsiblePersonId);
    await this.prisma.stockDocument.delete({ where: { id } });
    await this.audit(actor, id, 'DELETE', document.status, true, context);
    return { deleted: true, id };
  }

  async post(id: string, actor: CurrentUser, context: AuditContext) {
    this.assertCanWrite(actor);
    try {
      await this.prisma.$transaction(async (tx) => {
        const document = await tx.stockDocument.findUnique({
          where: { id },
          include: { lines: true },
        });
        if (!document) throw new NotFoundException('Документ руху майна не знайдено');
        this.assertDraft(document.status);
        this.assertMvoOwnSource(actor, document.sourceResponsiblePersonId);
        if (!document.lines.length) {
          throw new BadRequestException('Документ повинен містити хоча б один рядок');
        }

        for (const line of document.lines) {
          await this.stockService.createDecreasingTransactionInTx(tx, {
            type:
              document.type === StockDocumentType.TRANSFER
                ? StockTransactionType.TRANSFER_OUT
                : StockTransactionType.ISSUE,
            responsiblePersonId: document.sourceResponsiblePersonId,
            inventoryItemId: line.inventoryItemId,
            quantity: line.quantity,
            occurredAt: document.documentDate,
            sourceDocument: document.documentNumber,
            comment: document.basis,
            documentId: id,
            documentLineId: line.id,
          });
          if (document.type === StockDocumentType.TRANSFER) {
            await this.stockService.createIncreasingTransactionInTx(tx, {
              type: StockTransactionType.TRANSFER_IN,
              responsiblePersonId: document.destinationResponsiblePersonId!,
              inventoryItemId: line.inventoryItemId,
              quantity: line.quantity,
              occurredAt: document.documentDate,
              sourceDocument: document.documentNumber,
              comment: document.basis,
              documentId: id,
              documentLineId: line.id,
            });
          }
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
      });
    } catch (error) {
      await this.audit(actor, id, 'POST', 'FAILED', false, context, error);
      throw error;
    }
    return this.findOne(id, actor);
  }

  async cancel(id: string, actor: CurrentUser, context: AuditContext) {
    this.assertCanWrite(actor);
    try {
      await this.prisma.$transaction(async (tx) => {
        const document = await tx.stockDocument.findUnique({
          where: { id },
          include: { lines: true },
        });
        if (!document) throw new NotFoundException('Документ руху майна не знайдено');
        if (document.status !== StockDocumentStatus.POSTED) {
          throw new BadRequestException('Скасувати можна лише проведений документ');
        }
        this.assertMvoOwnSource(actor, document.sourceResponsiblePersonId);

        for (const line of document.lines) {
          if (document.type === StockDocumentType.TRANSFER) {
            await this.stockService.createDecreasingTransactionInTx(tx, {
              type: StockTransactionType.TRANSFER_REVERSAL_OUT,
              responsiblePersonId: document.destinationResponsiblePersonId!,
              inventoryItemId: line.inventoryItemId,
              quantity: line.quantity,
              occurredAt: new Date(),
              sourceDocument: document.documentNumber,
              comment: 'Скасування передачі',
              documentId: id,
              documentLineId: line.id,
            });
          }
          await this.stockService.createIncreasingTransactionInTx(tx, {
            type:
              document.type === StockDocumentType.TRANSFER
                ? StockTransactionType.TRANSFER_REVERSAL_IN
                : StockTransactionType.ISSUE_REVERSAL,
            responsiblePersonId: document.sourceResponsiblePersonId,
            inventoryItemId: line.inventoryItemId,
            quantity: line.quantity,
            occurredAt: new Date(),
            sourceDocument: document.documentNumber,
            comment: 'Скасування документа',
            documentId: id,
            documentLineId: line.id,
          });
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
      });
    } catch (error) {
      await this.audit(actor, id, 'CANCEL', 'FAILED', false, context, error);
      throw error;
    }
    return this.findOne(id, actor);
  }

  private validateDto(dto: CreateStockDocumentDto, actor: CurrentUser) {
    this.assertMvoOwnSource(actor, dto.sourceResponsiblePersonId);
    if (dto.type === StockDocumentType.TRANSFER) {
      if (!dto.destinationResponsiblePersonId) {
        throw new BadRequestException('Для передачі обов’язково вкажіть МВО-одержувача');
      }
      if (dto.destinationResponsiblePersonId === dto.sourceResponsiblePersonId) {
        throw new BadRequestException('Відправник і одержувач не можуть бути одним МВО');
      }
      if (dto.recipientName || dto.recipientUnit) {
        throw new BadRequestException('Зовнішній одержувач не використовується для передачі');
      }
    } else {
      if (dto.destinationResponsiblePersonId) {
        throw new BadRequestException('Для видачі МВО-одержувач повинен бути відсутній');
      }
      if (!dto.recipientName?.trim()) {
        throw new BadRequestException('Для видачі обов’язково вкажіть одержувача');
      }
    }
    const seen = new Set<string>();
    const lines = dto.lines.map((line) => {
      if (seen.has(line.inventoryItemId)) {
        throw new BadRequestException('Номенклатура не може дублюватися в документі');
      }
      seen.add(line.inventoryItemId);
      const quantity = new Prisma.Decimal(line.quantity);
      if (quantity.lte(0)) {
        throw new BadRequestException('Кількість у кожному рядку має бути додатною');
      }
      return {
        inventoryItemId: line.inventoryItemId,
        quantity,
        note: line.note?.trim() || null,
      };
    });
    return {
      sourceResponsiblePersonId: dto.sourceResponsiblePersonId,
      destinationResponsiblePersonId:
        dto.type === StockDocumentType.TRANSFER
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

  private assertCanWrite(actor: CurrentUser) {
    if (actor.role === UserRole.AUDITOR) {
      throw new ForbiddenException('AUDITOR має доступ лише для перегляду');
    }
  }

  private assertMvoOwnSource(actor: CurrentUser, sourceId: string) {
    if (
      actor.role === UserRole.MVO &&
      actor.responsiblePersonId !== sourceId
    ) {
      throw new ForbiddenException('МВО може створювати документи лише від свого імені');
    }
  }

  private assertReadAccess(
    actor: CurrentUser,
    document: {
      sourceResponsiblePersonId: string;
      destinationResponsiblePersonId: string | null;
    },
  ) {
    if (
      actor.role === UserRole.MVO &&
      actor.responsiblePersonId !== document.sourceResponsiblePersonId &&
      actor.responsiblePersonId !== document.destinationResponsiblePersonId
    ) {
      throw new NotFoundException('Документ руху майна не знайдено');
    }
  }

  private assertDraft(status: StockDocumentStatus) {
    if (status !== StockDocumentStatus.DRAFT) {
      throw new BadRequestException('Змінювати або видаляти можна лише чернетку');
    }
  }

  private async findRaw(id: string) {
    const document = await this.prisma.stockDocument.findUnique({ where: { id } });
    if (!document) throw new NotFoundException('Документ руху майна не знайдено');
    return document;
  }

  private serialize(
    document: Prisma.StockDocumentGetPayload<{ include: typeof documentInclude }>,
  ) {
    return {
      ...document,
      lines: document.lines.map((line) => ({
        ...line,
        quantity: line.quantity.toString(),
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
