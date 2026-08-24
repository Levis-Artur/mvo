import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type CreateUserAccessScopeInput = {
  managementId?: string | null;
  serviceCode?: string | null;
};

@Injectable()
export class UserAccessScopesService {
  constructor(private readonly prisma: PrismaService) {}

  listForUser(userId: string) {
    return this.prisma.userAccessScope.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(userId: string, input: CreateUserAccessScopeInput) {
    const managementId = input.managementId ?? null;
    const serviceCode =
      input.serviceCode === null || input.serviceCode === undefined
        ? null
        : input.serviceCode.trim();

    if (input.serviceCode !== null && input.serviceCode !== undefined && !serviceCode) {
      throw new BadRequestException('Код служби не може бути порожнім');
    }
    if (!managementId && !serviceCode) {
      throw new BadRequestException(
        'Scope повинен містити управління або код служби',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('Користувача не знайдено');

    if (managementId) {
      const management = await this.prisma.management.findUnique({
        where: { id: managementId },
        select: { id: true },
      });
      if (!management) throw new BadRequestException('Управління не знайдено');
    }

    if (serviceCode) {
      const service = await this.prisma.service.findFirst({
        where: {
          code: serviceCode,
          managementId: managementId ?? undefined,
        },
        select: { id: true },
      });
      if (!service) {
        throw new BadRequestException(
          managementId
            ? 'Службу з таким кодом не знайдено в обраному управлінні'
            : 'Службу з таким кодом не знайдено',
        );
      }
    }

    const duplicate = await this.prisma.userAccessScope.findFirst({
      where: { userId, managementId, serviceCode },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException('Такий scope вже призначено користувачу');
    }

    try {
      return await this.prisma.userAccessScope.create({
        data: { userId, managementId, serviceCode },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Такий scope вже призначено користувачу');
      }
      throw error;
    }
  }
}
