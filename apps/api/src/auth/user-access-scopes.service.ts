import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type CreateUserAccessScopeInput = {
  managementId?: string | null;
  serviceCode?: string | null;
};

type ScopeClient = Pick<
  Prisma.TransactionClient,
  'management' | 'service' | 'user' | 'userAccessScope'
>;

type NormalizedUserAccessScope = {
  managementId: string | null;
  serviceCode: string | null;
};

@Injectable()
export class UserAccessScopesService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string) {
    await this.assertScopeEligibleRole(this.prisma, userId);
    return this.prisma.userAccessScope.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(userId: string, input: CreateUserAccessScopeInput) {
    await this.assertScopeEligibleRole(this.prisma, userId);
    const { managementId, serviceCode } = await this.validateScope(
      this.prisma,
      input,
    );

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

  replaceForUser(userId: string, inputs: CreateUserAccessScopeInput[]) {
    return this.prisma.$transaction(async (transaction) => {
      await this.assertScopeEligibleRole(transaction, userId);

      const scopes: NormalizedUserAccessScope[] = [];
      const uniqueScopes = new Set<string>();

      for (const input of inputs) {
        const scope = await this.validateScope(transaction, input);
        const key = `${scope.managementId ?? ''}\u0000${scope.serviceCode ?? ''}`;
        if (uniqueScopes.has(key)) {
          throw new ConflictException('Такий scope повторюється у списку');
        }
        uniqueScopes.add(key);
        scopes.push(scope);
      }

      await transaction.userAccessScope.deleteMany({ where: { userId } });
      if (scopes.length) {
        await transaction.userAccessScope.createMany({
          data: scopes.map((scope) => ({ userId, ...scope })),
        });
      }

      return transaction.userAccessScope.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      });
    });
  }

  private async assertScopeEligibleRole(client: ScopeClient, userId: string) {
    const user = await client.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!user) throw new NotFoundException('Користувача не знайдено');
    if (user.role !== UserRole.ORG_MANAGER && user.role !== UserRole.MVO) {
      throw new BadRequestException(
        'Області доступу можна призначати тільки користувачу з роллю «Менеджер» або «МВО»',
      );
    }
  }

  private async validateScope(
    client: ScopeClient,
    input: CreateUserAccessScopeInput,
  ): Promise<NormalizedUserAccessScope> {
    const managementId = input.managementId ?? null;
    const serviceCode =
      input.serviceCode === null || input.serviceCode === undefined
        ? null
        : input.serviceCode.trim();

    if (
      input.serviceCode !== null &&
      input.serviceCode !== undefined &&
      !serviceCode
    ) {
      throw new BadRequestException('Код служби не може бути порожнім');
    }
    if (!managementId && !serviceCode) {
      throw new BadRequestException(
        'Потрібно вибрати управління або службу',
      );
    }

    if (managementId) {
      const management = await client.management.findUnique({
        where: { id: managementId },
        select: { id: true },
      });
      if (!management) throw new BadRequestException('Управління не знайдено');
    }

    if (serviceCode) {
      const service = await client.service.findFirst({
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

    return { managementId, serviceCode };
  }
}
