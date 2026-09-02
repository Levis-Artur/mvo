import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { AccessControlService } from '../auth/access-control.service';
import type { CurrentUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { ListServicesQueryDto } from './dto/list-services-query.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService =
      new AccessControlService(prisma),
  ) {}

  findAll(query: ListServicesQueryDto, actor?: CurrentUser) {
    const personWhere =
      actor?.role === UserRole.MVO || actor?.role === UserRole.ORG_MANAGER
        ? this.accessControl.responsiblePersonFilter(actor)
        : undefined;
    return this.prisma.service.findMany({
      where: {
        managementId: query.managementId,
        responsiblePersons: personWhere ? { some: personWhere } : undefined,
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
