import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { ListUnitsQueryDto } from './dto/list-units-query.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';

@Injectable()
export class UnitsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: ListUnitsQueryDto) {
    return this.prisma.unit.findMany({
      where: {
        serviceId: query.serviceId,
        service: {
          managementId: query.managementId,
        },
      },
      orderBy: { name: 'asc' },
      include: {
        service: {
          select: {
            id: true,
            name: true,
            management: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const unit = await this.prisma.unit.findUnique({
      where: { id },
      include: {
        service: {
          select: {
            id: true,
            name: true,
            management: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!unit) {
      throw new NotFoundException('Підрозділ не знайдено');
    }

    return unit;
  }

  async create(dto: CreateUnitDto) {
    await this.ensureServiceExists(dto.serviceId);

    try {
      return await this.prisma.unit.create({ data: dto });
    } catch (error) {
      this.handleUniqueError(error);
    }
  }

  async update(id: string, dto: UpdateUnitDto) {
    const existing = await this.findOne(id);
    const serviceId = dto.serviceId ?? existing.service.id;

    await this.ensureServiceExists(serviceId);

    try {
      return await this.prisma.unit.update({
        where: { id },
        data: dto,
      });
    } catch (error) {
      this.handleUniqueError(error);
    }
  }

  private async ensureServiceExists(serviceId: string): Promise<void> {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      select: { id: true },
    });

    if (!service) {
      throw new BadRequestException('Обрана служба не існує');
    }
  }

  private handleUniqueError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Код підрозділу вже використовується в межах служби',
      );
    }

    throw error;
  }
}
