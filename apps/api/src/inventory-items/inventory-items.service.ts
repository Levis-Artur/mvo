import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InventoryItemReviewStatus, Prisma, UserRole } from '@prisma/client';
import type { CurrentUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { ListInventoryItemsQueryDto } from './dto/list-inventory-items-query.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';

@Injectable()
export class InventoryItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListInventoryItemsQueryDto, user?: CurrentUser) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();
    const mvoItemScope: Prisma.InventoryItemWhereInput | undefined =
      user?.role === UserRole.MVO
        ? {
            OR: [
              {
                stockBalances: {
                  some: {
                    responsiblePersonId:
                      user.responsiblePersonId ?? '__no_mvo_person__',
                  },
                },
              },
              {
                stockTransactions: {
                  some: {
                    responsiblePersonId:
                      user.responsiblePersonId ?? '__no_mvo_person__',
                  },
                },
              },
              {
                importRows: {
                  some: {
                    responsiblePersonId:
                      user.responsiblePersonId ?? '__no_mvo_person__',
                  },
                },
              },
              {
                custodyBalances: {
                  some: {
                    OR: [
                      {
                        accountingOwnerResponsiblePersonId:
                          user.responsiblePersonId ?? '__no_mvo_person__',
                      },
                      {
                        custodianResponsiblePersonId:
                          user.responsiblePersonId ?? '__no_mvo_person__',
                      },
                    ],
                  },
                },
              },
            ],
          }
        : undefined;
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
      AND: [mvoItemScope, searchWhere].filter(
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

  async findOne(id: string, user?: CurrentUser) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: {
        id,
        ...(user?.role === UserRole.MVO
          ? {
              OR: [
                {
                  stockBalances: {
                    some: {
                      responsiblePersonId:
                        user.responsiblePersonId ?? '__no_mvo_person__',
                    },
                  },
                },
                {
                  stockTransactions: {
                    some: {
                      responsiblePersonId:
                        user.responsiblePersonId ?? '__no_mvo_person__',
                    },
                  },
                },
                {
                  importRows: {
                    some: {
                      responsiblePersonId:
                        user.responsiblePersonId ?? '__no_mvo_person__',
                    },
                  },
                },
                {
                  custodyBalances: {
                    some: {
                      OR: [
                        {
                          accountingOwnerResponsiblePersonId:
                            user.responsiblePersonId ?? '__no_mvo_person__',
                        },
                        {
                          custodianResponsiblePersonId:
                            user.responsiblePersonId ?? '__no_mvo_person__',
                        },
                      ],
                    },
                  },
                },
              ],
            }
          : {}),
      },
    });

    if (!item) {
      throw new NotFoundException('Номенклатурну позицію не знайдено');
    }

    return item;
  }

  async accountingCard(id: string, user: CurrentUser) {
    const inventoryItem = await this.findOne(id, user);
    const [directBalances, custodyBalances, recentDocuments, recentTransactions] =
      await Promise.all([
        this.prisma.stockBalance.findMany({
          where: { inventoryItemId: id, quantity: { gt: 0 } },
          include: { responsiblePerson: true },
          orderBy: { quantity: 'desc' },
        }),
        this.prisma.custodyBalance.findMany({
          where: { inventoryItemId: id, quantity: { gt: 0 } },
          include: {
            accountingOwnerResponsiblePerson: true,
            custodianResponsiblePerson: true,
          },
          orderBy: { quantity: 'desc' },
        }),
        this.prisma.stockDocument.findMany({
          where: { lines: { some: { inventoryItemId: id } } },
          include: {
            sourceResponsiblePerson: true,
            destinationResponsiblePerson: true,
            lines: {
              where: { inventoryItemId: id },
              select: {
                id: true,
                quantity: true,
                accountingOwnerResponsiblePersonId: true,
              },
            },
          },
          orderBy: [{ documentDate: 'desc' }, { createdAt: 'desc' }],
          take: 10,
        }),
        this.prisma.stockTransaction.findMany({
          where: { inventoryItemId: id },
          include: {
            responsiblePerson: true,
            accountingOwnerResponsiblePerson: true,
            sourceCustodianResponsiblePerson: true,
            destinationCustodianResponsiblePerson: true,
          },
          orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
          take: 20,
        }),
      ]);

    const directQuantity = this.sumQuantities(directBalances);
    const assignedQuantity = this.sumQuantities(custodyBalances);

    return {
      inventoryItem,
      totals: {
        directQuantity: directQuantity.toString(),
        assignedQuantity: assignedQuantity.toString(),
        totalAccountedQuantity: directQuantity.plus(assignedQuantity).toString(),
      },
      directBalances: directBalances.map((balance) => ({
        responsiblePerson: this.personReference(balance.responsiblePerson),
        quantity: balance.quantity.toString(),
      })),
      custodyBalances: custodyBalances.map((balance) => ({
        accountingOwner: this.personReference(
          balance.accountingOwnerResponsiblePerson,
        ),
        custodian: this.personReference(balance.custodianResponsiblePerson),
        quantity: balance.quantity.toString(),
      })),
      recentDocuments: recentDocuments.map((document) => ({
        id: document.id,
        documentNumber: document.documentNumber,
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
          ...line,
          quantity: line.quantity.toString(),
        })),
      })),
      recentTransactions: recentTransactions.map((transaction) => ({
        ...transaction,
        quantity: transaction.quantity.toString(),
        balanceBefore: transaction.balanceBefore.toString(),
        balanceAfter: transaction.balanceAfter.toString(),
        responsiblePerson: this.personReference(transaction.responsiblePerson),
        accountingOwner: transaction.accountingOwnerResponsiblePerson
          ? this.personReference(transaction.accountingOwnerResponsiblePerson)
          : null,
        sourceCustodian: transaction.sourceCustodianResponsiblePerson
          ? this.personReference(transaction.sourceCustodianResponsiblePerson)
          : null,
        destinationCustodian:
          transaction.destinationCustodianResponsiblePerson
            ? this.personReference(
                transaction.destinationCustodianResponsiblePerson,
              )
            : null,
        accountingOwnerResponsiblePerson: undefined,
        sourceCustodianResponsiblePerson: undefined,
        destinationCustodianResponsiblePerson: undefined,
      })),
    };
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
  }) {
    return {
      id: person.id,
      fullName: [person.lastName, person.firstName, person.middleName]
        .filter(Boolean)
        .join(' '),
      personnelNumber: person.personnelNumber,
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
