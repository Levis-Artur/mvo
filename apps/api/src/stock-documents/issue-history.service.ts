import { Injectable } from '@nestjs/common';
import {
  IssueRealizationStatus,
  Prisma,
  SecurityEventType,
  StockDocumentType,
} from '@prisma/client';
import { AccessControlService } from '../auth/access-control.service';
import type { CurrentUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  IssueHistoryFiltersDto,
  ListIssueHistoryQueryDto,
} from './dto/issue-history-query.dto';
import {
  buildIssueHistoryCsv,
  type IssueCsvRow,
} from './issue-history.csv';

type AuditContext = {
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
};

const issueListInclude = {
  sourceResponsiblePerson: {
    select: {
      id: true,
      personnelNumber: true,
      externalAccountingCode: true,
      lastName: true,
      firstName: true,
      middleName: true,
    },
  },
  createdByUser: { select: { id: true, username: true, role: true } },
  lines: {
    select: {
      quantity: true,
      realizationLines: {
        where: { realization: { status: IssueRealizationStatus.POSTED } },
        select: { quantity: true },
      },
    },
  },
  issueRealizations: {
    select: { id: true, status: true },
  },
  attachments: { select: { id: true } },
} satisfies Prisma.StockDocumentInclude;

const issueExportInclude = {
  sourceResponsiblePerson: issueListInclude.sourceResponsiblePerson,
  createdByUser: issueListInclude.createdByUser,
  lines: {
    include: {
      inventoryItem: true,
      realizationLines: {
        select: {
          quantity: true,
          realization: {
            select: {
              displayNumber: true,
              realizationDate: true,
              recipientText: true,
              note: true,
              status: true,
              createdAt: true,
              attachments: {
                select: { originalFileName: true },
                orderBy: { createdAt: 'asc' as const },
              },
              createdByUser: { select: { username: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' as const },
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
  attachments: {
    select: { originalFileName: true },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.StockDocumentInclude;

type IssueListDocument = Prisma.StockDocumentGetPayload<{
  include: typeof issueListInclude;
}>;

@Injectable()
export class IssueHistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService =
      new AccessControlService(prisma),
  ) {}

  async list(query: ListIssueHistoryQueryDto, actor: CurrentUser) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const where = this.where(query, actor);
    const [items, total] = await Promise.all([
      this.prisma.stockDocument.findMany({
        where,
        include: issueListInclude,
        orderBy: [
          { documentDate: 'desc' },
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.stockDocument.count({ where }),
    ]);
    return {
      items: items.map((document) => this.serialize(document)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async exportCsv(
    filters: IssueHistoryFiltersDto,
    actor: CurrentUser,
    context: AuditContext,
  ) {
    const documents = await this.prisma.stockDocument.findMany({
      where: this.where(filters, actor),
      include: issueExportInclude,
      orderBy: [
        { documentDate: 'desc' },
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
    });
    const rows: IssueCsvRow[] = documents.flatMap(
      (document): IssueCsvRow[] => {
        const mvo = this.person(document.sourceResponsiblePerson);
        const attachmentNames = document.attachments.map(
          (attachment) => attachment.originalFileName,
        );
        return document.lines.flatMap((line): IssueCsvRow[] => {
          const realizedQuantity = line.realizationLines.reduce(
            (sum, realizationLine) =>
              realizationLine.realization.status ===
              IssueRealizationStatus.POSTED
                ? sum.plus(realizationLine.quantity)
                : sum,
            new Prisma.Decimal(0),
          );
          const issue: Omit<IssueCsvRow, 'realization'> = {
            displayNumber: document.displayNumber,
            documentDate: document.documentDate,
            mvoCode: mvo.externalAccountingCode ?? '',
            mvoName: mvo.fullName,
            recipientName: document.recipientName ?? '',
            inventoryCode: line.inventoryItem.externalCode,
            inventoryName: line.inventoryItem.name,
            unit: line.inventoryItem.unitOfMeasure,
            issuedQuantity: line.quantity,
            realizedQuantity,
            availableToRealize: Prisma.Decimal.max(
              line.quantity.minus(realizedQuantity),
              new Prisma.Decimal(0),
            ),
            note: document.note,
            status: document.status,
            attachmentNames,
            author:
              document.createdByUser?.username ?? 'Видалений користувач',
            createdAt: document.createdAt,
          };
          if (line.realizationLines.length === 0) {
            return [{ ...issue, realization: null }];
          }
          return [...line.realizationLines]
            .sort(
              (left, right) =>
                left.realization.realizationDate.getTime() -
                  right.realization.realizationDate.getTime() ||
                left.realization.displayNumber -
                  right.realization.displayNumber,
            )
            .map((realizationLine): IssueCsvRow => ({
              ...issue,
              realization: {
                displayNumber: realizationLine.realization.displayNumber,
                realizationDate:
                  realizationLine.realization.realizationDate,
                recipientText: realizationLine.realization.recipientText,
                quantity: realizationLine.quantity,
                note: realizationLine.realization.note,
                status: realizationLine.realization.status,
                attachmentNames:
                  realizationLine.realization.attachments.map(
                    (attachment) => attachment.originalFileName,
                  ),
                author:
                  realizationLine.realization.createdByUser?.username ??
                  'Видалений користувач',
                createdAt: realizationLine.realization.createdAt,
              },
            }));
        });
      },
    );
    const csv = buildIssueHistoryCsv(rows);
    await this.prisma.securityEvent.create({
      data: {
        type: SecurityEventType.STOCK_DOCUMENT_ACTION,
        actorUserId: actor.id,
        requestId: context.requestId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        success: true,
        metadata: {
          action: 'ACCOUNTING_ISSUE_EXPORT',
          documentCount: documents.length,
          rowCount: rows.length,
        },
      },
    });
    return {
      csv,
      filename: `accounting-issues-${new Date().toISOString().slice(0, 10)}.csv`,
      documentCount: documents.length,
      rowCount: rows.length,
    };
  }

  private where(
    filters: IssueHistoryFiltersDto,
    actor: CurrentUser,
  ): Prisma.StockDocumentWhereInput {
    const search = filters.search?.trim();
    const displayNumberFromSearch = search
      ? Number(search.replace(/^№\s*/, ''))
      : Number.NaN;
    const queryWhere: Prisma.StockDocumentWhereInput = {
      type: StockDocumentType.ISSUE,
      sourceResponsiblePersonId: filters.sourceResponsiblePersonId,
      status: filters.status,
      displayNumber: filters.displayNumber,
      documentDate: {
        gte: filters.dateFrom
          ? new Date(`${filters.dateFrom.slice(0, 10)}T00:00:00.000Z`)
          : undefined,
        lte: filters.dateTo
          ? new Date(`${filters.dateTo.slice(0, 10)}T23:59:59.999Z`)
          : undefined,
      },
      sourceResponsiblePerson: filters.externalAccountingCode
        ? {
            externalAccountingCode: {
              contains: filters.externalAccountingCode.trim(),
              mode: 'insensitive',
            },
          }
        : undefined,
      recipientName: filters.recipient
        ? { contains: filters.recipient.trim(), mode: 'insensitive' }
        : undefined,
      attachments:
        filters.hasAttachment === true
          ? { some: {} }
          : filters.hasAttachment === false
            ? { none: {} }
            : undefined,
      AND: [
        filters.inventoryCode
          ? {
              lines: {
                some: {
                  inventoryItem: {
                    externalCode: {
                      contains: filters.inventoryCode.trim(),
                      mode: 'insensitive',
                    },
                  },
                },
              },
            }
          : {},
        filters.inventoryName
          ? {
              lines: {
                some: {
                  inventoryItem: {
                    name: {
                      contains: filters.inventoryName.trim(),
                      mode: 'insensitive',
                    },
                  },
                },
              },
            }
          : {},
        search
          ? {
              OR: [
                {
                  recipientName: { contains: search, mode: 'insensitive' },
                },
                { note: { contains: search, mode: 'insensitive' } },
                {
                  sourceResponsiblePerson: {
                    externalAccountingCode: {
                      contains: search,
                      mode: 'insensitive',
                    },
                  },
                },
                {
                  sourceResponsiblePerson: {
                    lastName: { contains: search, mode: 'insensitive' },
                  },
                },
                {
                  lines: {
                    some: {
                      inventoryItem: {
                        OR: [
                          {
                            externalCode: {
                              contains: search,
                              mode: 'insensitive',
                            },
                          },
                          {
                            name: { contains: search, mode: 'insensitive' },
                          },
                        ],
                      },
                    },
                  },
                },
                ...(Number.isInteger(displayNumberFromSearch) &&
                displayNumberFromSearch > 0
                  ? [{ displayNumber: displayNumberFromSearch }]
                  : []),
              ],
            }
          : {},
      ],
    };
    return {
      AND: [this.accessControl.stockDocumentFilter(actor), queryWhere],
    };
  }

  private serialize(document: IssueListDocument) {
    const issuedQuantity = document.lines.reduce(
      (total, line) => total.plus(line.quantity),
      new Prisma.Decimal(0),
    );
    const realizedQuantity = document.lines.reduce(
      (total, line) =>
        total.plus(
          line.realizationLines.reduce(
            (lineTotal, realizationLine) =>
              lineTotal.plus(realizationLine.quantity),
            new Prisma.Decimal(0),
          ),
        ),
      new Prisma.Decimal(0),
    );
    return {
      id: document.id,
      displayNumber: document.displayNumber,
      documentDate: document.documentDate.toISOString(),
      sourceResponsiblePerson: this.person(document.sourceResponsiblePerson),
      recipientName: document.recipientName,
      note: document.note,
      status: document.status,
      numberOfLines: document.lines.length,
      totalQuantity: issuedQuantity.toString(),
      issuedQuantity: issuedQuantity.toString(),
      realizedQuantity: realizedQuantity.toString(),
      availableToRealize: Prisma.Decimal.max(
        issuedQuantity.minus(realizedQuantity),
        new Prisma.Decimal(0),
      ).toString(),
      realizationCount: document.issueRealizations.length,
      isFullyRealized:
        issuedQuantity.greaterThan(0) &&
        realizedQuantity.greaterThanOrEqualTo(issuedQuantity),
      hasAttachment: document.attachments.length > 0,
      createdBy: document.createdByUser,
      createdAt: document.createdAt.toISOString(),
    };
  }

  private person(person: {
    id: string;
    personnelNumber: string;
    externalAccountingCode: string | null;
    lastName: string;
    firstName: string;
    middleName: string | null;
  }) {
    return {
      id: person.id,
      personnelNumber: person.personnelNumber,
      externalAccountingCode: person.externalAccountingCode,
      fullName: [person.lastName, person.firstName, person.middleName]
        .filter(Boolean)
        .join(' '),
    };
  }
}
