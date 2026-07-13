import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateManagementDto } from './dto/create-management.dto';
import { UpdateManagementDto } from './dto/update-management.dto';

@Injectable()
export class ManagementsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.management.findMany({
      orderBy: { name: 'asc' },
      include: {
        services: {
          orderBy: { name: 'asc' },
          include: {
            units: {
              orderBy: { name: 'asc' },
            },
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const management = await this.prisma.management.findUnique({
      where: { id },
      include: {
        services: {
          orderBy: { name: 'asc' },
          include: {
            units: { orderBy: { name: 'asc' } },
          },
        },
      },
    });

    if (!management) {
      throw new NotFoundException('Управління не знайдено');
    }

    return management;
  }

  async create(dto: CreateManagementDto) {
    try {
      return await this.prisma.management.create({ data: dto });
    } catch (error) {
      this.handleUniqueError(error);
    }
  }

  async update(id: string, dto: UpdateManagementDto) {
    await this.findOne(id);

    try {
      return await this.prisma.management.update({
        where: { id },
        data: dto,
      });
    } catch (error) {
      this.handleUniqueError(error);
    }
  }

  private handleUniqueError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Код управління вже використовується');
    }

    throw error;
  }
}
