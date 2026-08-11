import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  IssueRealizationStatus,
  Prisma,
  SecurityEventType,
  StockAccountingModel,
  StockDocumentStatus,
  StockDocumentType,
  UserRole,
} from '@prisma/client';
import type { CurrentUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  type StoredAttachment,
  StockDocumentAttachmentStorageService,
} from './stock-document-attachment-storage.service';
import {
  CreateIssueRealizationDto,
  ListIssueRealizationsQueryDto,
} from './dto/issue-realization.dto';

type AuditContext = {
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
};

const realizationInclude = {
  createdByUser: { select: { id: true, username: true, role: true } },
  cancelledByUser: { select: { id: true, username: true, role: true } },
  lines: {
    include: { issueLine: { include: { inventoryItem: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
  attachments: {
    select: {
      id: true,
      realizationId: true,
      originalFileName: true,
      mimeType: true,
      sizeBytes: true,
      sha256: true,
      uploadedByUserId: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.IssueRealizationInclude;

type RealizationWithDetails = Prisma.IssueRealizationGetPayload<{
  include: typeof realizationInclude;
}>;

@Injectable()
export class IssueRealizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attachmentStorage: StockDocumentAttachmentStorageService,
  ) {}

  async create(
    issueId: string,
    dto: CreateIssueRealizationDto,
    files: Express.Multer.File[],
    actor: CurrentUser,
    context: AuditContext,
  ) {
    const sourceResponsiblePersonId = this.requireMvo(actor);
    await this.assertCanReadIssue(issueId, actor);
    const lines = this.normalizeLines(dto);
    const storedAttachments: StoredAttachment[] = [];

    try {
      for (const file of files) {
        storedAttachments.push(await this.attachmentStorage.store(file));
      }
      await this.attachmentStorage.assertStoredFilesExist(
        storedAttachments.map((attachment) => attachment.storagePath),
      );

      const realization = await this.runSerializable(() =>
        this.prisma.$transaction(
          async (tx) => {
          await this.lockIssue(tx, issueId);
          const issue = await tx.stockDocument.findUnique({
            where: { id: issueId },
            select: {
              id: true,
              type: true,
              status: true,
              accountingModel: true,
              sourceTransferId: true,
              sourceResponsiblePersonId: true,
              lines: { select: { id: true, quantity: true } },
            },
          });
          this.assertRealizableIssue(issue, sourceResponsiblePersonId);

          const issueLines = new Map(
            issue.lines.map((line) => [line.id, line]),
          );
          for (const line of lines) {
            if (!issueLines.has(line.issueLineId)) {
              throw new BadRequestException(
                'Позиція реалізації не належить до вибраної видачі',
              );
            }
          }

          const realized = await tx.issueRealizationLine.groupBy({
            by: ['issueLineId'],
            where: {
              issueLineId: { in: lines.map((line) => line.issueLineId) },
              realization: {
                issueId,
                status: IssueRealizationStatus.POSTED,
              },
            },
            _sum: { quantity: true },
          });
          const realizedByLine = new Map(
            realized.map((line) => [
              line.issueLineId,
              line._sum.quantity ?? new Prisma.Decimal(0),
            ]),
          );
          for (const line of lines) {
            const issuedQuantity = issueLines.get(line.issueLineId)!.quantity;
            const availableQuantity = issuedQuantity.minus(
              realizedByLine.get(line.issueLineId) ?? new Prisma.Decimal(0),
            );
            if (line.quantity.greaterThan(availableQuantity)) {
              throw new ConflictException(
                'Кількість реалізації перевищує доступний залишок виданого майна',
              );
            }
          }

          const created = await tx.issueRealization.create({
            data: {
              issueId,
              realizationDate: new Date(dto.realizationDate),
              recipientText: dto.recipientText?.trim() || null,
              note: dto.note?.trim() || null,
              status: IssueRealizationStatus.POSTED,
              createdByUserId: actor.id,
              lines: {
                create: lines.map((line) => ({
                  issueLineId: line.issueLineId,
                  quantity: line.quantity,
                })),
              },
              attachments: {
                create: storedAttachments.map((attachment) => ({
                  ...attachment,
                  uploadedByUserId: actor.id,
                })),
              },
            },
            include: realizationInclude,
          });
          await this.auditInTx(tx, actor, issueId, created.id, 'CREATE', context);
          return created;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        ),
      );
      return this.serialize(realization);
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
      throw cleanupError ?? error;
    }
  }

  async list(
    issueId: string,
    query: ListIssueRealizationsQueryDto,
    actor: CurrentUser,
  ) {
    await this.assertCanReadIssue(issueId, actor);
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const where = { issueId } satisfies Prisma.IssueRealizationWhereInput;
    const [items, total] = await Promise.all([
      this.prisma.issueRealization.findMany({
        where,
        include: realizationInclude,
        orderBy: [
          { realizationDate: 'desc' },
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.issueRealization.count({ where }),
    ]);
    return {
      items: items.map((item) => this.serialize(item)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(issueId: string, realizationId: string, actor: CurrentUser) {
    await this.assertCanReadIssue(issueId, actor);
    const realization = await this.prisma.issueRealization.findFirst({
      where: { id: realizationId, issueId },
      include: realizationInclude,
    });
    if (!realization) {
      throw new NotFoundException('Реалізацію виданого не знайдено');
    }
    return this.serialize(realization);
  }

  async cancel(
    issueId: string,
    realizationId: string,
    actor: CurrentUser,
    context: AuditContext,
  ) {
    const sourceResponsiblePersonId = this.requireMvo(actor);
    const realization = await this.prisma.$transaction(async (tx) => {
      await this.lockIssue(tx, issueId);
      await tx.$queryRaw`
        SELECT "id"
        FROM "IssueRealization"
        WHERE "id" = ${realizationId}::uuid
        FOR UPDATE
      `;
      const current = await tx.issueRealization.findFirst({
        where: { id: realizationId, issueId },
        include: {
          issue: { select: { sourceResponsiblePersonId: true } },
        },
      });
      if (!current) {
        throw new NotFoundException('Реалізацію виданого не знайдено');
      }
      if (current.issue.sourceResponsiblePersonId !== sourceResponsiblePersonId) {
        throw new ForbiddenException('Немає доступу до цієї реалізації');
      }
      if (current.status === IssueRealizationStatus.CANCELLED) {
        return tx.issueRealization.findUniqueOrThrow({
          where: { id: realizationId },
          include: realizationInclude,
        });
      }
      const claim = await tx.issueRealization.updateMany({
        where: { id: realizationId, status: IssueRealizationStatus.POSTED },
        data: {
          status: IssueRealizationStatus.CANCELLED,
          cancelledByUserId: actor.id,
          cancelledAt: new Date(),
        },
      });
      if (claim.count !== 1) {
        throw new ConflictException('Реалізацію вже змінено іншим запитом');
      }
      await this.auditInTx(tx, actor, issueId, realizationId, 'CANCEL', context);
      return tx.issueRealization.findUniqueOrThrow({
        where: { id: realizationId },
        include: realizationInclude,
      });
    });
    return this.serialize(realization);
  }

  async attachment(
    issueId: string,
    realizationId: string,
    attachmentId: string,
    actor: CurrentUser,
    context: AuditContext,
    action: 'PREVIEW' | 'DOWNLOAD',
  ) {
    await this.assertCanReadIssue(issueId, actor);
    const attachment = await this.prisma.issueRealizationAttachment.findFirst({
      where: { id: attachmentId, realizationId, realization: { issueId } },
    });
    if (!attachment) {
      throw new NotFoundException('Вкладення реалізації не знайдено');
    }
    await this.attachmentStorage.assertStoredFilesExist([attachment.storagePath]);
    await this.prisma.securityEvent.create({
      data: {
        type: SecurityEventType.STOCK_DOCUMENT_ACTION,
        actorUserId: actor.id,
        requestId: context.requestId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        success: true,
        metadata: {
          action: `ISSUE_REALIZATION_ATTACHMENT_${action}`,
          issueId,
          realizationId,
          attachmentId,
        },
      },
    });
    return {
      metadata: attachment,
      stream: this.attachmentStorage.createDownloadStream(attachment.storagePath),
    };
  }

  private normalizeLines(dto: CreateIssueRealizationDto) {
    const seen = new Set<string>();
    return dto.lines.map((line) => {
      if (seen.has(line.issueLineId)) {
        throw new BadRequestException(
          'Одна позиція видачі не може повторюватися в реалізації',
        );
      }
      seen.add(line.issueLineId);
      let quantity: Prisma.Decimal;
      try {
        quantity = new Prisma.Decimal(line.quantity);
      } catch {
        throw new BadRequestException('Некоректна кількість реалізації');
      }
      if (!quantity.isFinite() || !quantity.greaterThan(0)) {
        throw new BadRequestException('Кількість реалізації має бути більшою за нуль');
      }
      return { issueLineId: line.issueLineId, quantity };
    });
  }

  private assertRealizableIssue(
    issue:
      | {
          type: StockDocumentType;
          status: StockDocumentStatus;
          accountingModel: StockAccountingModel | null;
          sourceTransferId: string | null;
          sourceResponsiblePersonId: string;
          lines: { id: string; quantity: Prisma.Decimal }[];
        }
      | null,
    sourceResponsiblePersonId: string,
  ): asserts issue is NonNullable<typeof issue> {
    if (!issue) throw new NotFoundException('Видачу не знайдено');
    if (
      issue.type !== StockDocumentType.ISSUE ||
      issue.status !== StockDocumentStatus.POSTED ||
      issue.accountingModel !== StockAccountingModel.DIRECT_BALANCE ||
      issue.sourceTransferId
    ) {
      throw new BadRequestException(
        'Реалізацію можна створити лише для проведеної видачі нової моделі',
      );
    }
    if (issue.sourceResponsiblePersonId !== sourceResponsiblePersonId) {
      throw new ForbiddenException('Немає доступу до цієї видачі');
    }
  }

  private async assertCanReadIssue(issueId: string, actor: CurrentUser) {
    const issue = await this.prisma.stockDocument.findUnique({
      where: { id: issueId },
      select: { type: true, sourceResponsiblePersonId: true },
    });
    if (!issue || issue.type !== StockDocumentType.ISSUE) {
      throw new NotFoundException('Видачу не знайдено');
    }
    if (actor.role === UserRole.OWNER) return;
    if (
      actor.role !== UserRole.MVO ||
      !actor.responsiblePersonId ||
      actor.responsiblePersonId !== issue.sourceResponsiblePersonId
    ) {
      throw new ForbiddenException('Немає доступу до реалізацій цієї видачі');
    }
  }

  private requireMvo(actor: CurrentUser) {
    if (actor.role !== UserRole.MVO || !actor.responsiblePersonId) {
      throw new ForbiddenException(
        'Реалізацію може оформити лише користувач із пов’язаною карткою МВО',
      );
    }
    return actor.responsiblePersonId;
  }

  private async lockIssue(tx: Prisma.TransactionClient, issueId: string) {
    await tx.$queryRaw`
      SELECT "id"
      FROM "StockDocument"
      WHERE "id" = ${issueId}::uuid
      FOR UPDATE
    `;
  }

  private async runSerializable<T>(operation: () => Promise<T>): Promise<T> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034'
        ) {
          if (attempt < 3) continue;
          throw new ConflictException(
            'Дані реалізації одночасно змінено іншим запитом. Повторіть операцію.',
          );
        }
        throw error;
      }
    }
    throw new ConflictException('Не вдалося безпечно провести реалізацію');
  }

  private serialize(realization: RealizationWithDetails) {
    return {
      ...realization,
      realizationDate: realization.realizationDate.toISOString(),
      createdAt: realization.createdAt.toISOString(),
      updatedAt: realization.updatedAt.toISOString(),
      cancelledAt: realization.cancelledAt?.toISOString() ?? null,
      lines: realization.lines.map((line) => ({
        id: line.id,
        issueLineId: line.issueLineId,
        quantity: line.quantity.toString(),
        inventoryItem: line.issueLine.inventoryItem,
      })),
      totalQuantity: realization.lines
        .reduce(
          (sum, line) => sum.plus(line.quantity),
          new Prisma.Decimal(0),
        )
        .toString(),
      hasAttachment: realization.attachments.length > 0,
      createdBy: realization.createdByUser,
    };
  }

  private auditInTx(
    tx: Prisma.TransactionClient,
    actor: CurrentUser,
    issueId: string,
    realizationId: string,
    action: 'CREATE' | 'CANCEL',
    context: AuditContext,
  ) {
    return tx.securityEvent.create({
      data: {
        type: SecurityEventType.STOCK_DOCUMENT_ACTION,
        actorUserId: actor.id,
        requestId: context.requestId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        success: true,
        metadata: {
          action: `ISSUE_REALIZATION_${action}`,
          issueId,
          realizationId,
        },
      },
    });
  }
}
