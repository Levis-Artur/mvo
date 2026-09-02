import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { AccessControlService } from '../auth/access-control.service';
import type { CurrentUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateManagementDto } from './dto/create-management.dto';
import { UpdateManagementDto } from './dto/update-management.dto';
import { baseServicesForManagement } from '../services/base-services';

@Injectable()
export class ManagementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService =
      new AccessControlService(prisma),
  ) {}

  findAll(actor?: CurrentUser) {
    const personWhere =
      actor?.role === UserRole.MVO || actor?.role === UserRole.ORG_MANAGER
        ? this.accessControl.responsiblePersonFilter(actor)
        : undefined;
    return this.prisma.management.findMany({
      where: personWhere
        ? { responsiblePersons: { some: personWhere } }
        : undefined,
      orderBy: { name: 'asc' },
      include: {
        services: {
          where: personWhere
            ? { responsiblePersons: { some: personWhere } }
            : undefined,
          orderBy: { name: 'asc' },
          include: {
            units: {
              where: personWhere
                ? { responsiblePersons: { some: personWhere } }
                : undefined,
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
      return await this.prisma.$transaction(async (transaction) => {
        const management = await transaction.management.create({ data: dto });
        await transaction.service.createMany({
          data: baseServicesForManagement(management.id),
          skipDuplicates: true,
        });
        return management;
      });
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
