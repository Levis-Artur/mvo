import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryItemReviewStatus,
  Prisma,
  StockDocumentStatus,
  StockDocumentType,
  StockTransactionType,
  UserRole,
} from '@prisma/client';
import { AccessControlService } from '../auth/access-control.service';
import type { CurrentUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import {
  InventoryItemAccountingCardQueryDto,
  InventoryMovementCategory,
  InventoryMovementFiltersDto,
} from './dto/inventory-item-accounting-card-query.dto';
import { ListInventoryItemsQueryDto } from './dto/list-inventory-items-query.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import {
  inventoryItemHistoryCsv,
  InventoryMovementCsvRow,
} from './inventory-item-history.csv';

const organizationPersonInclude = {
  management: { select: { id: true, name: true } },
  service: { select: { id: true, name: true } },
  unit: { select: { id: true, name: true } },
} satisfies Prisma.ResponsiblePersonInclude;

const movementInclude = {
  responsiblePerson: { include: organizationPersonInclude },
  importBatch: {
    select: { id: true, originalFilename: true, type: true, status: true },
  },
  document: {
    include: {
      sourceResponsiblePerson: true,
      destinationResponsiblePerson: true,
      createdByUser: { select: { username: true } },
      postedByUser: { select: { username: true } },
      cancelledByUser: { select: { username: true } },
    },
  },
} satisfies Prisma.StockTransactionInclude;

const cardDocumentInclude = {
  sourceResponsiblePerson: true,
  destinationResponsiblePerson: true,
  createdByUser: { select: { username: true } },
  postedByUser: { select: { username: true } },
  cancelledByUser: { select: { username: true } },
  lines: {
    select: { inventoryItemId: true, quantity: true },
  },
  attachments: {
    select: {
      id: true,
      originalFileName: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
    },
  },
} satisfies Prisma.StockDocumentInclude;

type CardMovement = Prisma.StockTransactionGetPayload<{
  include: typeof movementInclude;
}>;
type CardDocument = Prisma.StockDocumentGetPayload<{
  include: typeof cardDocumentInclude;
}>;

export type TransferHistoryQuery = {
  page?: string | number;
  limit?: string | number;
};

const CURRENT_MOVEMENT_TYPES = [
  StockTransactionType.INITIAL_BALANCE,
  StockTransactionType.RECEIPT,
  StockTransactionType.IMPORT_RECEIPT,
  StockTransactionType.MANUAL_RECEIPT,
  StockTransactionType.MVO_TRANSFER_OUT,
  StockTransactionType.MVO_TRANSFER_REVERSAL,
  StockTransactionType.ISSUE,
  StockTransactionType.ISSUE_OUT,
  StockTransactionType.ISSUE_FROM_DIRECT,
  StockTransactionType.ISSUE_FROM_CUSTODY,
  StockTransactionType.ISSUE_REVERSAL,
] as const;

