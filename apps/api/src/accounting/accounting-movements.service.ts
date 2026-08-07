import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ImportStatus,
  Prisma,
  SecurityEventType,
  StockDocumentStatus,
  StockDocumentType,
  StockTransactionType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildAccountingMovementCsv } from './accounting-movement.csv';
import {
  type AccountingMovementFiltersDto,
  type AccountingMovementType,
  type ListAccountingMovementsQueryDto,
} from './dto/accounting-movement-query.dto';

const personSelect = {
  id: true,
  personnelNumber: true,
  externalAccountingCode: true,
  lastName: true,
  firstName: true,
  middleName: true,
} satisfies Prisma.ResponsiblePersonSelect;

const inventoryItemSelect = {
  id: true,
  externalCode: true,
  name: true,
  unitOfMeasure: true,
} satisfies Prisma.InventoryItemSelect;

const movementInclude = {
  responsiblePerson: { select: personSelect },
  inventoryItem: { select: inventoryItemSelect },
  importBatch: {
    select: {
      id: true,
      originalFilename: true,
      status: true,
      type: true,
      createdAt: true,
      completedAt: true,
    },
  },
  document: {
    select: {
      id: true,
      displayNumber: true,
      documentDate: true,
      type: true,
      status: true,
      recipientName: true,
      sourceResponsiblePerson: { select: personSelect },
      destinationResponsiblePerson: { select: personSelect },
    },
  },
} satisfies Prisma.StockTransactionInclude;

