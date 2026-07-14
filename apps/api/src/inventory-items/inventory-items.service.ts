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
