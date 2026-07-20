import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
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
  assertValidStockSource,
  StockAccountingInvariantError,
} from '../stock/stock-accounting.domain';
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
} satisfies Prisma.StockDocumentInclude;

type PostingDocument = Prisma.StockDocumentGetPayload<{
  include: { lines: true };
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
            { sourceResponsiblePersonId: mvoId },
            { destinationResponsiblePersonId: mvoId },
            {
              lines: {
                some: { accountingOwnerResponsiblePersonId: mvoId },
              },
            },
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
    const normalized = this.validateDto(dto, actor);
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
    this.assertDraft(current.status);
    this.assertMvoOwnSource(actor, current.sourceResponsiblePersonId);
    const normalized = this.validateDto(dto, actor);
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
    this.assertDraft(document.status);
    this.assertMvoOwnSource(actor, document.sourceResponsiblePersonId);
    const deleted = await this.prisma.stockDocument.deleteMany({
      where: { id, status: StockDocumentStatus.DRAFT },
    });
    if (deleted.count !== 1) this.assertDraft(StockDocumentStatus.POSTED);
    await this.audit(actor, id, 'DELETE', document.status, true, context);
    return { deleted: true, id };
  }

  async post(id: string, actor: CurrentUser, context: AuditContext) {
    this.assertCanWrite(actor);
    try {
      const posted = await this.prisma.$transaction(async (tx) => {
        const claim = await tx.stockDocument.updateMany({
          where: { id, status: StockDocumentStatus.DRAFT },
          data: { updatedAt: new Date() },
        });
        if (claim.count === 0) {
          const current = await tx.stockDocument.findUnique({
            where: { id },
            select: { status: true, sourceResponsiblePersonId: true },
          });
          if (!current) {
            throw new NotFoundException('Документ руху майна не знайдено');
          }
          this.assertMvoOwnSource(actor, current.sourceResponsiblePersonId);
          if (current.status === StockDocumentStatus.POSTED) return false;
          this.assertDraft(current.status);
        }

        const document = await tx.stockDocument.findUnique({
          where: { id },
          include: { lines: true },
        });
        if (!document) {
          throw new NotFoundException('Документ руху майна не знайдено');
        }
        this.assertMvoOwnSource(actor, document.sourceResponsiblePersonId);
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
        const claim = await tx.stockDocument.updateMany({
          where: { id, status: StockDocumentStatus.POSTED },
          data: { updatedAt: new Date() },
        });
        if (claim.count === 0) {
          const current = await tx.stockDocument.findUnique({
            where: { id },
            select: { status: true, sourceResponsiblePersonId: true },
          });
          if (!current) {
            throw new NotFoundException('Документ руху майна не знайдено');
          }
          this.assertMvoOwnSource(actor, current.sourceResponsiblePersonId);
          if (current.status === StockDocumentStatus.CANCELLED) return false;
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

  private async postLine(
    tx: Prisma.TransactionClient,
    document: PostingDocument,
    line: PostingLine,
  ) {
    if (document.type === StockDocumentType.TRANSFER) {
      await this.postLegacyTransferLine(tx, document, line);
      return;
    }
    if (
      document.type === StockDocumentType.ISSUE &&
      document.accountingModel !== StockAccountingModel.OWNER_CUSTODY
    ) {
      await this.postLegacyIssueLine(tx, document, line);
      return;
    }
    if (document.type === StockDocumentType.ASSIGNMENT) {
      await this.postAssignmentLine(tx, document, line);
      return;
    }
    await this.postOwnerCustodyIssueLine(tx, document, line);
  }

  private async postLegacyTransferLine(
    tx: Prisma.TransactionClient,
    document: PostingDocument,
    line: PostingLine,
  ) {
    await this.stockService.createDecreasingTransactionInTx(tx, {
      type: StockTransactionType.TRANSFER_OUT,
      responsiblePersonId: document.sourceResponsiblePersonId,
      inventoryItemId: line.inventoryItemId,
      quantity: line.quantity,
      occurredAt: document.documentDate,
      sourceDocument: document.documentNumber,
      comment: document.basis,
      documentId: document.id,
      documentLineId: line.id,
    });
    await this.stockService.createIncreasingTransactionInTx(tx, {
      type: StockTransactionType.TRANSFER_IN,
      responsiblePersonId: document.destinationResponsiblePersonId!,
      inventoryItemId: line.inventoryItemId,
      quantity: line.quantity,
      occurredAt: document.documentDate,
      sourceDocument: document.documentNumber,
      comment: document.basis,
      documentId: document.id,
      documentLineId: line.id,
    });
  }

  private postLegacyIssueLine(
    tx: Prisma.TransactionClient,
    document: PostingDocument,
    line: PostingLine,
  ) {
    return this.stockService.createDecreasingTransactionInTx(tx, {
      type: StockTransactionType.ISSUE,
      responsiblePersonId: document.sourceResponsiblePersonId,
      inventoryItemId: line.inventoryItemId,
      quantity: line.quantity,
      occurredAt: document.documentDate,
      sourceDocument: document.documentNumber,
      comment: document.basis,
      documentId: document.id,
      documentLineId: line.id,
    });
  }

  private async postAssignmentLine(
    tx: Prisma.TransactionClient,
    document: PostingDocument,
    line: PostingLine,
  ) {
    const ownerId = line.accountingOwnerResponsiblePersonId!;
    const destinationId = document.destinationResponsiblePersonId!;
    await this.assertCustodyReference(tx, line, document.sourceResponsiblePersonId);

    if (line.sourceKind === StockSourceKind.DIRECT) {
      await this.stockService.createDecreasingTransactionInTx(tx, {
        type: StockTransactionType.ASSIGNMENT_OUT_DIRECT,
        responsiblePersonId: document.sourceResponsiblePersonId,
        inventoryItemId: line.inventoryItemId,
        quantity: line.quantity,
        occurredAt: document.documentDate,
        sourceDocument: document.documentNumber,
        comment: document.basis,
        documentId: document.id,
        documentLineId: line.id,
        accountingModel: StockAccountingModel.OWNER_CUSTODY,
        bucketKind: StockSourceKind.DIRECT,
        accountingOwnerResponsiblePersonId: ownerId,
        sourceCustodianResponsiblePersonId:
          document.sourceResponsiblePersonId,
        destinationCustodianResponsiblePersonId: destinationId,
      });
    } else {
      await this.stockService.createCustodyDecreasingTransactionInTx(tx, {
        type: StockTransactionType.ASSIGNMENT_OUT_CUSTODY,
        accountingOwnerResponsiblePersonId: ownerId,
        custodianResponsiblePersonId: document.sourceResponsiblePersonId,
        inventoryItemId: line.inventoryItemId,
        quantity: line.quantity,
        occurredAt: document.documentDate,
        sourceCustodianResponsiblePersonId:
          document.sourceResponsiblePersonId,
        destinationCustodianResponsiblePersonId: destinationId,
        sourceDocument: document.documentNumber,
        comment: document.basis,
        documentId: document.id,
        documentLineId: line.id,
      });
    }

    if (destinationId === ownerId) {
      await this.stockService.createIncreasingTransactionInTx(tx, {
        type: StockTransactionType.ASSIGNMENT_IN_DIRECT,
        responsiblePersonId: destinationId,
        inventoryItemId: line.inventoryItemId,
        quantity: line.quantity,
        occurredAt: document.documentDate,
        sourceDocument: document.documentNumber,
        comment: document.basis,
        documentId: document.id,
        documentLineId: line.id,
        accountingModel: StockAccountingModel.OWNER_CUSTODY,
        bucketKind: StockSourceKind.DIRECT,
        accountingOwnerResponsiblePersonId: ownerId,
        sourceCustodianResponsiblePersonId:
          document.sourceResponsiblePersonId,
        destinationCustodianResponsiblePersonId: destinationId,
      });
      return;
    }

    await this.stockService.createCustodyIncreasingTransactionInTx(tx, {
      type: StockTransactionType.ASSIGNMENT_IN_CUSTODY,
      accountingOwnerResponsiblePersonId: ownerId,
      custodianResponsiblePersonId: destinationId,
      inventoryItemId: line.inventoryItemId,
      quantity: line.quantity,
      occurredAt: document.documentDate,
      sourceCustodianResponsiblePersonId: document.sourceResponsiblePersonId,
      destinationCustodianResponsiblePersonId: destinationId,
      sourceDocument: document.documentNumber,
      comment: document.basis,
      documentId: document.id,
      documentLineId: line.id,
    });
  }

  private async postOwnerCustodyIssueLine(
    tx: Prisma.TransactionClient,
    document: PostingDocument,
    line: PostingLine,
  ) {
    const ownerId = line.accountingOwnerResponsiblePersonId!;
    await this.assertCustodyReference(tx, line, document.sourceResponsiblePersonId);
    if (line.sourceKind === StockSourceKind.DIRECT) {
      await this.stockService.createDecreasingTransactionInTx(tx, {
        type: StockTransactionType.ISSUE_FROM_DIRECT,
        responsiblePersonId: document.sourceResponsiblePersonId,
        inventoryItemId: line.inventoryItemId,
        quantity: line.quantity,
        occurredAt: document.documentDate,
        sourceDocument: document.documentNumber,
        comment: document.basis,
        documentId: document.id,
        documentLineId: line.id,
        accountingModel: StockAccountingModel.OWNER_CUSTODY,
        bucketKind: StockSourceKind.DIRECT,
        accountingOwnerResponsiblePersonId: ownerId,
        sourceCustodianResponsiblePersonId:
          document.sourceResponsiblePersonId,
      });
      return;
    }
    await this.stockService.createCustodyDecreasingTransactionInTx(tx, {
      type: StockTransactionType.ISSUE_FROM_CUSTODY,
      accountingOwnerResponsiblePersonId: ownerId,
      custodianResponsiblePersonId: document.sourceResponsiblePersonId,
      inventoryItemId: line.inventoryItemId,
      quantity: line.quantity,
      occurredAt: document.documentDate,
      sourceCustodianResponsiblePersonId: document.sourceResponsiblePersonId,
      sourceDocument: document.documentNumber,
      comment: document.basis,
      documentId: document.id,
      documentLineId: line.id,
    });
  }

  private async reverseLine(
    tx: Prisma.TransactionClient,
    document: CancellationDocument,
    line: CancellationLine,
  ) {
    if (document.type === StockDocumentType.TRANSFER) {
      await this.reverseLegacyTransferLine(tx, document, line);
      return;
    }
    if (
      document.type === StockDocumentType.ISSUE &&
      document.accountingModel !== StockAccountingModel.OWNER_CUSTODY
    ) {
      await this.reverseLegacyIssueLine(tx, document, line);
      return;
    }
    if (document.type === StockDocumentType.ASSIGNMENT) {
      await this.reverseAssignmentLine(tx, document, line);
      return;
    }
    await this.reverseOwnerCustodyIssueLine(tx, document, line);
  }

  private async reverseLegacyTransferLine(
    tx: Prisma.TransactionClient,
    document: CancellationDocument,
    line: CancellationLine,
  ) {
    await this.stockService.createDecreasingTransactionInTx(tx, {
      type: StockTransactionType.TRANSFER_REVERSAL_OUT,
      responsiblePersonId: document.destinationResponsiblePersonId!,
      inventoryItemId: line.inventoryItemId,
      quantity: line.quantity,
      occurredAt: new Date(),
      sourceDocument: document.documentNumber,
      comment: 'Скасування передачі',
      documentId: document.id,
      documentLineId: line.id,
    });
    await this.stockService.createIncreasingTransactionInTx(tx, {
      type: StockTransactionType.TRANSFER_REVERSAL_IN,
      responsiblePersonId: document.sourceResponsiblePersonId,
      inventoryItemId: line.inventoryItemId,
      quantity: line.quantity,
      occurredAt: new Date(),
      sourceDocument: document.documentNumber,
      comment: 'Скасування документа',
      documentId: document.id,
      documentLineId: line.id,
    });
  }

  private reverseLegacyIssueLine(
    tx: Prisma.TransactionClient,
    document: CancellationDocument,
    line: CancellationLine,
  ) {
    return this.stockService.createIncreasingTransactionInTx(tx, {
      type: StockTransactionType.ISSUE_REVERSAL,
      responsiblePersonId: document.sourceResponsiblePersonId,
      inventoryItemId: line.inventoryItemId,
      quantity: line.quantity,
      occurredAt: new Date(),
      sourceDocument: document.documentNumber,
      comment: 'Скасування документа',
      documentId: document.id,
      documentLineId: line.id,
    });
  }

  private async reverseAssignmentLine(
    tx: Prisma.TransactionClient,
    document: CancellationDocument,
    line: CancellationLine,
  ) {
    const ownerId = line.accountingOwnerResponsiblePersonId!;
    const destinationId = document.destinationResponsiblePersonId!;
    const destinationIsOwner = destinationId === ownerId;
    const incoming = this.transactionOfType(
      line,
      destinationIsOwner
        ? StockTransactionType.ASSIGNMENT_IN_DIRECT
        : StockTransactionType.ASSIGNMENT_IN_CUSTODY,
    );
    const outgoing = this.transactionOfType(
      line,
      line.sourceKind === StockSourceKind.DIRECT
        ? StockTransactionType.ASSIGNMENT_OUT_DIRECT
        : StockTransactionType.ASSIGNMENT_OUT_CUSTODY,
    );

    if (destinationIsOwner) {
      await this.stockService.createDecreasingTransactionInTx(tx, {
        type: StockTransactionType.ASSIGNMENT_REVERSAL,
        responsiblePersonId: destinationId,
        inventoryItemId: line.inventoryItemId,
        quantity: line.quantity,
        occurredAt: new Date(),
        sourceDocument: document.documentNumber,
        comment: 'Скасування передачі',
        documentId: document.id,
        documentLineId: line.id,
        accountingModel: StockAccountingModel.OWNER_CUSTODY,
        bucketKind: StockSourceKind.DIRECT,
        accountingOwnerResponsiblePersonId: ownerId,
        sourceCustodianResponsiblePersonId: destinationId,
        destinationCustodianResponsiblePersonId:
          document.sourceResponsiblePersonId,
        reversalOfTransactionId: incoming.id,
      });
    } else {
      await this.stockService.createCustodyDecreasingTransactionInTx(tx, {
        type: StockTransactionType.ASSIGNMENT_REVERSAL,
        accountingOwnerResponsiblePersonId: ownerId,
        custodianResponsiblePersonId: destinationId,
        inventoryItemId: line.inventoryItemId,
        quantity: line.quantity,
        occurredAt: new Date(),
        sourceCustodianResponsiblePersonId: destinationId,
        destinationCustodianResponsiblePersonId:
          document.sourceResponsiblePersonId,
        sourceDocument: document.documentNumber,
        comment: 'Скасування передачі',
        documentId: document.id,
        documentLineId: line.id,
        reversalOfTransactionId: incoming.id,
      });
    }

    if (line.sourceKind === StockSourceKind.DIRECT) {
      await this.stockService.createIncreasingTransactionInTx(tx, {
        type: StockTransactionType.ASSIGNMENT_REVERSAL,
        responsiblePersonId: document.sourceResponsiblePersonId,
        inventoryItemId: line.inventoryItemId,
        quantity: line.quantity,
        occurredAt: new Date(),
        sourceDocument: document.documentNumber,
        comment: 'Скасування передачі',
        documentId: document.id,
        documentLineId: line.id,
        accountingModel: StockAccountingModel.OWNER_CUSTODY,
        bucketKind: StockSourceKind.DIRECT,
        accountingOwnerResponsiblePersonId: ownerId,
        sourceCustodianResponsiblePersonId: destinationId,
        destinationCustodianResponsiblePersonId:
          document.sourceResponsiblePersonId,
        reversalOfTransactionId: outgoing.id,
      });
      return;
    }

    await this.stockService.createCustodyIncreasingTransactionInTx(tx, {
      type: StockTransactionType.ASSIGNMENT_REVERSAL,
      accountingOwnerResponsiblePersonId: ownerId,
      custodianResponsiblePersonId: document.sourceResponsiblePersonId,
      inventoryItemId: line.inventoryItemId,
      quantity: line.quantity,
      occurredAt: new Date(),
      sourceCustodianResponsiblePersonId: destinationId,
      destinationCustodianResponsiblePersonId:
        document.sourceResponsiblePersonId,
      sourceDocument: document.documentNumber,
      comment: 'Скасування передачі',
      documentId: document.id,
      documentLineId: line.id,
      reversalOfTransactionId: outgoing.id,
    });
  }

  private async reverseOwnerCustodyIssueLine(
    tx: Prisma.TransactionClient,
    document: CancellationDocument,
    line: CancellationLine,
  ) {
    const ownerId = line.accountingOwnerResponsiblePersonId!;
    const original = this.transactionOfType(
      line,
      line.sourceKind === StockSourceKind.DIRECT
        ? StockTransactionType.ISSUE_FROM_DIRECT
        : StockTransactionType.ISSUE_FROM_CUSTODY,
    );
    if (line.sourceKind === StockSourceKind.DIRECT) {
      await this.stockService.createIncreasingTransactionInTx(tx, {
        type: StockTransactionType.ISSUE_REVERSAL,
        responsiblePersonId: document.sourceResponsiblePersonId,
        inventoryItemId: line.inventoryItemId,
        quantity: line.quantity,
        occurredAt: new Date(),
        sourceDocument: document.documentNumber,
        comment: 'Скасування видачі',
        documentId: document.id,
        documentLineId: line.id,
        accountingModel: StockAccountingModel.OWNER_CUSTODY,
        bucketKind: StockSourceKind.DIRECT,
        accountingOwnerResponsiblePersonId: ownerId,
        reversalOfTransactionId: original.id,
      });
      return;
    }
    await this.stockService.createCustodyIncreasingTransactionInTx(tx, {
      type: StockTransactionType.ISSUE_REVERSAL,
      accountingOwnerResponsiblePersonId: ownerId,
      custodianResponsiblePersonId: document.sourceResponsiblePersonId,
      inventoryItemId: line.inventoryItemId,
      quantity: line.quantity,
      occurredAt: new Date(),
      sourceCustodianResponsiblePersonId:
        document.sourceResponsiblePersonId,
      sourceDocument: document.documentNumber,
      comment: 'Скасування видачі',
      documentId: document.id,
      documentLineId: line.id,
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

  private async assertCustodyReference(
    tx: Prisma.TransactionClient,
    line: PostingLine,
    sourceResponsiblePersonId: string,
  ) {
    if (
      line.sourceKind !== StockSourceKind.ASSIGNED ||
      !line.sourceCustodyBalanceId
    ) {
      return;
    }
    const balance = await tx.custodyBalance.findUnique({
      where: { id: line.sourceCustodyBalanceId },
      select: {
        inventoryItemId: true,
        accountingOwnerResponsiblePersonId: true,
        custodianResponsiblePersonId: true,
      },
    });
    if (
      !balance ||
      balance.inventoryItemId !== line.inventoryItemId ||
      balance.accountingOwnerResponsiblePersonId !==
        line.accountingOwnerResponsiblePersonId ||
      balance.custodianResponsiblePersonId !== sourceResponsiblePersonId
    ) {
      throw new BadRequestException(
        'Джерело закріпленого майна не відповідає рядку документа',
      );
    }
  }

  private validateDto(dto: CreateStockDocumentDto, actor: CurrentUser) {
    this.assertMvoOwnSource(actor, dto.sourceResponsiblePersonId);
    const isAssignment = dto.type === StockDocumentType.ASSIGNMENT;
    const isTransfer = dto.type === StockDocumentType.TRANSFER;
    const hasSourceMetadata = dto.lines.some(
      (line) =>
        line.sourceKind !== undefined ||
        line.accountingOwnerResponsiblePersonId !== undefined ||
        line.sourceCustodianResponsiblePersonId !== undefined ||
        line.sourceCustodyBalanceId !== undefined,
    );
    const usesOwnerCustody =
      isAssignment ||
      (dto.type === StockDocumentType.ISSUE && hasSourceMetadata);

    if (isAssignment || isTransfer) {
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
    }

    const seen = new Set<string>();
    const lines = dto.lines.map((line) => {
      if (seen.has(line.inventoryItemId)) {
        throw new BadRequestException(
          'Номенклатура не може дублюватися в документі',
        );
      }
      seen.add(line.inventoryItemId);
      const quantity = new Prisma.Decimal(line.quantity);
      if (quantity.lte(0)) {
        throw new BadRequestException(
          'Кількість у кожному рядку має бути додатною',
        );
      }

      if (usesOwnerCustody) {
        if (!line.sourceKind || !line.accountingOwnerResponsiblePersonId) {
          throw new BadRequestException(
            'Для кожного рядка вкажіть тип джерела та облікового власника',
          );
        }
        try {
          assertValidStockSource({
            sourceKind: line.sourceKind,
            sourceResponsiblePersonId: dto.sourceResponsiblePersonId,
            accountingOwnerResponsiblePersonId:
              line.accountingOwnerResponsiblePersonId,
            sourceCustodianResponsiblePersonId:
              line.sourceCustodianResponsiblePersonId,
            sourceCustodyBalanceId: line.sourceCustodyBalanceId,
          });
        } catch (error) {
          if (error instanceof StockAccountingInvariantError) {
            throw new BadRequestException(error.message);
          }
          throw error;
        }
      } else if (hasSourceMetadata) {
        throw new BadRequestException(
          'Legacy-документ не може частково містити дані нової моделі обліку',
        );
      }

      return {
        inventoryItemId: line.inventoryItemId,
        quantity,
        sourceKind: usesOwnerCustody ? line.sourceKind : null,
        accountingOwnerResponsiblePersonId: usesOwnerCustody
          ? line.accountingOwnerResponsiblePersonId
          : null,
        sourceCustodianResponsiblePersonId: usesOwnerCustody
          ? (line.sourceCustodianResponsiblePersonId ?? null)
          : null,
        sourceCustodyBalanceId: usesOwnerCustody
          ? (line.sourceCustodyBalanceId ?? null)
          : null,
        note: line.note?.trim() || null,
      };
    });

    return {
      accountingModel: usesOwnerCustody
        ? StockAccountingModel.OWNER_CUSTODY
        : StockAccountingModel.LEGACY_BALANCE,
      sourceResponsiblePersonId: dto.sourceResponsiblePersonId,
      destinationResponsiblePersonId:
        isAssignment || isTransfer
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
      destinationResponsiblePersonId: string | null;
      lines: { accountingOwnerResponsiblePersonId: string | null }[];
    },
  ) {
    const responsiblePersonId = actor.responsiblePersonId;
    if (
      actor.role === UserRole.MVO &&
      responsiblePersonId !== document.sourceResponsiblePersonId &&
      responsiblePersonId !== document.destinationResponsiblePersonId &&
      !document.lines.some(
        (line) =>
          line.accountingOwnerResponsiblePersonId === responsiblePersonId,
      )
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
