import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  StockAccountingModel,
  StockDocumentType,
  StockSourceKind,
  StockTransactionType,
  UserRole,
} from '@prisma/client';
import type { CurrentUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ListStockBalancesQueryDto } from './dto/list-stock-balances-query.dto';
import { ListStockTransactionsQueryDto } from './dto/list-stock-transactions-query.dto';
import { ManualReceiptDto } from './dto/manual-receipt.dto';
import { assertCustodyPartiesDiffer } from './stock-accounting.domain';

type TransactionClient = Prisma.TransactionClient;

type CustodyMovementInput = {
  type: StockTransactionType;
  accountingOwnerResponsiblePersonId: string;
  custodianResponsiblePersonId: string;
  inventoryItemId: string;
  quantity: string | Prisma.Decimal;
  occurredAt: Date;
  sourceCustodianResponsiblePersonId?: string | null;
  destinationCustodianResponsiblePersonId?: string | null;
  sourceDocument?: string | null;
  comment?: string | null;
  documentId?: string | null;
  documentLineId?: string | null;
  reversalOfTransactionId?: string | null;
};

const balanceInclude = {
  responsiblePerson: {
    select: {
      id: true,
      lastName: true,
      firstName: true,
      middleName: true,
      personnelNumber: true,
      managementId: true,
      serviceId: true,
      unitId: true,
    },
  },
  inventoryItem: {
    select: {
      id: true,
      externalCode: true,
      name: true,
      unitOfMeasure: true,
    },
  },
} satisfies Prisma.StockBalanceInclude;

const transactionInclude = {
  document: { select: { displayNumber: true } },
  responsiblePerson: {
    select: {
      id: true,
      lastName: true,
      firstName: true,
      middleName: true,
      personnelNumber: true,
    },
  },
  inventoryItem: {
    select: {
      id: true,
      externalCode: true,
      name: true,
      unitOfMeasure: true,
    },
  },
} satisfies Prisma.StockTransactionInclude;

