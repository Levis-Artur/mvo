import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InventoryItemReviewStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { ListInventoryItemsQueryDto } from './dto/list-inventory-items-query.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';

@Injectable()
export class InventoryItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListInventoryItemsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();
    const where: Prisma.InventoryItemWhereInput = {
      reviewStatus: query.reviewStatus,
      isActive: query.isActive,
      OR: search
        ? [
            { externalCode: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
          ]
        : undefined,
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
    const item = await this.prisma.inventoryItem.findUnique({ where: { id } });

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
