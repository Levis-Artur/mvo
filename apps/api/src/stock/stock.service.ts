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

type TransactionClient = Prisma.TransactionClient;

type DirectMovementInput = {
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

const legacyCustodyInclude = {
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
    return {
      items: items.map((item) => this.serializeBalance(item)),
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

    return this.serializeBalance(balance);
  }

  async listTransactions(query: ListStockTransactionsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.StockTransactionWhereInput = {
      responsiblePersonId: query.responsiblePersonId,
      inventoryItemId: query.inventoryItemId,
      type: query.type,
      importBatchId: query.importBatchId,
      occurredAt: {
        gte: query.dateFrom ? new Date(query.dateFrom) : undefined,
        lte: query.dateTo ? new Date(query.dateTo) : undefined,
      },
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

  async findTransaction(id: string) {
    const transaction = await this.prisma.stockTransaction.findFirst({
      where: { id },
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
      accountingModel: StockAccountingModel.DIRECT_BALANCE,
      bucketKind: StockSourceKind.DIRECT,
    });
  }

  async createIncreasingTransaction(input: DirectMovementInput) {
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
    input: DirectMovementInput,
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
        reversalOfTransactionId: input.reversalOfTransactionId,
      },
      include: transactionInclude,
    });
  }

  async createDecreasingTransactionInTx(
    tx: TransactionClient,
    input: DirectMovementInput,
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

  async availableToMe(user: CurrentUser) {
    if (user.role !== UserRole.MVO || !user.responsiblePersonId) {
      throw new BadRequestException(
        'Доступне майно визначається лише для користувача з карткою МВО',
      );
    }
    const responsiblePersonId = user.responsiblePersonId;
    const directBalances = await this.prisma.stockBalance.findMany({
      where: { responsiblePersonId, quantity: { gt: 0 } },
      include: balanceInclude,
      orderBy: { inventoryItem: { name: 'asc' } },
    });

    return directBalances.map((balance) => ({
      inventoryItem: balance.inventoryItem,
      balanceId: balance.id,
      availableQuantity: balance.quantity.toString(),
      unit: balance.inventoryItem.unitOfMeasure,
      canTransfer: true,
      canIssue: true,
    }));
  }

  async responsiblePersonAccountingCard(id: string, user: CurrentUser) {
    if (user.role === UserRole.MVO && user.responsiblePersonId !== id) {
      throw new NotFoundException('Картку обліку МВО не знайдено');
    }

    const [directBalances, legacyCustodyArchive, recentTransfers, recentIssues] =
      await Promise.all([
        this.prisma.stockBalance.findMany({
          where: { responsiblePersonId: id, quantity: { gt: 0 } },
          include: { inventoryItem: true },
          orderBy: { inventoryItem: { name: 'asc' } },
        }),
        this.prisma.custodyBalance.findMany({
          where: {
            quantity: { gt: 0 },
            OR: [
              { accountingOwnerResponsiblePersonId: id },
              { custodianResponsiblePersonId: id },
            ],
          },
          include: legacyCustodyInclude,
          orderBy: { inventoryItem: { name: 'asc' } },
        }),
        this.recentDocumentsForPerson(id, [
          StockDocumentType.MVO_TRANSFER,
          StockDocumentType.TRANSFER,
          StockDocumentType.ASSIGNMENT,
        ]),
        this.recentDocumentsForPerson(id, [StockDocumentType.ISSUE]),
      ]);

    const directTotal = this.sumQuantities(directBalances);

    return {
      directBalances: directBalances.map((balance) => ({
        id: balance.id,
        inventoryItem: balance.inventoryItem,
        quantity: balance.quantity.toString(),
      })),
      legacyCustodyArchive: legacyCustodyArchive.map((balance) =>
        this.serializeLegacyCustodyBalance(balance),
      ),
      totalDirectQuantity: directTotal.toString(),
      recentTransfers,
      recentIssues,
    };
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

  private serializeLegacyCustodyBalance(
    balance: Prisma.CustodyBalanceGetPayload<{
      include: typeof legacyCustodyInclude;
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
    types: StockDocumentType[],
  ) {
    const documents = await this.prisma.stockDocument.findMany({
      where: {
        type: { in: types },
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
  ) {
    return {
      id: balance.id,
      quantity: balance.quantity.toString(),
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