const custodyCardInclude = {
  inventoryItem: true,
  accountingOwnerResponsiblePerson: true,
  custodianResponsiblePerson: true,
} satisfies Prisma.CustodyBalanceInclude;

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  async listBalances(query: ListStockBalancesQueryDto, user?: CurrentUser) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.buildBalanceWhere(query, user);
    const [items, total] = await Promise.all([
      this.prisma.stockBalance.findMany({
        where,
        include: balanceInclude,
        orderBy: [{ updatedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.stockBalance.count({ where }),
    ]);
    const assignedByOwnerAndItem = await this.assignedQuantities(
      items.map((item) => ({
        accountingOwnerResponsiblePersonId: item.responsiblePersonId,
        inventoryItemId: item.inventoryItemId,
      })),
    );

    return {
      items: items.map((item) =>
        this.serializeBalance(
          item,
          assignedByOwnerAndItem.get(
            this.ownerItemKey(item.responsiblePersonId, item.inventoryItemId),
          ) ?? new Prisma.Decimal(0),
        ),
      ),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findBalance(id: string, user?: CurrentUser) {
    const balance = await this.prisma.stockBalance.findFirst({
      where: {
        id,
        responsiblePersonId:
          user?.role === UserRole.MVO
            ? (user.responsiblePersonId ?? '__no_mvo_person__')
            : undefined,
      },
      include: balanceInclude,
    });

    if (!balance) {
      throw new NotFoundException('Залишок не знайдено');
    }

    const assigned = await this.prisma.custodyBalance.aggregate({
      where: {
        accountingOwnerResponsiblePersonId: balance.responsiblePersonId,
        inventoryItemId: balance.inventoryItemId,
      },
      _sum: { quantity: true },
    });

    return this.serializeBalance(
      balance,
      assigned._sum.quantity ?? new Prisma.Decimal(0),
    );
  }

  async listTransactions(query: ListStockTransactionsQueryDto, user?: CurrentUser) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const mvoId =
      user?.role === UserRole.MVO
        ? (user.responsiblePersonId ?? '__no_mvo_person__')
        : undefined;
    const where: Prisma.StockTransactionWhereInput = {
      responsiblePersonId: mvoId ? undefined : query.responsiblePersonId,
      inventoryItemId: query.inventoryItemId,
      type: query.type,
      importBatchId: query.importBatchId,
      occurredAt: {
        gte: query.dateFrom ? new Date(query.dateFrom) : undefined,
        lte: query.dateTo ? new Date(query.dateTo) : undefined,
      },
      OR: mvoId
        ? [
            { responsiblePersonId: mvoId },
            { accountingOwnerResponsiblePersonId: mvoId },
            { sourceCustodianResponsiblePersonId: mvoId },
            { destinationCustodianResponsiblePersonId: mvoId },
          ]
        : undefined,
    };

    const [items, total] = await Promise.all([
      this.prisma.stockTransaction.findMany({
        where,
        include: transactionInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.stockTransaction.count({ where }),
    ]);

    return {
      items: items.map((item) => this.serializeTransaction(item)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findTransaction(id: string, user?: CurrentUser) {
    const mvoId =
      user?.role === UserRole.MVO
        ? (user.responsiblePersonId ?? '__no_mvo_person__')
        : undefined;
    const transaction = await this.prisma.stockTransaction.findFirst({
      where: {
        id,
        OR: mvoId
          ? [
              { responsiblePersonId: mvoId },
              { accountingOwnerResponsiblePersonId: mvoId },
              { sourceCustodianResponsiblePersonId: mvoId },
              { destinationCustodianResponsiblePersonId: mvoId },
            ]
          : undefined,
      },
      include: transactionInclude,
    });

    if (!transaction) {
      throw new NotFoundException('Операцію не знайдено');
    }

    return this.serializeTransaction(transaction);
  }

  async manualReceipt(dto: ManualReceiptDto) {
    return this.createIncreasingTransaction({
      type: StockTransactionType.MANUAL_RECEIPT,
      responsiblePersonId: dto.responsiblePersonId,
      inventoryItemId: dto.inventoryItemId,
      quantity: dto.quantity,
      occurredAt: new Date(dto.occurredAt),
      sourceDocument: dto.sourceDocument,
      comment: dto.comment,
    });
  }

  async createIncreasingTransaction(input: {
    type: StockTransactionType;
    responsiblePersonId: string;
    inventoryItemId: string;
    quantity: string | Prisma.Decimal;
    occurredAt: Date;
    sourceDocument?: string | null;
    comment?: string | null;
    importBatchId?: string | null;
    importRowId?: string | null;
    documentId?: string | null;
    documentLineId?: string | null;
    accountingModel?: StockAccountingModel | null;
    bucketKind?: StockSourceKind | null;
    accountingOwnerResponsiblePersonId?: string | null;
    sourceCustodianResponsiblePersonId?: string | null;
    destinationCustodianResponsiblePersonId?: string | null;
    reversalOfTransactionId?: string | null;
  }) {
    const quantity = new Prisma.Decimal(input.quantity);

    if (quantity.lte(0)) {
      throw new BadRequestException('Кількість має бути більшою за 0');
    }

    return this.prisma.$transaction(async (tx) => {
      return this.createIncreasingTransactionInTx(tx, input);
    });
  }

  async createIncreasingTransactionInTx(
    tx: TransactionClient,
    input: {
      type: StockTransactionType;
      responsiblePersonId: string;
      inventoryItemId: string;
      quantity: string | Prisma.Decimal;
      occurredAt: Date;
      sourceDocument?: string | null;
      comment?: string | null;
      importBatchId?: string | null;
      importRowId?: string | null;
      documentId?: string | null;
      documentLineId?: string | null;
      accountingModel?: StockAccountingModel | null;
      bucketKind?: StockSourceKind | null;
      accountingOwnerResponsiblePersonId?: string | null;
      sourceCustodianResponsiblePersonId?: string | null;
      destinationCustodianResponsiblePersonId?: string | null;
      reversalOfTransactionId?: string | null;
    },
  ) {
    const quantity = new Prisma.Decimal(input.quantity);

    if (quantity.lte(0)) {
      throw new BadRequestException('Кількість має бути більшою за 0');
    }

    const [responsiblePerson, inventoryItem] = await Promise.all([
      tx.responsiblePerson.findUnique({
        where: { id: input.responsiblePersonId },
        select: { id: true },
      }),
      tx.inventoryItem.findUnique({
        where: { id: input.inventoryItemId },
        select: { id: true },
      }),
    ]);

    if (!responsiblePerson) {
      throw new BadRequestException('МВО не знайдено');
    }

    if (!inventoryItem) {
      throw new BadRequestException('Номенклатурну позицію не знайдено');
    }

    await tx.stockBalance.upsert({
      where: {
        responsiblePersonId_inventoryItemId: {
          responsiblePersonId: input.responsiblePersonId,
          inventoryItemId: input.inventoryItemId,
        },
      },
      update: {},
      create: {
        responsiblePersonId: input.responsiblePersonId,
        inventoryItemId: input.inventoryItemId,
        quantity: new Prisma.Decimal(0),
      },
    });

    const lockedBalances = await tx.$queryRaw<{ quantity: Prisma.Decimal }[]>`
      SELECT "quantity"
      FROM "StockBalance"
      WHERE "responsiblePersonId" = ${input.responsiblePersonId}::uuid
        AND "inventoryItemId" = ${input.inventoryItemId}::uuid
      FOR UPDATE
    `;
    const balanceBefore = lockedBalances[0]?.quantity ?? new Prisma.Decimal(0);
    const balanceAfter = balanceBefore.plus(quantity);

    await tx.stockBalance.update({
      where: {
        responsiblePersonId_inventoryItemId: {
          responsiblePersonId: input.responsiblePersonId,
          inventoryItemId: input.inventoryItemId,
        },
      },
      data: { quantity: balanceAfter },
    });

    return tx.stockTransaction.create({
      data: {
        type: input.type,
        responsiblePersonId: input.responsiblePersonId,
        inventoryItemId: input.inventoryItemId,
        quantity,
        balanceBefore,
        balanceAfter,
        occurredAt: input.occurredAt,
        sourceDocument: input.sourceDocument,
        comment: input.comment,
        importBatchId: input.importBatchId,
        importRowId: input.importRowId,
        documentId: input.documentId,
        documentLineId: input.documentLineId,
        accountingModel: input.accountingModel,
        bucketKind: input.bucketKind,
        accountingOwnerResponsiblePersonId:
          input.accountingOwnerResponsiblePersonId,
        sourceCustodianResponsiblePersonId:
          input.sourceCustodianResponsiblePersonId,
        destinationCustodianResponsiblePersonId:
          input.destinationCustodianResponsiblePersonId,
        reversalOfTransactionId: input.reversalOfTransactionId,
      },
      include: transactionInclude,
    });
  }

  async createDecreasingTransactionInTx(
    tx: TransactionClient,
    input: {
      type: StockTransactionType;
      responsiblePersonId: string;
      inventoryItemId: string;
      quantity: string | Prisma.Decimal;
      occurredAt: Date;
      sourceDocument?: string | null;
      comment?: string | null;
      documentId?: string | null;
      documentLineId?: string | null;
      accountingModel?: StockAccountingModel | null;
      bucketKind?: StockSourceKind | null;
      accountingOwnerResponsiblePersonId?: string | null;
      sourceCustodianResponsiblePersonId?: string | null;
      destinationCustodianResponsiblePersonId?: string | null;
      reversalOfTransactionId?: string | null;
    },
  ) {
    const quantity = new Prisma.Decimal(input.quantity);
    if (quantity.lte(0)) {
      throw new BadRequestException('Кількість має бути більшою за 0');
    }

    const lockedBalances = await tx.$queryRaw<{ quantity: Prisma.Decimal }[]>`
      SELECT "quantity"
      FROM "StockBalance"
      WHERE "responsiblePersonId" = ${input.responsiblePersonId}::uuid
        AND "inventoryItemId" = ${input.inventoryItemId}::uuid
      FOR UPDATE
    `;
    const balanceBefore = lockedBalances[0]?.quantity;
    if (!balanceBefore || balanceBefore.lt(quantity)) {
      throw new BadRequestException('Недостатній залишок для проведення документа');
    }
    const balanceAfter = balanceBefore.minus(quantity);

    await tx.stockBalance.update({
      where: {
        responsiblePersonId_inventoryItemId: {
          responsiblePersonId: input.responsiblePersonId,
          inventoryItemId: input.inventoryItemId,
        },
      },
      data: { quantity: balanceAfter },
    });

    return tx.stockTransaction.create({
      data: {
        ...input,
        quantity,
        balanceBefore,
        balanceAfter,
      },
      include: transactionInclude,
    });
  }

  async createCustodyIncreasingTransactionInTx(
    tx: TransactionClient,
    input: CustodyMovementInput,
  ) {
    const quantity = new Prisma.Decimal(input.quantity);
    this.validateCustodyMovement(input, quantity);

    await tx.custodyBalance.upsert({
      where: {
        inventoryItemId_accountingOwnerResponsiblePersonId_custodianResponsiblePersonId:
          {
            inventoryItemId: input.inventoryItemId,
            accountingOwnerResponsiblePersonId:
              input.accountingOwnerResponsiblePersonId,
            custodianResponsiblePersonId: input.custodianResponsiblePersonId,
          },
      },
      update: {},
      create: {
        inventoryItemId: input.inventoryItemId,
        accountingOwnerResponsiblePersonId:
          input.accountingOwnerResponsiblePersonId,
        custodianResponsiblePersonId: input.custodianResponsiblePersonId,
        quantity: new Prisma.Decimal(0),
      },
    });

    const locked = await tx.$queryRaw<{ quantity: Prisma.Decimal }[]>`
      SELECT "quantity"
      FROM "CustodyBalance"
      WHERE "inventoryItemId" = ${input.inventoryItemId}::uuid
        AND "accountingOwnerResponsiblePersonId" = ${input.accountingOwnerResponsiblePersonId}::uuid
        AND "custodianResponsiblePersonId" = ${input.custodianResponsiblePersonId}::uuid
      FOR UPDATE
    `;
    const balanceBefore = locked[0]?.quantity ?? new Prisma.Decimal(0);
    const balanceAfter = balanceBefore.plus(quantity);

    await tx.custodyBalance.update({
      where: {
        inventoryItemId_accountingOwnerResponsiblePersonId_custodianResponsiblePersonId:
          {
            inventoryItemId: input.inventoryItemId,
            accountingOwnerResponsiblePersonId:
              input.accountingOwnerResponsiblePersonId,
            custodianResponsiblePersonId: input.custodianResponsiblePersonId,
          },
      },
      data: { quantity: balanceAfter },
    });

    return tx.stockTransaction.create({
      data: this.custodyTransactionData(
        input,
        quantity,
        balanceBefore,
        balanceAfter,
      ),
      include: transactionInclude,
    });
  }

  async createCustodyDecreasingTransactionInTx(
    tx: TransactionClient,
    input: CustodyMovementInput,
  ) {
    const quantity = new Prisma.Decimal(input.quantity);
    this.validateCustodyMovement(input, quantity);

    const locked = await tx.$queryRaw<{ quantity: Prisma.Decimal }[]>`
      SELECT "quantity"
      FROM "CustodyBalance"
      WHERE "inventoryItemId" = ${input.inventoryItemId}::uuid
        AND "accountingOwnerResponsiblePersonId" = ${input.accountingOwnerResponsiblePersonId}::uuid
        AND "custodianResponsiblePersonId" = ${input.custodianResponsiblePersonId}::uuid
      FOR UPDATE
    `;
    const balanceBefore = locked[0]?.quantity;
    if (!balanceBefore || balanceBefore.lt(quantity)) {
      throw new BadRequestException(
        'Недостатньо закріпленого майна для проведення документа',
      );
    }
    const balanceAfter = balanceBefore.minus(quantity);

    await tx.custodyBalance.update({
      where: {
        inventoryItemId_accountingOwnerResponsiblePersonId_custodianResponsiblePersonId:
          {
            inventoryItemId: input.inventoryItemId,
            accountingOwnerResponsiblePersonId:
              input.accountingOwnerResponsiblePersonId,
            custodianResponsiblePersonId: input.custodianResponsiblePersonId,
          },
      },
      data: { quantity: balanceAfter },
    });

    return tx.stockTransaction.create({
      data: this.custodyTransactionData(
        input,
        quantity,
        balanceBefore,
        balanceAfter,
      ),
      include: transactionInclude,
    });
  }

  async availableToMe(user: CurrentUser) {
    if (user.role !== UserRole.MVO || !user.responsiblePersonId) {
      throw new BadRequestException(
        'Доступне майно визначається лише для користувача з карткою МВО',
      );
    }
    const responsiblePersonId = user.responsiblePersonId;
    const [directBalances, custodyBalances] = await Promise.all([
      this.prisma.stockBalance.findMany({
        where: { responsiblePersonId, quantity: { gt: 0 } },
        include: balanceInclude,
        orderBy: { inventoryItem: { name: 'asc' } },
      }),
      this.prisma.custodyBalance.findMany({
        where: {
          custodianResponsiblePersonId: responsiblePersonId,
          quantity: { gt: 0 },
        },
        include: custodyCardInclude,
        orderBy: { inventoryItem: { name: 'asc' } },
      }),
    ]);

    return [
      ...directBalances.map((balance) => ({
        sourceKind: StockSourceKind.DIRECT,
        inventoryItem: balance.inventoryItem,
        accountingOwner: this.personReference(balance.responsiblePerson),
        currentCustodian: this.personReference(balance.responsiblePerson),
        availableQuantity: balance.quantity.toString(),
        sourceBalanceId: balance.id,
        canAssign: true,
        canIssue: true,
      })),
      ...custodyBalances.map((balance) => ({
        sourceKind: StockSourceKind.ASSIGNED,
        inventoryItem: balance.inventoryItem,
        accountingOwner: this.personReference(
          balance.accountingOwnerResponsiblePerson,
        ),
        currentCustodian: this.personReference(
          balance.custodianResponsiblePerson,
        ),
        availableQuantity: balance.quantity.toString(),
        sourceBalanceId: balance.id,
        canAssign: true,
        canIssue: true,
      })),
    ];
  }

  async responsiblePersonAccountingCard(id: string, user: CurrentUser) {
    if (user.role === UserRole.MVO && user.responsiblePersonId !== id) {
      throw new NotFoundException('Картку обліку МВО не знайдено');
    }

    const [directBalances, assignedToOthers, assignedToMe, recentAssignments, recentIssues] =
      await Promise.all([
        this.prisma.stockBalance.findMany({
          where: { responsiblePersonId: id, quantity: { gt: 0 } },
          include: { inventoryItem: true },
          orderBy: { inventoryItem: { name: 'asc' } },
        }),
        this.prisma.custodyBalance.findMany({
          where: {
            accountingOwnerResponsiblePersonId: id,
            quantity: { gt: 0 },
          },
          include: custodyCardInclude,
          orderBy: { inventoryItem: { name: 'asc' } },
        }),
        this.prisma.custodyBalance.findMany({
          where: {
            custodianResponsiblePersonId: id,
            quantity: { gt: 0 },
          },
          include: custodyCardInclude,
          orderBy: { inventoryItem: { name: 'asc' } },
        }),
        this.recentDocumentsForPerson(id, StockDocumentType.ASSIGNMENT),
        this.recentDocumentsForPerson(id, StockDocumentType.ISSUE),
      ]);

    const directTotal = this.sumQuantities(directBalances);
    const assignedOutTotal = this.sumQuantities(assignedToOthers);
    const assignedToMeTotal = this.sumQuantities(assignedToMe);

    return {
      directBalances: directBalances.map((balance) => ({
        id: balance.id,
        inventoryItem: balance.inventoryItem,
        quantity: balance.quantity.toString(),
      })),
      assignedToOthers: assignedToOthers.map((balance) =>
        this.serializeCustodyBalance(balance),
      ),
      assignedToMe: assignedToMe.map((balance) =>
        this.serializeCustodyBalance(balance),
      ),
      totalOwnedAccountingQuantity: directTotal
        .plus(assignedOutTotal)
        .toString(),
      totalPhysicallyHeldQuantity: directTotal
        .plus(assignedToMeTotal)
        .toString(),
      recentAssignments,
      recentIssues,
    };
  }

  private validateCustodyMovement(
    input: CustodyMovementInput,
    quantity: Prisma.Decimal,
  ): void {
    if (quantity.lte(0)) {
      throw new BadRequestException('Кількість має бути більшою за 0');
    }

    try {
      assertCustodyPartiesDiffer(
        input.accountingOwnerResponsiblePersonId,
        input.custodianResponsiblePersonId,
      );
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Некоректні сторони закріплення',
      );
    }
  }

  private custodyTransactionData(
    input: CustodyMovementInput,
    quantity: Prisma.Decimal,
    balanceBefore: Prisma.Decimal,
    balanceAfter: Prisma.Decimal,
  ): Prisma.StockTransactionUncheckedCreateInput {
    return {
      type: input.type,
      responsiblePersonId: input.custodianResponsiblePersonId,
      inventoryItemId: input.inventoryItemId,
      quantity,
      balanceBefore,
      balanceAfter,
      occurredAt: input.occurredAt,
      sourceDocument: input.sourceDocument,
      comment: input.comment,
      documentId: input.documentId,
      documentLineId: input.documentLineId,
      accountingModel: StockAccountingModel.OWNER_CUSTODY,
      bucketKind: StockSourceKind.ASSIGNED,
      accountingOwnerResponsiblePersonId:
        input.accountingOwnerResponsiblePersonId,
      sourceCustodianResponsiblePersonId:
        input.sourceCustodianResponsiblePersonId,
      destinationCustodianResponsiblePersonId:
        input.destinationCustodianResponsiblePersonId,
      reversalOfTransactionId: input.reversalOfTransactionId,
    };
  }

  private async assignedQuantities(
    keys: {
      accountingOwnerResponsiblePersonId: string;
      inventoryItemId: string;
    }[],
  ) {
    const result = new Map<string, Prisma.Decimal>();
    if (!keys.length) return result;

    const rows = await this.prisma.custodyBalance.groupBy({
      by: ['accountingOwnerResponsiblePersonId', 'inventoryItemId'],
      where: {
        accountingOwnerResponsiblePersonId: {
          in: [...new Set(keys.map((key) => key.accountingOwnerResponsiblePersonId))],
        },
        inventoryItemId: {
          in: [...new Set(keys.map((key) => key.inventoryItemId))],
        },
      },
      _sum: { quantity: true },
    });

    for (const row of rows) {
      result.set(
        this.ownerItemKey(
          row.accountingOwnerResponsiblePersonId,
          row.inventoryItemId,
        ),
        row._sum.quantity ?? new Prisma.Decimal(0),
      );
    }
    return result;
  }

  private ownerItemKey(ownerId: string, inventoryItemId: string) {
    return `${ownerId}:${inventoryItemId}`;
  }

  private personReference(person: {
    id: string;
    lastName: string;
    firstName: string;
    middleName: string | null;
    personnelNumber: string;
  }) {
    return {
      id: person.id,
      fullName: [person.lastName, person.firstName, person.middleName]
        .filter(Boolean)
        .join(' '),
      personnelNumber: person.personnelNumber,
    };
  }

  private sumQuantities(rows: { quantity: Prisma.Decimal }[]) {
    return rows.reduce(
      (sum, row) => sum.plus(row.quantity),
      new Prisma.Decimal(0),
    );
  }

  private serializeCustodyBalance(
    balance: Prisma.CustodyBalanceGetPayload<{
      include: typeof custodyCardInclude;
    }>,
  ) {
    return {
      id: balance.id,
      inventoryItem: balance.inventoryItem,
      accountingOwner: this.personReference(
        balance.accountingOwnerResponsiblePerson,
      ),
      custodian: this.personReference(balance.custodianResponsiblePerson),
      quantity: balance.quantity.toString(),
      updatedAt: balance.updatedAt,
    };
  }

  private async recentDocumentsForPerson(
    responsiblePersonId: string,
    type: StockDocumentType,
  ) {
    const documents = await this.prisma.stockDocument.findMany({
      where: {
        type,
        OR: [
          { sourceResponsiblePersonId: responsiblePersonId },
          { destinationResponsiblePersonId: responsiblePersonId },
          {
            lines: {
              some: {
                accountingOwnerResponsiblePersonId: responsiblePersonId,
              },
            },
          },
        ],
      },
      include: {
        sourceResponsiblePerson: true,
        destinationResponsiblePerson: true,
        lines: { include: { inventoryItem: true } },
      },
      orderBy: [{ documentDate: 'desc' }, { createdAt: 'desc' }],
      take: 10,
    });

    return documents.map((document) => ({
      id: document.id,
      documentNumber: document.documentNumber,
      displayNumber: document.displayNumber,
      documentDate: document.documentDate,
      type: document.type,
      status: document.status,
      sourceResponsiblePerson: this.personReference(
        document.sourceResponsiblePerson,
      ),
      destinationResponsiblePerson: document.destinationResponsiblePerson
        ? this.personReference(document.destinationResponsiblePerson)
        : null,
      lines: document.lines.map((line) => ({
        id: line.id,
        inventoryItem: line.inventoryItem,
        quantity: line.quantity.toString(),
      })),
    }));
  }

  private buildBalanceWhere(
    query: ListStockBalancesQueryDto,
    user?: CurrentUser,
  ): Prisma.StockBalanceWhereInput {
    const search = query.search?.trim();

    return {
      responsiblePersonId:
        user?.role === UserRole.MVO
          ? (user.responsiblePersonId ?? '__no_mvo_person__')
          : query.responsiblePersonId,
      inventoryItemId: query.inventoryItemId,
      quantity: query.onlyPositive ? { gt: 0 } : undefined,
      responsiblePerson: {
        managementId: query.managementId,
        serviceId: query.serviceId,
        unitId: query.unitId,
      },
      OR: search
        ? [
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
              responsiblePerson: {
                lastName: { contains: search, mode: 'insensitive' },
              },
            },
            {
              responsiblePerson: {
                personnelNumber: { contains: search, mode: 'insensitive' },
              },
            },
          ]
        : undefined,
    };
  }

  private serializeBalance(
    balance: Prisma.StockBalanceGetPayload<{ include: typeof balanceInclude }>,
    assignedToOthersQuantity: Prisma.Decimal,
  ) {
    const directQuantity = balance.quantity;
    return {
      id: balance.id,
      quantity: directQuantity.toString(),
      directQuantity: directQuantity.toString(),
      assignedToOthersQuantity: assignedToOthersQuantity.toString(),
      totalAccountedQuantity: directQuantity
        .plus(assignedToOthersQuantity)
        .toString(),
      createdAt: balance.createdAt,
      updatedAt: balance.updatedAt,
      responsiblePerson: {
        id: balance.responsiblePerson.id,
        fullName: [
          balance.responsiblePerson.lastName,
          balance.responsiblePerson.firstName,
          balance.responsiblePerson.middleName,
        ]
          .filter(Boolean)
          .join(' '),
        personnelNumber: balance.responsiblePerson.personnelNumber,
      },
      inventoryItem: balance.inventoryItem,
    };
  }

  private serializeTransaction(
    transaction: Prisma.StockTransactionGetPayload<{
      include: typeof transactionInclude;
    }>,
  ) {
    const { document, ...data } = transaction;
    return {
      ...data,
      sourceDocument: document
        ? `№ ${document.displayNumber}`
        : transaction.sourceDocument,
      quantity: transaction.quantity.toString(),
      balanceBefore: transaction.balanceBefore.toString(),
      balanceAfter: transaction.balanceAfter.toString(),
      responsiblePerson: {
        id: transaction.responsiblePerson.id,
        fullName: [
          transaction.responsiblePerson.lastName,
          transaction.responsiblePerson.firstName,
          transaction.responsiblePerson.middleName,
        ]
          .filter(Boolean)
          .join(' '),
        personnelNumber: transaction.responsiblePerson.personnelNumber,
      },
    };
  }
}
