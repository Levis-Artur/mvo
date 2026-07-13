import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { ListServicesQueryDto } from './dto/list-services-query.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: ListServicesQueryDto) {
    return this.prisma.service.findMany({
      where: {
        managementId: query.managementId,
      },
      orderBy: { name: 'asc' },
      include: {
        management: { select: { id: true, name: true } },
      },
    });
  }

  async findOne(id: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: {
        management: { select: { id: true, name: true } },
        units: { orderBy: { name: 'asc' } },
      },
    });

    if (!service) {
      throw new NotFoundException('Службу не знайдено');
    }

    return service;
  }

  async create(dto: CreateServiceDto) {
    await this.ensureManagementExists(dto.managementId);

    try {
      return await this.prisma.service.create({ data: dto });
    } catch (error) {
      this.handleUniqueError(error);
    }
  }

  async update(id: string, dto: UpdateServiceDto) {
    const existing = await this.findOne(id);
    const managementId = dto.managementId ?? existing.management.id;

    await this.ensureManagementExists(managementId);

    try {
      return await this.prisma.service.update({
        where: { id },
        data: dto,
      });
    } catch (error) {
      this.handleUniqueError(error);
    }
  }

  private async ensureManagementExists(managementId: string): Promise<void> {
    const management = await this.prisma.management.findUnique({
      where: { id: managementId },
      select: { id: true },
    });

    if (!management) {
      throw new BadRequestException('Обране управління не існує');
    }
  }

  private handleUniqueError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Код служби вже використовується в межах управління',
      );
    }

    throw error;
  }
}
