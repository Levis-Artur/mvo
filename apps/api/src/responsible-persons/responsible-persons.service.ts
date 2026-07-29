import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import type { CurrentUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateResponsiblePersonDto } from './dto/create-responsible-person.dto';
import { ListResponsiblePersonsQueryDto } from './dto/list-responsible-persons-query.dto';
import { UpdateResponsiblePersonDto } from './dto/update-responsible-person.dto';

const responsiblePersonInclude = {
  management: { select: { id: true, name: true } },
  service: { select: { id: true, name: true } },
  unit: { select: { id: true, name: true } },
} satisfies Prisma.ResponsiblePersonInclude;

const transferTargetSelect = {
  id: true,
  personnelNumber: true,
  externalAccountingCode: true,
  lastName: true,
  firstName: true,
  middleName: true,
  management: { select: { id: true, name: true } },
  service: { select: { id: true, name: true } },
  unit: { select: { id: true, name: true } },
} satisfies Prisma.ResponsiblePersonSelect;

@Injectable()
export class ResponsiblePersonsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListResponsiblePersonsQueryDto, user?: CurrentUser) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.buildWhere(query, user);

    const [items, total] = await Promise.all([
      this.prisma.responsiblePerson.findMany({
        where,
        include: responsiblePersonInclude,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.responsiblePerson.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, user?: CurrentUser) {
    const responsiblePerson = await this.prisma.responsiblePerson.findFirst({
      where: {
        id,
        ...(user?.role === UserRole.MVO
          ? { id: user.responsiblePersonId ?? '__no_mvo_person__' }
          : {}),
      },
      include: responsiblePersonInclude,
    });

    if (!responsiblePerson) {
      throw new NotFoundException('МВО не знайдено');
    }

    return responsiblePerson;
  }

  async transferTargets(
    query: ListResponsiblePersonsQueryDto,
    user: CurrentUser,
  ) {
    if (user.role === UserRole.MVO && !user.responsiblePersonId) {
      throw new ForbiddenException(
        'Обліковий запис MVO не пов’язаний із матеріально відповідальною особою',
      );
    }
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.ResponsiblePersonWhereInput = {
      ...this.buildWhere({ ...query, isActive: true }),
      externalAccountingCode: { not: null },
      id: user.responsiblePersonId
        ? { not: user.responsiblePersonId }
        : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.responsiblePerson.findMany({
        where,
        select: transferTargetSelect,
        orderBy: [{ externalAccountingCode: 'asc' }, { lastName: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.responsiblePerson.count({ where }),
    ]);
    return {
      items: items.map((person) => ({
        id: person.id,
        personnelNumber: person.personnelNumber,
        externalAccountingCode: person.externalAccountingCode!,
        fullName: [person.lastName, person.firstName, person.middleName]
          .filter(Boolean)
          .join(' '),
        management: person.management,
        service: person.service,
        unit: person.unit,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async create(dto: CreateResponsiblePersonDto) {
    const externalAccountingCode = this.normalizeAccountingCode(
      dto.externalAccountingCode,
    );
    await this.assertAccountingCodeAvailable(externalAccountingCode);
    await this.validateOrganization(
      dto.managementId,
      dto.serviceId,
      dto.unitId,
    );

    try {
      return await this.prisma.responsiblePerson.create({
        data: this.toPrismaData({ ...dto, externalAccountingCode }),
        include: responsiblePersonInclude,
      });
    } catch (error) {
      this.handleUniqueError(error, externalAccountingCode);
    }
  }

  async update(id: string, dto: UpdateResponsiblePersonDto) {
    const existing = await this.findOne(id);
    const managementId = dto.managementId ?? existing.managementId;
    const serviceId = dto.serviceId ?? existing.serviceId;
    const unitId = dto.unitId === undefined ? existing.unitId : dto.unitId;
    const externalAccountingCode =
      dto.externalAccountingCode === undefined
        ? undefined
        : this.normalizeAccountingCode(dto.externalAccountingCode);

    if (externalAccountingCode !== undefined) {
      await this.assertAccountingCodeAvailable(externalAccountingCode, id);
    }

    await this.validateOrganization(managementId, serviceId, unitId);

    try {
      return await this.prisma.responsiblePerson.update({
        where: { id },
        data: this.toPrismaData({ ...dto, externalAccountingCode }),
        include: responsiblePersonInclude,
      });
    } catch (error) {
      this.handleUniqueError(
        error,
        externalAccountingCode ?? existing.externalAccountingCode,
      );
    }
  }

  private buildWhere(
    query: ListResponsiblePersonsQueryDto,
    user?: CurrentUser,
  ): Prisma.ResponsiblePersonWhereInput {
    const search = query.search?.trim();
    const nameTokens = search?.split(/\s+/).filter(Boolean) ?? [];
    const fullNameFilter: Prisma.ResponsiblePersonWhereInput | undefined =
      nameTokens.length > 1
        ? {
            AND: nameTokens.map(
              (token): Prisma.ResponsiblePersonWhereInput => ({
                OR: [
                  { lastName: { contains: token, mode: 'insensitive' } },
                  { firstName: { contains: token, mode: 'insensitive' } },
                  { middleName: { contains: token, mode: 'insensitive' } },
                ],
              }),
            ),
          }
        : undefined;

    return {
      managementId: query.managementId,
      serviceId: query.serviceId,
      unitId: query.unitId,
      id:
        user?.role === UserRole.MVO
          ? (user.responsiblePersonId ?? '__no_mvo_person__')
          : undefined,
      isActive: query.isActive,
      OR: search
        ? [
            { lastName: { contains: search, mode: 'insensitive' } },
            { firstName: { contains: search, mode: 'insensitive' } },
            { middleName: { contains: search, mode: 'insensitive' } },
            {
              externalAccountingCode: {
                contains: search,
                mode: 'insensitive',
              },
            },
            { personnelNumber: { contains: search, mode: 'insensitive' } },
            {
              management: { name: { contains: search, mode: 'insensitive' } },
            },
            {
              service: { name: { contains: search, mode: 'insensitive' } },
            },
            {
              unit: { name: { contains: search, mode: 'insensitive' } },
            },
            ...(fullNameFilter ? [fullNameFilter] : []),
          ]
        : undefined,
    };
  }

  private async validateOrganization(
    managementId: string,
    serviceId: string,
    unitId?: string | null,
  ): Promise<void> {
    const management = await this.prisma.management.findUnique({
      where: { id: managementId },
      select: { id: true },
    });

    if (!management) {
      throw new BadRequestException('Обране управління не існує');
    }

    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      select: { id: true, managementId: true },
    });

    if (!service) {
      throw new BadRequestException('Обрана служба не існує');
    }

    if (service.managementId !== managementId) {
      throw new BadRequestException(
        'Обрана служба не належить обраному управлінню',
      );
    }

    if (!unitId) {
      return;
    }

    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      select: { id: true, serviceId: true },
    });

    if (!unit) {
      throw new BadRequestException('Обраний підрозділ не існує');
    }

    if (unit.serviceId !== serviceId) {
      throw new BadRequestException(
        'Обраний підрозділ не належить обраній службі',
      );
    }
  }

  private toPrismaData(
    dto: CreateResponsiblePersonDto | UpdateResponsiblePersonDto,
  ): Prisma.ResponsiblePersonUncheckedCreateInput {
    return {
      ...dto,
      unitId: dto.unitId || null,
      externalAccountingCode:
        dto.externalAccountingCode === undefined
          ? undefined
          : this.normalizeAccountingCode(dto.externalAccountingCode),
      appointmentDate: dto.appointmentDate
        ? new Date(dto.appointmentDate)
        : dto.appointmentDate,
    } as Prisma.ResponsiblePersonUncheckedCreateInput;
  }

  private normalizeAccountingCode(value: string): string {
    const code = value.trim();
    if (!/^\d{4}$/.test(code)) {
      throw new BadRequestException(
        'Код МВО повинен містити рівно 4 цифри',
      );
    }
    return code;
  }

  private async assertAccountingCodeAvailable(
    externalAccountingCode: string,
    currentId?: string,
  ): Promise<void> {
    const existing = await this.prisma.responsiblePerson.findUnique({
      where: { externalAccountingCode },
      select: { id: true },
    });
    if (existing && existing.id !== currentId) {
      this.throwAccountingCodeConflict(externalAccountingCode);
    }
  }

  private handleUniqueError(
    error: unknown,
    externalAccountingCode?: string | null,
  ): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = error.meta?.target;
      const fields = Array.isArray(target)
        ? target.map(String)
        : [String(target ?? '')];
      if (
        externalAccountingCode &&
        fields.some((field) => field.includes('externalAccountingCode'))
      ) {
        this.throwAccountingCodeConflict(externalAccountingCode);
      }
      throw new ConflictException('Табельний номер вже використовується');
    }

    throw error;
  }

  private throwAccountingCodeConflict(code: string): never {
    throw new ConflictException({
      code: 'MVO_ACCOUNTING_CODE_EXISTS',
      message: `МВО з кодом ${code} уже існує.`,
    });
  }
}