@Injectable()
export class InventoryItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService =
      new AccessControlService(prisma),
  ) {}

  async findAll(query: ListInventoryItemsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();
    const searchWhere: Prisma.InventoryItemWhereInput | undefined = search
      ? {
          OR: [
            { externalCode: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
          ],
        }
      : undefined;
    const where: Prisma.InventoryItemWhereInput = {
      reviewStatus: query.reviewStatus,
      isActive: query.isActive,
      AND: [searchWhere].filter(
        (item): item is Prisma.InventoryItemWhereInput => Boolean(item),
      ),
    };
    const [items, total] = await Promise.all([
      this.prisma.inventoryItem.findMany({
        where,
        orderBy: [{ reviewStatus: 'desc' }, { externalCode: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: { select: { stockBalances: true } },
          stockBalances: {
            select: { quantity: true },
          },
        },
      }),
      this.prisma.inventoryItem.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        ...item,
        totalQuantity: item.stockBalances
          .reduce(
            (sum, balance) => sum.plus(balance.quantity),
            new Prisma.Decimal(0),
          )
          .toString(),
        responsiblePersonsCount: item._count.stockBalances,
        stockBalances: undefined,
        _count: undefined,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id },
    });

    if (!item) {
      throw new NotFoundException('Номенклатурну позицію не знайдено');
    }

    return item;
  }

  async myTransferHistory(
    id: string,
    actor: CurrentUser,
    query: TransferHistoryQuery,
  ) {
    if (actor.role !== UserRole.MVO || !actor.responsiblePersonId) {
      throw new ForbiddenException(
        'Історія власних передач доступна лише пов’язаному МВО',
      );
    }

    const history = await this.transferHistoryData(
      id,
      query,
      actor.responsiblePersonId,
    );
    const balance = await this.prisma.stockBalance.findUnique({
      where: {
        responsiblePersonId_inventoryItemId: {
          responsiblePersonId: actor.responsiblePersonId,
          inventoryItemId: id,
        },
      },
      select: { quantity: true },
    });

    return {
      inventoryItem: history.inventoryItem,
      currentBalance: (balance?.quantity ?? new Prisma.Decimal(0)).toString(),
      items: history.documents.map((document) => ({
        documentId: document.id,
        displayNumber: document.displayNumber,
        documentDate: document.documentDate,
        status: document.status,
        quantity: this.sumQuantities(document.lines).toString(),
        recipient: document.destinationResponsiblePerson
          ? this.transferPerson(document.destinationResponsiblePerson)
          : null,
      })),
      pagination: history.pagination,
    };
  }

  async myMovementHistory(
    id: string,
    actor: CurrentUser,
    query: TransferHistoryQuery,
  ) {
    if (actor.role !== UserRole.MVO || !actor.responsiblePersonId) {
      throw new ForbiddenException(
        'Історія власного майна доступна лише пов’язаному МВО',
      );
    }

    const inventoryItem = await this.findOne(id);
    const { page, limit } = this.transferHistoryPagination(query);
    const responsiblePersonId = actor.responsiblePersonId;
    const where = this.movementWhere(id, { responsiblePersonId });
    const [balance, movements, total] = await Promise.all([
      this.prisma.stockBalance.findUnique({
        where: {
          responsiblePersonId_inventoryItemId: {
            responsiblePersonId,
            inventoryItemId: id,
          },
        },
        select: { quantity: true },
      }),
      this.prisma.stockTransaction.findMany({
        where,
        include: movementInclude,
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.stockTransaction.count({ where }),
    ]);

    return {
      inventoryItem: {
        id: inventoryItem.id,
        code: inventoryItem.externalCode,
        name: inventoryItem.name,
        unit: inventoryItem.unitOfMeasure,
      },
      currentBalance: (balance?.quantity ?? new Prisma.Decimal(0)).toString(),
      items: movements.map((movement) =>
        this.serializeMovementForMvo(movement, responsiblePersonId),
      ),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async transferHistory(
    id: string,
    query: TransferHistoryQuery,
    actor: CurrentUser,
  ) {
    const inventoryItem = await this.inventoryItemForScopedHistory(id, actor);
    const history = await this.transferHistoryData(
      id,
      query,
      undefined,
      this.accessControl.stockDocumentFilter(actor),
      inventoryItem,
    );

    return {
      inventoryItem: history.inventoryItem,
      items: history.documents.map((document) => ({
        documentId: document.id,
        displayNumber: document.displayNumber,
        documentDate: document.documentDate,
        status: document.status,
        quantity: this.sumQuantities(document.lines).toString(),
        sender: this.transferPerson(document.sourceResponsiblePerson),
        recipient: document.destinationResponsiblePerson
          ? this.transferPerson(document.destinationResponsiblePerson)
          : null,
      })),
      pagination: history.pagination,
    };
  }

  async accountingCard(
    id: string,
    query: InventoryItemAccountingCardQueryDto,
  ) {
    const inventoryItem = await this.findOne(id);
    const movementPage = query.movementPage ?? 1;
    const movementLimit = query.movementLimit ?? 20;
    const documentPage = query.documentPage ?? 1;
    const documentLimit = query.documentLimit ?? 20;
    const movementWhere = this.movementWhere(id, query);

    const [
      balances,
      movements,
      movementTotal,
      stockDocuments,
      stockDocumentTotal,
      importDocuments,
      importDocumentTotal,
    ] = await Promise.all([
      this.prisma.stockBalance.findMany({
        where: { inventoryItemId: id },
        include: {
          responsiblePerson: { include: organizationPersonInclude },
        },
        orderBy: [
          { responsiblePerson: { externalAccountingCode: 'asc' } },
          { responsiblePerson: { personnelNumber: 'asc' } },
          { updatedAt: 'desc' },
        ],
      }),
      this.prisma.stockTransaction.findMany({
        where: movementWhere,
        include: movementInclude,
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
        skip: (movementPage - 1) * movementLimit,
        take: movementLimit,
      }),
      this.prisma.stockTransaction.count({ where: movementWhere }),
      this.prisma.stockDocument.findMany({
        where: { lines: { some: { inventoryItemId: id } } },
        include: cardDocumentInclude,
        orderBy: [{ documentDate: 'desc' }, { createdAt: 'desc' }],
        take: documentPage * documentLimit,
      }),
      this.prisma.stockDocument.count({
        where: { lines: { some: { inventoryItemId: id } } },
      }),
      this.prisma.importBatch.findMany({
        where: { rows: { some: { inventoryItemId: id } } },
        include: {
          transactions: {
            where: { inventoryItemId: id },
            select: { quantity: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: documentPage * documentLimit,
      }),
      this.prisma.importBatch.count({
        where: { rows: { some: { inventoryItemId: id } } },
      }),
    ]);

    const currentQuantity = this.sumQuantities(balances);
    const documents = [
      ...stockDocuments.map((document) =>
        this.serializeStockDocument(document, id),
      ),
      ...importDocuments.map((batch) => ({
        kind: 'IMPORT' as const,
        id: batch.id,
        occurredAt: batch.completedAt ?? batch.createdAt,
        title: batch.originalFilename,
        typeLabel: 'Імпорт CSV',
        statusLabel: this.importStatusLabel(batch.status),
        from: 'Бухгалтерський CSV',
        to: 'Залишки МВО',
        quantity: this.sumQuantities(batch.transactions).toString(),
        attachments: [],
      })),
    ]
      .sort(
        (left, right) =>
          right.occurredAt.getTime() - left.occurredAt.getTime(),
      )
      .slice((documentPage - 1) * documentLimit, documentPage * documentLimit);
    const documentTotal = stockDocumentTotal + importDocumentTotal;

    return {
      inventoryItem,
      currentBalances: balances.map((balance) => ({
        id: balance.id,
        responsiblePerson: this.organizationPerson(
          balance.responsiblePerson,
        ),
        quantity: balance.quantity.toString(),
        updatedAt: balance.updatedAt,
      })),
      totals: {
        currentQuantity: currentQuantity.toString(),
        responsiblePersons: balances.filter((balance) =>
          balance.quantity.greaterThan(0),
        ).length,
      },
      movements: {
        items: movements.map((movement) => this.serializeMovement(movement)),
        pagination: {
          page: movementPage,
          limit: movementLimit,
          total: movementTotal,
          totalPages: Math.ceil(movementTotal / movementLimit),
        },
      },
      documents: {
        items: documents,
        pagination: {
          page: documentPage,
          limit: documentLimit,
          total: documentTotal,
          totalPages: Math.ceil(documentTotal / documentLimit),
        },
      },
    };
  }

  async exportAccountingCardMovements(
    id: string,
    filters: InventoryMovementFiltersDto,
  ) {
    const inventoryItem = await this.findOne(id);
    const movements = await this.prisma.stockTransaction.findMany({
      where: this.movementWhere(id, filters),
      include: movementInclude,
      orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }],
    });
    const rows: InventoryMovementCsvRow[] = movements.map((movement) => {
      const serialized = this.serializeMovement(movement);
      return {
        occurredAt: movement.occurredAt,
        typeLabel: serialized.typeLabel,
        from: serialized.from,
        to: serialized.to,
        quantity: serialized.quantity,
        balanceBefore: serialized.balanceBefore,
        balanceAfter: serialized.balanceAfter,
        documentNumber: serialized.documentNumber,
        source: serialized.source,
        user: serialized.user ?? '',
      };
    });
    const safeCode = inventoryItem.externalCode.replace(/[^a-zA-Z0-9_-]/g, '_');
    return {
      filename: `inventory-history-${safeCode || 'item'}.csv`,
      csv: inventoryItemHistoryCsv(rows),
    };
  }

  private movementWhere(
    inventoryItemId: string,
    filters: InventoryMovementFiltersDto,
  ): Prisma.StockTransactionWhereInput {
    const documentNumber = filters.documentNumber?.trim();
    return {
      inventoryItemId,
      occurredAt: {
        gte: filters.dateFrom
          ? new Date(`${filters.dateFrom}T00:00:00.000Z`)
          : undefined,
        lte: filters.dateTo
          ? new Date(`${filters.dateTo}T23:59:59.999Z`)
          : undefined,
      },
      AND: [
        this.movementCategoryWhere(filters.movementType),
        filters.responsiblePersonId
          ? {
              OR: [
                { responsiblePersonId: filters.responsiblePersonId },
                {
                  document: {
                    sourceResponsiblePersonId: filters.responsiblePersonId,
                  },
                },
                {
                  document: {
                    destinationResponsiblePersonId:
                      filters.responsiblePersonId,
                  },
                },
              ],
            }
          : undefined,
        documentNumber
          ? {
              OR: [
                {
                  sourceDocument: {
                    contains: documentNumber,
                    mode: 'insensitive',
                  },
                },
                {
                  document: {
                    documentNumber: {
                      contains: documentNumber,
                      mode: 'insensitive',
                    },
                  },
                },
                {
                  importBatch: {
                    originalFilename: {
                      contains: documentNumber,
                      mode: 'insensitive',
                    },
                  },
                },
              ],
            }
          : undefined,
      ].filter(
        (item): item is Prisma.StockTransactionWhereInput => Boolean(item),
      ),
    };
  }

  private async transferHistoryData(
    inventoryItemId: string,
    query: TransferHistoryQuery,
    sourceResponsiblePersonId?: string,
    authorizationWhere: Prisma.StockDocumentWhereInput = {},
    accessibleInventoryItem?: Awaited<ReturnType<InventoryItemsService['findOne']>>,
  ) {
    const inventoryItem =
      accessibleInventoryItem ?? (await this.findOne(inventoryItemId));
    const { page, limit } = this.transferHistoryPagination(query);
    const where: Prisma.StockDocumentWhereInput = {
      AND: [
        authorizationWhere,
        {
          type: StockDocumentType.MVO_TRANSFER,
          status: {
            in: [StockDocumentStatus.POSTED, StockDocumentStatus.CANCELLED],
          },
          sourceResponsiblePersonId,
          lines: { some: { inventoryItemId } },
        },
      ],
    };
    const personSelect = {
      id: true,
      personnelNumber: true,
      externalAccountingCode: true,
      lastName: true,
      firstName: true,
      middleName: true,
    } satisfies Prisma.ResponsiblePersonSelect;
    const [documents, total] = await Promise.all([
      this.prisma.stockDocument.findMany({
        where,
        select: {
          id: true,
          displayNumber: true,
          documentDate: true,
          status: true,
          createdAt: true,
          sourceResponsiblePerson: { select: personSelect },
          destinationResponsiblePerson: { select: personSelect },
          lines: {
            where: { inventoryItemId },
            select: { quantity: true },
          },
        },
        orderBy: [{ documentDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.stockDocument.count({ where }),
    ]);

    return {
      inventoryItem: {
        id: inventoryItem.id,
        code: inventoryItem.externalCode,
        name: inventoryItem.name,
        unit: inventoryItem.unitOfMeasure,
      },
      documents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private async inventoryItemForScopedHistory(id: string, actor: CurrentUser) {
    if (actor.role !== UserRole.ORG_MANAGER) return this.findOne(id);

    const responsiblePerson = this.accessControl.responsiblePersonFilter(actor);
    const transaction = this.accessControl.stockTransactionFilter(actor);
    const document = this.accessControl.stockDocumentFilter(actor);
    const inventoryItem = await this.prisma.inventoryItem.findFirst({
      where: {
        id,
        OR: [
          { stockBalances: { some: { responsiblePerson } } },
          { stockTransactions: { some: transaction } },
          { stockDocumentLines: { some: { document } } },
        ],
      },
    });
    if (!inventoryItem) {
      throw new NotFoundException('Номенклатурну позицію не знайдено');
    }
    return inventoryItem;
  }

  private transferHistoryPagination(query: TransferHistoryQuery) {
    const page = query.page === undefined ? 1 : Number(query.page);
    const limit = query.limit === undefined ? 25 : Number(query.limit);
    if (!Number.isInteger(page) || page < 1) {
      throw new BadRequestException('Сторінка повинна бути цілим числом від 1');
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException(
        'Кількість записів повинна бути цілим числом від 1 до 100',
      );
    }
    return { page, limit };
  }

  private movementCategoryWhere(
    category?: InventoryMovementCategory,
  ): Prisma.StockTransactionWhereInput | undefined {
    if (!category) return undefined;
    if (category === 'IMPORT') {
      return {
        importBatchId: { not: null },
        type: {
          in: [
            StockTransactionType.INITIAL_BALANCE,
            StockTransactionType.RECEIPT,
            StockTransactionType.IMPORT_RECEIPT,
          ],
        },
      };
    }
    if (category === 'MANUAL_RECEIPT') {
      return {
        OR: [
          { type: StockTransactionType.MANUAL_RECEIPT },
          { type: StockTransactionType.RECEIPT, importBatchId: null },
        ],
      };
    }
    if (category === 'MVO_TRANSFER') {
      return { type: StockTransactionType.MVO_TRANSFER_OUT };
    }
    if (category === 'MVO_TRANSFER_REVERSAL') {
      return { type: StockTransactionType.MVO_TRANSFER_REVERSAL };
    }
    if (category === 'ISSUE') {
      return {
        type: {
          in: [
            StockTransactionType.ISSUE,
            StockTransactionType.ISSUE_OUT,
            StockTransactionType.ISSUE_FROM_DIRECT,
            StockTransactionType.ISSUE_FROM_CUSTODY,
          ],
        },
      };
    }
    if (category === 'ISSUE_REVERSAL') {
      return { type: StockTransactionType.ISSUE_REVERSAL };
    }
    return { type: { notIn: [...CURRENT_MOVEMENT_TYPES] } };
  }

  private serializeMovement(movement: CardMovement) {
    const category = this.movementCategory(movement);
    const document = movement.document;
    const sourcePerson = document?.sourceResponsiblePerson;
    const destinationPerson = document?.destinationResponsiblePerson;
    const responsiblePerson = this.personLabel(movement.responsiblePerson);
    let from = responsiblePerson;
    let to = '—';

    if (category === 'IMPORT') {
      from = 'Бухгалтерський CSV';
      to = responsiblePerson;
    } else if (category === 'MANUAL_RECEIPT') {
      from = movement.sourceDocument || 'Ручний прихід';
      to = responsiblePerson;
    } else if (category === 'MVO_TRANSFER') {
      from = sourcePerson ? this.personLabel(sourcePerson) : responsiblePerson;
      to = destinationPerson ? this.personLabel(destinationPerson) : '—';
    } else if (category === 'MVO_TRANSFER_REVERSAL') {
      from = destinationPerson ? this.personLabel(destinationPerson) : 'Скасована передача';
      to = sourcePerson ? this.personLabel(sourcePerson) : responsiblePerson;
    } else if (category === 'ISSUE') {
      from = sourcePerson ? this.personLabel(sourcePerson) : responsiblePerson;
      to = document?.recipientName || 'Зовнішній одержувач';
    } else if (category === 'ISSUE_REVERSAL') {
      from = document?.recipientName || 'Скасована видача';
      to = sourcePerson ? this.personLabel(sourcePerson) : responsiblePerson;
    } else if (document) {
      from = sourcePerson ? this.personLabel(sourcePerson) : responsiblePerson;
      to = destinationPerson
        ? this.personLabel(destinationPerson)
        : document.recipientName || '—';
    }

    const delta = movement.balanceAfter.minus(movement.balanceBefore);
    const quantity = delta.equals(0)
      ? movement.quantity.toString()
      : delta.toString();
    const documentNumber = document
      ? `№ ${document.displayNumber}`
      : movement.importBatch?.originalFilename || movement.sourceDocument || '—';
    const source = movement.importBatch
      ? `Імпорт: ${movement.importBatch.originalFilename}`
      : document
        ? `Документ № ${document.displayNumber}`
        : movement.sourceDocument || 'Ручна операція';
    const user =
      category === 'MVO_TRANSFER_REVERSAL' || category === 'ISSUE_REVERSAL'
        ? document?.cancelledByUser?.username
        : document?.postedByUser?.username || document?.createdByUser.username;

    return {
      id: movement.id,
      occurredAt: movement.occurredAt,
      category,
      typeLabel: this.movementTypeLabel(category),
      from,
      to,
      quantity,
      balanceBefore: movement.balanceBefore.toString(),
      balanceAfter: movement.balanceAfter.toString(),
      documentNumber,
      source,
      note: document?.note ?? document?.basis ?? movement.comment ?? null,
      user: user ?? null,
      responsiblePerson: this.organizationPerson(movement.responsiblePerson),
      documentId: document?.id ?? null,
      importBatchId: movement.importBatch?.id ?? null,
    };
  }

  private serializeMovementForMvo(
    movement: CardMovement,
    responsiblePersonId: string,
  ) {
    const serialized = this.serializeMovement(movement);
    const incomingTransfer =
      movement.document?.type === StockDocumentType.MVO_TRANSFER &&
      movement.document.destinationResponsiblePersonId ===
        responsiblePersonId &&
      movement.document.sourceResponsiblePersonId !== responsiblePersonId;

    if (!incomingTransfer) return serialized;

    if (movement.type === StockTransactionType.MVO_TRANSFER_OUT) {
      return {
        ...serialized,
        typeLabel: 'Отримання від іншого МВО',
        quantity: movement.quantity.toString(),
      };
    }

    if (movement.type === StockTransactionType.MVO_TRANSFER_REVERSAL) {
      return {
        ...serialized,
        typeLabel: 'Скасування отримання від іншого МВО',
        quantity: `-${movement.quantity.toString()}`,
      };
    }

    return serialized;
  }

  private movementCategory(movement: CardMovement): InventoryMovementCategory {
    if (
      movement.importBatch &&
      ([
        StockTransactionType.INITIAL_BALANCE,
        StockTransactionType.RECEIPT,
        StockTransactionType.IMPORT_RECEIPT,
      ] as StockTransactionType[]).includes(movement.type)
    ) {
      return 'IMPORT';
    }
    if (
      movement.type === StockTransactionType.MANUAL_RECEIPT ||
      (movement.type === StockTransactionType.RECEIPT && !movement.importBatch)
    ) {
      return 'MANUAL_RECEIPT';
    }
    if (movement.type === StockTransactionType.MVO_TRANSFER_OUT) {
      return 'MVO_TRANSFER';
    }
    if (movement.type === StockTransactionType.MVO_TRANSFER_REVERSAL) {
      return 'MVO_TRANSFER_REVERSAL';
    }
    if (
      ([
        StockTransactionType.ISSUE,
        StockTransactionType.ISSUE_OUT,
        StockTransactionType.ISSUE_FROM_DIRECT,
        StockTransactionType.ISSUE_FROM_CUSTODY,
      ] as StockTransactionType[]).includes(movement.type)
    ) {
      return 'ISSUE';
    }
    if (movement.type === StockTransactionType.ISSUE_REVERSAL) {
      return 'ISSUE_REVERSAL';
    }
    return 'LEGACY';
  }

  private movementTypeLabel(category: InventoryMovementCategory) {
    const labels: Record<InventoryMovementCategory, string> = {
      IMPORT: 'Прихід за CSV',
      MANUAL_RECEIPT: 'Ручний прихід',
      MVO_TRANSFER: 'Передача між МВО',
      ISSUE: 'Видача',
      MVO_TRANSFER_REVERSAL: 'Скасування передачі',
      ISSUE_REVERSAL: 'Скасування видачі',
      LEGACY: 'Стара операція',
    };
    return labels[category];
  }

  private serializeStockDocument(document: CardDocument, inventoryItemId: string) {
    const quantity = this.sumQuantities(
      document.lines.filter((line) => line.inventoryItemId === inventoryItemId),
    );
    return {
      kind: 'STOCK_DOCUMENT' as const,
      id: document.id,
      occurredAt:
        document.cancelledAt ?? document.postedAt ?? document.documentDate,
      title: `№ ${document.displayNumber}`,
      typeLabel: this.documentTypeLabel(document.type),
      statusLabel: this.documentStatusLabel(document.status),
      from: this.personLabel(document.sourceResponsiblePerson),
      to: document.destinationResponsiblePerson
        ? this.personLabel(document.destinationResponsiblePerson)
        : document.recipientName || '—',
      quantity: quantity.toString(),
      attachments: document.attachments,
    };
  }

  private documentTypeLabel(type: StockDocumentType) {
    if (type === StockDocumentType.MVO_TRANSFER) return 'Передача між МВО';
    if (type === StockDocumentType.ISSUE) return 'Видача';
    return 'Старий документ передачі';
  }

  private documentStatusLabel(status: StockDocumentStatus) {
    if (status === StockDocumentStatus.POSTED) return 'Проведено';
    if (status === StockDocumentStatus.CANCELLED) return 'Скасовано';
    return 'Чернетка';
  }

  private importStatusLabel(status: string) {
    if (status === 'COMPLETED' || status === 'PARTIALLY_COMPLETED') {
      return 'Проведено';
    }
    if (status === 'CANCELLED' || status === 'ROLLED_BACK') {
      return 'Скасовано';
    }
    if (status === 'FAILED') return 'Помилка';
    return 'Не проведено';
  }

  private organizationPerson(person: {
    id: string;
    lastName: string;
    firstName: string;
    middleName: string | null;
    personnelNumber: string;
    externalAccountingCode: string | null;
    management: { id: string; name: string };
    service: { id: string; name: string };
    unit: { id: string; name: string } | null;
  }) {
    return {
      ...this.personReference(person),
      management: person.management,
      service: person.service,
      unit: person.unit,
    };
  }

  private personLabel(person: {
    lastName: string;
    firstName: string;
    middleName: string | null;
    personnelNumber: string;
    externalAccountingCode: string | null;
  }) {
    return `${person.externalAccountingCode ?? 'Не вказано'} — ${[
      person.lastName,
      person.firstName,
      person.middleName,
    ]
      .filter(Boolean)
      .join(' ')}`;
  }

  async create(dto: CreateInventoryItemDto) {
    try {
      return await this.prisma.inventoryItem.create({
        data: {
          ...this.normalize(dto),
          reviewStatus: dto.reviewStatus ?? InventoryItemReviewStatus.VERIFIED,
          createdManually: true,
        },
      });
    } catch (error) {
      this.handleUniqueError(error);
    }
  }

  async update(id: string, dto: UpdateInventoryItemDto) {
    await this.findOne(id);

    try {
      return await this.prisma.inventoryItem.update({
        where: { id },
        data: this.normalize(dto),
      });
    } catch (error) {
      this.handleUniqueError(error);
    }
  }

  normalize<T extends { externalCode?: string; name?: string }>(dto: T): T {
    return {
      ...dto,
      externalCode: dto.externalCode?.trim(),
      name: dto.name?.trim().replace(/\s+/g, ' '),
    };
  }

  private sumQuantities(rows: { quantity: Prisma.Decimal }[]) {
    return rows.reduce(
      (sum, row) => sum.plus(row.quantity),
      new Prisma.Decimal(0),
    );
  }

  private personReference(person: {
    id: string;
    lastName: string;
    firstName: string;
    middleName: string | null;
    personnelNumber: string;
    externalAccountingCode: string | null;
  }) {
    return {
      id: person.id,
      fullName: [person.lastName, person.firstName, person.middleName]
        .filter(Boolean)
        .join(' '),
      personnelNumber: person.personnelNumber,
      externalAccountingCode: person.externalAccountingCode,
    };
  }

  private transferPerson(person: {
    id: string;
    lastName: string;
    firstName: string;
    middleName: string | null;
    personnelNumber: string;
    externalAccountingCode: string | null;
  }) {
    const reference = this.personReference(person);
    return {
      id: reference.id,
      externalAccountingCode: reference.externalAccountingCode,
      fullName: reference.fullName,
    };
  }

  private handleUniqueError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Код номенклатури вже використовується');
    }

    throw error;
  }
}