const documentDetailsInclude = {
  sourceResponsiblePerson: { select: personSelect },
  destinationResponsiblePerson: { select: personSelect },
  createdByUser: { select: { id: true, username: true } },
  lines: {
    include: { inventoryItem: { select: inventoryItemSelect } },
    orderBy: { createdAt: 'asc' as const },
  },
  attachments: {
    select: {
      id: true,
      documentId: true,
      originalFileName: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.StockDocumentInclude;

type Movement = Prisma.StockTransactionGetPayload<{
  include: typeof movementInclude;
}>;

type MovementPerson = Movement['responsiblePerson'];

const ISSUE_TYPES: StockTransactionType[] = [
  StockTransactionType.ISSUE,
  StockTransactionType.ISSUE_FROM_DIRECT,
  StockTransactionType.ISSUE_FROM_CUSTODY,
  StockTransactionType.ISSUE_OUT,
  StockTransactionType.ISSUE_REVERSAL,
];

const REVERSAL_TYPES: StockTransactionType[] = [
  StockTransactionType.MVO_TRANSFER_REVERSAL,
  StockTransactionType.ISSUE_REVERSAL,
];

@Injectable()
export class AccountingMovementsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListAccountingMovementsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const where = this.where(query);
    const [items, total] = await Promise.all([
      this.prisma.stockTransaction.findMany({
        where,
        include: movementInclude,
        orderBy: [
          { occurredAt: 'desc' },
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.stockTransaction.count({ where }),
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

  async exportCsv(filters: AccountingMovementFiltersDto) {
    const items = await this.prisma.stockTransaction.findMany({
      where: this.where(filters),
      include: movementInclude,
      orderBy: [
        { occurredAt: 'desc' },
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
    });
    const rows = items.map((item) => this.serialize(item));
    return {
      filename: `accounting-movements-${new Date().toISOString().slice(0, 10)}.csv`,
      csv: buildAccountingMovementCsv(rows.map((row) => ({
        occurredAt: row.occurredAt,
        documentLabel: row.documentLabel,
        operationLabel: row.operationLabel,
        mvoCode:
          row.responsiblePerson.externalAccountingCode
          ?? row.responsiblePerson.personnelNumber,
        mvoName: row.responsiblePerson.fullName,
        inventoryCode: row.inventoryItem.externalCode,
        inventoryName: row.inventoryItem.name,
        quantity: row.quantity,
        direction: row.direction,
        statusLabel: row.statusLabel,
      }))),
    };
  }

  async details(id: string) {
    const movement = await this.prisma.stockTransaction.findFirst({
      where: { AND: [{ id }, this.relevantMovements()] },
      include: movementInclude,
    });
    if (!movement) {
      throw new NotFoundException('Операцію руху майна не знайдено');
    }

    if (movement.documentId) {
      return this.documentDetails(movement);
    }
    if (movement.importBatchId) {
      return this.importDetails(movement);
    }
    throw new NotFoundException('Джерело операції руху майна не знайдено');
  }

  private async documentDetails(movement: Movement) {
    const document = await this.prisma.stockDocument.findUnique({
      where: { id: movement.documentId! },
      include: documentDetailsInclude,
    });
    if (!document) {
      throw new NotFoundException('Документ руху майна не знайдено');
    }

    return {
      kind: 'STOCK_DOCUMENT' as const,
      sourceId: document.id,
      operationType: this.operationType(movement),
      documentLabel: `№ ${document.displayNumber}`,
      documentDate: document.documentDate.toISOString(),
      status: document.status,
      author: document.createdByUser,
      responsiblePerson: this.person(document.sourceResponsiblePerson),
      counterparty: document.destinationResponsiblePerson
        ? this.person(document.destinationResponsiblePerson)
        : document.recipientName
          ? { fullName: document.recipientName, externalAccountingCode: null }
          : null,
      recipientUnit: document.recipientUnit,
      basis: document.basis,
      note: document.note,
      lines: document.lines.map((line) => ({
        inventoryItem: line.inventoryItem,
        responsiblePerson: this.person(document.sourceResponsiblePerson),
        quantity: line.quantity.toString(),
        note: line.note,
      })),
      attachments: document.attachments.map((attachment) => ({
        ...attachment,
        createdAt: attachment.createdAt.toISOString(),
      })),
    };
  }

  private async importDetails(movement: Movement) {
    const [batch, lines, uploadEvent] = await Promise.all([
      this.prisma.importBatch.findUnique({
        where: { id: movement.importBatchId! },
        select: {
          id: true,
          originalFilename: true,
          type: true,
          status: true,
          createdAt: true,
          completedAt: true,
        },
      }),
      this.prisma.stockTransaction.findMany({
        where: { importBatchId: movement.importBatchId! },
        include: {
          responsiblePerson: { select: personSelect },
          inventoryItem: { select: inventoryItemSelect },
        },
        orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.securityEvent.findFirst({
        where: {
          type: SecurityEventType.IMPORT_ACTION,
          success: true,
          AND: [
            { metadata: { path: ['action'], equals: 'UPLOAD' } },
            {
              metadata: {
                path: ['importBatchId'],
                equals: movement.importBatchId!,
              },
            },
          ],
        },
        orderBy: { createdAt: 'desc' },
        select: { actorUser: { select: { id: true, username: true } } },
      }),
    ]);
    if (!batch) {
      throw new NotFoundException('Імпорт не знайдено');
    }

    return {
      kind: 'IMPORT' as const,
      sourceId: batch.id,
      operationType: 'IMPORT' as const,
      documentLabel: batch.originalFilename,
      documentDate: batch.completedAt?.toISOString() ?? batch.createdAt.toISOString(),
      status: batch.status,
      author: uploadEvent?.actorUser ?? null,
      responsiblePerson: this.person(movement.responsiblePerson),
      counterparty: { fullName: 'Бухгалтерія', externalAccountingCode: null },
      recipientUnit: null,
      basis: null,
      note: null,
      lines: lines.map((line) => ({
        inventoryItem: line.inventoryItem,
        responsiblePerson: this.person(line.responsiblePerson),
        quantity: line.quantity.toString(),
        note: line.comment,
      })),
      attachments: [],
    };
  }

  private where(
    filters: AccountingMovementFiltersDto,
  ): Prisma.StockTransactionWhereInput {
    const search = filters.search?.trim();
    const mvoCode = filters.mvoCode?.trim();
    const inventoryCode = filters.inventoryCode?.trim();
    const inventoryName = filters.inventoryName?.trim();
    const documentNumber = search?.replace(/^№\s*/, '');
    const displayNumber = documentNumber && /^\d+$/.test(documentNumber)
      ? Number(documentNumber)
      : undefined;

    return {
      AND: [
        this.relevantMovements(),
        this.operationFilter(filters.operationType),
        this.statusFilter(filters.status),
        {
          occurredAt: this.dateRange(filters),
          responsiblePersonId: filters.responsiblePersonId,
          responsiblePerson: mvoCode
            ? {
                externalAccountingCode: {
                  contains: mvoCode,
                  mode: 'insensitive',
                },
              }
            : undefined,
          inventoryItem: {
            externalCode: inventoryCode
              ? { contains: inventoryCode, mode: 'insensitive' }
              : undefined,
            name: inventoryName
              ? { contains: inventoryName, mode: 'insensitive' }
              : undefined,
          },
        },
        search
          ? {
              OR: [
                { sourceDocument: { contains: search, mode: 'insensitive' } },
                {
                  responsiblePerson: {
                    externalAccountingCode: {
                      contains: search,
                      mode: 'insensitive',
                    },
                  },
                },
                {
                  responsiblePerson: {
                    lastName: { contains: search, mode: 'insensitive' },
                  },
                },
                {
                  responsiblePerson: {
                    firstName: { contains: search, mode: 'insensitive' },
                  },
                },
                {
                  inventoryItem: {
                    externalCode: { contains: search, mode: 'insensitive' },
                  },
                },
                {
                  inventoryItem: {
                    name: { contains: search, mode: 'insensitive' },
                  },
                },
                {
                  importBatch: {
                    originalFilename: {
                      contains: search,
                      mode: 'insensitive',
                    },
                  },
                },
                {
                  document: {
                    recipientName: {
                      contains: search,
                      mode: 'insensitive',
                    },
                  },
                },
                {
                  document: {
                    destinationResponsiblePerson: {
                      lastName: { contains: search, mode: 'insensitive' },
                    },
                  },
                },
                ...(displayNumber
                  ? [{ document: { displayNumber } }]
                  : []),
              ],
            }
          : {},
      ],
    };
  }

  private relevantMovements(): Prisma.StockTransactionWhereInput {
    return {
      OR: [
        { importBatchId: { not: null } },
        {
          type: {
            in: [
              StockTransactionType.MVO_TRANSFER_OUT,
              StockTransactionType.MVO_TRANSFER_REVERSAL,
            ],
          },
          document: { type: StockDocumentType.MVO_TRANSFER },
        },
        {
          type: { in: ISSUE_TYPES },
          document: { type: StockDocumentType.ISSUE },
        },
      ],
    };
  }

  private operationFilter(
    operationType?: AccountingMovementType,
  ): Prisma.StockTransactionWhereInput {
    if (operationType === 'IMPORT') return { importBatchId: { not: null } };
    if (operationType === 'MVO_TRANSFER') {
      return {
        type: StockTransactionType.MVO_TRANSFER_OUT,
        document: { type: StockDocumentType.MVO_TRANSFER },
      };
    }
    if (operationType === 'ISSUE') {
      return {
        type: { in: ISSUE_TYPES.filter((type) => !REVERSAL_TYPES.includes(type)) },
        document: { type: StockDocumentType.ISSUE },
      };
    }
    if (operationType === 'CANCELLATION') {
      return { type: { in: REVERSAL_TYPES } };
    }
    return {};
  }

  private statusFilter(status?: string): Prisma.StockTransactionWhereInput {
    if (status === 'POSTED') {
      return { document: { status: StockDocumentStatus.POSTED } };
    }
    if (status === 'CANCELLED') {
      return { document: { status: StockDocumentStatus.CANCELLED } };
    }
    if (status === 'COMPLETED') {
      return {
        importBatch: {
          status: {
            in: [ImportStatus.COMPLETED, ImportStatus.PARTIALLY_COMPLETED],
          },
        },
      };
    }
    return {};
  }

  private dateRange(filters: { dateFrom?: string; dateTo?: string }) {
    return {
      gte: filters.dateFrom
        ? new Date(`${filters.dateFrom.slice(0, 10)}T00:00:00.000Z`)
        : undefined,
      lte: filters.dateTo
        ? new Date(`${filters.dateTo.slice(0, 10)}T23:59:59.999Z`)
        : undefined,
    };
  }

  private serialize(movement: Movement) {
    const operationType = this.operationType(movement);
    const responsiblePerson = this.person(movement.responsiblePerson);
    const destination = movement.document?.destinationResponsiblePerson ?? null;
    const operationLabel = this.operationLabel(operationType, movement);
    const status = movement.importBatch?.status ?? movement.document?.status ?? 'POSTED';
    const statusLabel = this.statusLabel(status);

    return {
      id: movement.id,
      occurredAt: movement.occurredAt.toISOString(),
      operationType,
      operationLabel,
      documentLabel: movement.importBatch?.originalFilename
        ?? (movement.document ? `№ ${movement.document.displayNumber}` : '—'),
      responsiblePerson,
      inventoryItem: movement.inventoryItem,
      quantity: this.signedQuantity(movement.quantity, operationType),
      direction: this.direction(movement, responsiblePerson, destination),
      status,
      statusLabel,
    };
  }

  private operationType(movement: Movement): AccountingMovementType {
    if (movement.importBatchId) return 'IMPORT';
    if (REVERSAL_TYPES.includes(movement.type)) return 'CANCELLATION';
    if (movement.document?.type === StockDocumentType.MVO_TRANSFER) {
      return 'MVO_TRANSFER';
    }
    return 'ISSUE';
  }

  private operationLabel(type: AccountingMovementType, movement: Movement) {
    if (type === 'IMPORT') return 'Надходження';
    if (type === 'MVO_TRANSFER') return 'Передача';
    if (type === 'ISSUE') return 'Видача';
    return movement.document?.type === StockDocumentType.MVO_TRANSFER
      ? 'Скасування передачі'
      : 'Скасування видачі';
  }

  private signedQuantity(
    quantity: Prisma.Decimal,
    operationType: AccountingMovementType,
  ) {
    const value = quantity.abs().toString();
    return operationType === 'MVO_TRANSFER' || operationType === 'ISSUE'
      ? `-${value}`
      : `+${value}`;
  }

  private direction(
    movement: Movement,
    responsiblePerson: ReturnType<AccountingMovementsService['person']>,
    destination: MovementPerson | null,
  ) {
    const source = this.personLabel(responsiblePerson);
    if (movement.importBatchId) return `Бухгалтерія → ${source}`;
    if (movement.document?.type === StockDocumentType.MVO_TRANSFER) {
      const target = destination
        ? this.personLabel(this.person(destination))
        : 'Одержувача не вказано';
      return movement.type === StockTransactionType.MVO_TRANSFER_REVERSAL
        ? `Скасування: ${target} → ${source}`
        : `${source} → ${target}`;
    }
    const recipient = movement.document?.recipientName ?? 'Одержувача не вказано';
    return movement.type === StockTransactionType.ISSUE_REVERSAL
      ? `Скасування видачі: ${recipient} → ${source}`
      : `${source} → ${recipient}`;
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

  private personLabel(person: {
    personnelNumber: string;
    externalAccountingCode: string | null;
    fullName: string;
  }) {
    return `${person.externalAccountingCode ?? person.personnelNumber} — ${person.fullName}`;
  }

  private statusLabel(status: string) {
    if (status === StockDocumentStatus.POSTED) return 'Проведено';
    if (status === StockDocumentStatus.CANCELLED) return 'Скасовано';
    if (status === ImportStatus.PARTIALLY_COMPLETED) return 'Проведено частково';
    if (status === ImportStatus.COMPLETED) return 'Проведено';
    return status;
  }
}
