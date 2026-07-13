import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateResponsiblePersonDto } from './dto/create-responsible-person.dto';
import { ListResponsiblePersonsQueryDto } from './dto/list-responsible-persons-query.dto';
import { UpdateResponsiblePersonDto } from './dto/update-responsible-person.dto';

const responsiblePersonInclude = {
  management: { select: { id: true, name: true } },
  service: { select: { id: true, name: true } },
  unit: { select: { id: true, name: true } },
} satisfies Prisma.ResponsiblePersonInclude;

@Injectable()
export class ResponsiblePersonsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListResponsiblePersonsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.buildWhere(query);

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

  async findOne(id: string) {
    const responsiblePerson = await this.prisma.responsiblePerson.findUnique({
      where: { id },
      include: responsiblePersonInclude,
    });

    if (!responsiblePerson) {
      throw new NotFoundException('МВО не знайдено');
    }

    return responsiblePerson;
  }

  async create(dto: CreateResponsiblePersonDto) {
    await this.validateOrganization(
      dto.managementId,
      dto.serviceId,
      dto.unitId,
    );

    try {
      return await this.prisma.responsiblePerson.create({
        data: this.toPrismaData(dto),
        include: responsiblePersonInclude,
      });
    } catch (error) {
      this.handleUniqueError(error);
    }
  }

  async update(id: string, dto: UpdateResponsiblePersonDto) {
    const existing = await this.findOne(id);
    const managementId = dto.managementId ?? existing.managementId;
    const serviceId = dto.serviceId ?? existing.serviceId;
    const unitId = dto.unitId === undefined ? existing.unitId : dto.unitId;

    await this.validateOrganization(managementId, serviceId, unitId);

    try {
      return await this.prisma.responsiblePerson.update({
        where: { id },
        data: this.toPrismaData(dto),
        include: responsiblePersonInclude,
      });
    } catch (error) {
      this.handleUniqueError(error);
    }
  }

  private buildWhere(
    query: ListResponsiblePersonsQueryDto,
  ): Prisma.ResponsiblePersonWhereInput {
    const search = query.search?.trim();

    return {
      managementId: query.managementId,
      serviceId: query.serviceId,
      unitId: query.unitId,
      isActive: query.isActive,
      OR: search
        ? [
            { lastName: { contains: search, mode: 'insensitive' } },
            { firstName: { contains: search, mode: 'insensitive' } },
            { middleName: { contains: search, mode: 'insensitive' } },
            { personnelNumber: { contains: search, mode: 'insensitive' } },
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
      appointmentDate: dto.appointmentDate
        ? new Date(dto.appointmentDate)
        : dto.appointmentDate,
    } as Prisma.ResponsiblePersonUncheckedCreateInput;
  }

  private handleUniqueError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Табельний номер вже використовується');
    }

    throw error;
  }
}
