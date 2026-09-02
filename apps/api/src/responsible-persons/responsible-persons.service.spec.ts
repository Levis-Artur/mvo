import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AccessControlService } from '../auth/access-control.service';
import type { CurrentUser } from '../auth/auth.types';
import { ListResponsiblePersonsQueryDto } from './dto/list-responsible-persons-query.dto';
import { CreateResponsiblePersonDto } from './dto/create-responsible-person.dto';
import { UpdateResponsiblePersonDto } from './dto/update-responsible-person.dto';
import { ResponsiblePersonsService } from './responsible-persons.service';

type MockPrisma = {
  management: { findUnique: jest.Mock };
  service: { findUnique: jest.Mock };
  unit: { findUnique: jest.Mock };
  responsiblePerson: {
    create: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
};

const ids = {
  management: '11111111-1111-4111-8111-111111111111',
  otherManagement: '22222222-2222-4222-8222-222222222222',
  service: '33333333-3333-4333-8333-333333333333',
  unit: '44444444-4444-4444-8444-444444444444',
  otherService: '66666666-6666-4666-8666-666666666666',
};

function createPrismaMock(): MockPrisma {
  return {
    management: { findUnique: jest.fn() },
    service: { findUnique: jest.fn() },
    unit: { findUnique: jest.fn() },
    responsiblePerson: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
}

function createService(prisma: MockPrisma): ResponsiblePersonsService {
  return new ResponsiblePersonsService(
    prisma as never,
    new AccessControlService(prisma as never),
  );
}

function arrangeValidOrganization(prisma: MockPrisma) {
  prisma.management.findUnique.mockResolvedValue({ id: ids.management });
  prisma.service.findUnique.mockResolvedValue({
    id: ids.service,
    managementId: ids.management,
  });
  prisma.unit.findUnique.mockResolvedValue({
    id: ids.unit,
    serviceId: ids.service,
  });
}

function validDto() {
  return {
    lastName: 'Тестовий',
    firstName: 'Олександр',
    externalAccountingCode: '0057',
    managementId: ids.management,
    serviceId: ids.service,
    unitId: ids.unit,
  };
}

function actor(
  role: UserRole,
  options: Pick<CurrentUser, 'responsiblePersonId' | 'accessScopes'> = {
    responsiblePersonId: null,
    accessScopes: [],
  },
): CurrentUser {
  return {
    id: '88888888-8888-4888-8888-888888888888',
    username: role.toLowerCase(),
    role,
    isActive: true,
    mustChangePassword: false,
    responsiblePersonId: options.responsiblePersonId,
    accessScopes: options.accessScopes,
  };
}

async function responsiblePersonListWhere(
  user: CurrentUser,
  query: ListResponsiblePersonsQueryDto = { page: 1, limit: 20 },
) {
  const prisma = createPrismaMock();
  prisma.responsiblePerson.findMany.mockResolvedValue([]);
  prisma.responsiblePerson.count.mockResolvedValue(0);
  await createService(prisma).findAll(query, user);
  return prisma.responsiblePerson.findMany.mock.calls[0][0].where;
}

describe('ResponsiblePersonsService', () => {
  it('keeps OWNER responsible-person listing global', async () => {
    const where = await responsiblePersonListWhere(actor(UserRole.OWNER));
    expect(where).not.toHaveProperty('AND');
  });

  it('limits MVO responsible-person listing to self', async () => {
    const where = await responsiblePersonListWhere(
      actor(UserRole.MVO, {
        responsiblePersonId: '77777777-7777-4777-8777-777777777777',
        accessScopes: [],
      }),
    );
   expect(where.AND[0]).toEqual({
      OR: [
        {
          id: '77777777-7777-4777-8777-777777777777',
        },
      ],
    });
  }); 

  it('returns no responsible persons for ORG_MANAGER without scopes', async () => {
    const where = await responsiblePersonListWhere(
      actor(UserRole.ORG_MANAGER),
    );
    expect(where.AND[0]).toEqual({ id: { in: [] } });
  });

  it('applies an ORG_MANAGER management scope', async () => {
    const where = await responsiblePersonListWhere(
      actor(UserRole.ORG_MANAGER, {
        responsiblePersonId: null,
        accessScopes: [{ managementId: ids.management, serviceCode: null }],
      }),
    );
    expect(where.AND[0]).toEqual({ OR: [{ managementId: ids.management }] });
  });

  it('applies an ORG_MANAGER service code across managements', async () => {
    const where = await responsiblePersonListWhere(
      actor(UserRole.ORG_MANAGER, {
        responsiblePersonId: null,
        accessScopes: [{ managementId: null, serviceCode: 'IT' }],
      }),
    );
    expect(where.AND[0]).toEqual({ OR: [{ service: { code: 'IT' } }] });
  });

  it('intersects ORG_MANAGER management and service scopes', async () => {
    const where = await responsiblePersonListWhere(
      actor(UserRole.ORG_MANAGER, {
        responsiblePersonId: null,
        accessScopes: [{ managementId: ids.management, serviceCode: 'IT' }],
      }),
    );
    expect(where.AND[0]).toEqual({
      OR: [{ managementId: ids.management, service: { code: 'IT' } }],
    });
  });

  it('combines several ORG_MANAGER scopes as a union', async () => {
    const where = await responsiblePersonListWhere(
      actor(UserRole.ORG_MANAGER, {
        responsiblePersonId: null,
        accessScopes: [
          { managementId: ids.management, serviceCode: 'IT' },
          { managementId: ids.otherManagement, serviceCode: 'MTZ' },
        ],
      }),
    );
    expect(where.AND[0].OR).toHaveLength(2);
  });

  it('ANDs client filters with the server authorization scope', async () => {
    const where = await responsiblePersonListWhere(
      actor(UserRole.ORG_MANAGER, {
        responsiblePersonId: null,
        accessScopes: [{ managementId: ids.management, serviceCode: null }],
      }),
      { page: 1, limit: 20, managementId: ids.otherManagement },
    );
    expect(where.AND).toEqual([
      { OR: [{ managementId: ids.management }] },
      expect.objectContaining({ managementId: ids.otherManagement }),
    ]);
  });

  it('does not return responsible-person details outside manager scope', async () => {
    const prisma = createPrismaMock();
    prisma.responsiblePerson.findFirst.mockResolvedValue(null);
    const manager = actor(UserRole.ORG_MANAGER, {
      responsiblePersonId: null,
      accessScopes: [{ managementId: ids.management, serviceCode: 'IT' }],
    });

    await expect(
      createService(prisma).findOne('outside-id', manager),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.responsiblePerson.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { id: 'outside-id' },
            {
              OR: [
                { managementId: ids.management, service: { code: 'IT' } },
              ],
            },
          ],
        },
      }),
    );
  });

  it('keeps a four-digit accounting code as a string with leading zeroes', async () => {
    const dto = plainToInstance(CreateResponsiblePersonDto, {
      ...validDto(),
      externalAccountingCode: ' 0057 ',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.externalAccountingCode).toBe('0057');
    expect(typeof dto.externalAccountingCode).toBe('string');
  });

  it.each(['', '57', '00057', 'ABCD', '00 57'])(
    'rejects an invalid accounting code: %p',
    async (externalAccountingCode) => {
      const dto = plainToInstance(CreateResponsiblePersonDto, {
        ...validDto(),
        externalAccountingCode,
      });

      await expect(validate(dto)).resolves.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ property: 'externalAccountingCode' }),
        ]),
      );
    },
  );

  it('validates an accounting code when a legacy MVO is edited', async () => {
    const dto = plainToInstance(UpdateResponsiblePersonDto, {
      externalAccountingCode: '',
    });

    await expect(validate(dto)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'externalAccountingCode' }),
      ]),
    );
  });

  it('rejects transfer-target pagination limits above 100', async () => {
    const query = plainToInstance(ListResponsiblePersonsQueryDto, {
      page: '1',
      limit: '101',
    });

    await expect(validate(query)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'limit' }),
      ]),
    );
  });

  it('forbids creating a responsible person in a missing management', async () => {
    const prisma = createPrismaMock();
    const service = createService(prisma);

    prisma.management.findUnique.mockResolvedValue(null);

    await expect(service.create(validDto())).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('forbids creating a responsible person with a foreign service', async () => {
    const prisma = createPrismaMock();
    const service = createService(prisma);

    prisma.management.findUnique.mockResolvedValue({ id: ids.management });
    prisma.service.findUnique.mockResolvedValue({
      id: ids.service,
      managementId: ids.otherManagement,
    });

    await expect(service.create(validDto())).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('forbids creating a responsible person with a unit from another service', async () => {
    const prisma = createPrismaMock();
    const service = createService(prisma);

    prisma.management.findUnique.mockResolvedValue({ id: ids.management });
    prisma.service.findUnique.mockResolvedValue({
      id: ids.service,
      managementId: ids.management,
    });
    prisma.unit.findUnique.mockResolvedValue({
      id: ids.unit,
      serviceId: ids.otherService,
    });

    await expect(service.create(validDto())).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('successfully creates a responsible person with a valid organization structure', async () => {
    const prisma = createPrismaMock();
    const service = createService(prisma);
    const created = {
      id: '77777777-7777-4777-8777-777777777777',
      ...validDto(),
      unit: { id: ids.unit, name: 'Сектор логістики' },
    };

    prisma.management.findUnique.mockResolvedValue({ id: ids.management });
    prisma.service.findUnique.mockResolvedValue({
      id: ids.service,
      managementId: ids.management,
    });
    prisma.unit.findUnique.mockResolvedValue({
      id: ids.unit,
      serviceId: ids.service,
    });
    prisma.responsiblePerson.create.mockResolvedValue(created);

    await expect(service.create(validDto())).resolves.toEqual(created);
    expect(prisma.responsiblePerson.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          externalAccountingCode: '0057',
        }),
      }),
    );
  });

  it('rejects a duplicate accounting code even when it belongs to an inactive MVO', async () => {
    const prisma = createPrismaMock();
    const service = createService(prisma);
    prisma.responsiblePerson.findUnique.mockResolvedValue({
      id: 'inactive-person',
      isActive: false,
    });

    await expect(service.create(validDto())).rejects.toMatchObject({
      status: 409,
      response: {
        code: 'MVO_ACCOUNTING_CODE_EXISTS',
        message: 'МВО з кодом 0057 уже існує.',
      },
    });
    expect(prisma.responsiblePerson.create).not.toHaveBeenCalled();
  });

  it('maps a concurrent Prisma unique violation to the stable accounting-code conflict', async () => {
    const prisma = createPrismaMock();
    const service = createService(prisma);
    arrangeValidOrganization(prisma);
    prisma.responsiblePerson.findUnique.mockResolvedValue(null);
    prisma.responsiblePerson.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['externalAccountingCode'] },
      }),
    );

    await expect(service.create(validDto())).rejects.toMatchObject({
      status: 409,
      response: {
        code: 'MVO_ACCOUNTING_CODE_EXISTS',
        message: 'МВО з кодом 0057 уже існує.',
      },
    });
  });

  it('allows an MVO to retain its current accounting code', async () => {
    const prisma = createPrismaMock();
    const service = createService(prisma);
    const id = '77777777-7777-4777-8777-777777777777';
    arrangeValidOrganization(prisma);
    prisma.responsiblePerson.findFirst.mockResolvedValue({
      id,
      ...validDto(),
      unitId: ids.unit,
    });
    prisma.responsiblePerson.findUnique.mockResolvedValue({ id });
    prisma.responsiblePerson.update.mockResolvedValue({
      id,
      ...validDto(),
    });

    await expect(
      service.update(id, { externalAccountingCode: '0057' }),
    ).resolves.toEqual(expect.objectContaining({ id }));
  });

  it('allows adding an accounting code to a legacy MVO without one', async () => {
    const prisma = createPrismaMock();
    const service = createService(prisma);
    const id = '77777777-7777-4777-8777-777777777777';
    arrangeValidOrganization(prisma);
    prisma.responsiblePerson.findFirst.mockResolvedValue({
      id,
      ...validDto(),
      externalAccountingCode: null,
      unitId: ids.unit,
    });
    prisma.responsiblePerson.findUnique.mockResolvedValue(null);
    prisma.responsiblePerson.update.mockResolvedValue({ id });

    await service.update(id, { externalAccountingCode: '0057' });

    expect(prisma.responsiblePerson.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id },
        data: expect.objectContaining({ externalAccountingCode: '0057' }),
      }),
    );
  });

  it('rejects changing an MVO to another MVO accounting code', async () => {
    const prisma = createPrismaMock();
    const service = createService(prisma);
    const id = '77777777-7777-4777-8777-777777777777';
    prisma.responsiblePerson.findFirst.mockResolvedValue({
      id,
      ...validDto(),
      externalAccountingCode: '0057',
      unitId: ids.unit,
    });
    prisma.responsiblePerson.findUnique.mockResolvedValue({
      id: 'another-person',
    });

    await expect(
      service.update(id, { externalAccountingCode: '1155' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.responsiblePerson.update).not.toHaveBeenCalled();
  });

  it('searches responsible persons by text fields', async () => {
    const prisma = createPrismaMock();
    const service = createService(prisma);

    prisma.responsiblePerson.findMany.mockResolvedValue([]);
    prisma.responsiblePerson.count.mockResolvedValue(0);

    await service.findAll({ search: 'Тест', page: 1, limit: 20 });

    expect(prisma.responsiblePerson.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { lastName: { contains: 'Тест', mode: 'insensitive' } },
            { firstName: { contains: 'Тест', mode: 'insensitive' } },
            { middleName: { contains: 'Тест', mode: 'insensitive' } },
            {
              externalAccountingCode: {
                contains: 'Тест',
                mode: 'insensitive',
              },
            },
            {
              management: {
                name: { contains: 'Тест', mode: 'insensitive' },
              },
            },
          ]),
        }),
      }),
    );
  });

  it('searches responsible persons by a multi-part full name', async () => {
    const prisma = createPrismaMock();
    const service = createService(prisma);

    prisma.responsiblePerson.findMany.mockResolvedValue([]);
    prisma.responsiblePerson.count.mockResolvedValue(0);

    await service.findAll({ search: 'Жигульський Андрій', page: 1, limit: 20 });

    expect(prisma.responsiblePerson.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            {
              AND: [
                {
                  OR: expect.arrayContaining([
                    {
                      lastName: {
                        contains: 'Жигульський',
                        mode: 'insensitive',
                      },
                    },
                  ]),
                },
                {
                  OR: expect.arrayContaining([
                    {
                      firstName: {
                        contains: 'Андрій',
                        mode: 'insensitive',
                      },
                    },
                  ]),
                },
              ],
            },
          ]),
        }),
      }),
    );
  });

  it('returns pagination metadata', async () => {
    const prisma = createPrismaMock();
    const service = createService(prisma);

    prisma.responsiblePerson.findMany.mockResolvedValue([]);
    prisma.responsiblePerson.count.mockResolvedValue(45);

    await expect(service.findAll({ page: 2, limit: 20 })).resolves.toEqual({
      items: [],
      pagination: {
        page: 2,
        limit: 20,
        total: 45,
        totalPages: 3,
      },
    });

    expect(prisma.responsiblePerson.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 20,
      }),
    );
  });

  it('returns active transfer targets and excludes the current MVO', async () => {
    const prisma = createPrismaMock();
    const service = createService(prisma);
    const currentResponsiblePersonId =
      '77777777-7777-4777-8777-777777777777';
    prisma.responsiblePerson.findMany.mockResolvedValue([
      {
        id: '99999999-9999-4999-8999-999999999999',
        lastName: 'Левіс',
        firstName: 'Артур',
        middleName: 'Сергійович',
        management: { id: ids.management, name: 'Управління' },
        service: { id: ids.service, name: 'Служба' },
        unit: { id: ids.unit, name: 'Підрозділ' },
        phone: '+380000000000',
        externalAccountingCode: '0057',
      },
    ]);
    prisma.responsiblePerson.count.mockResolvedValue(1);

    const result = await service.transferTargets(
      { page: 1, limit: 100, search: 'Левіс' },
      {
        id: '88888888-8888-4888-8888-888888888888',
        username: 'mvo',
        role: UserRole.MVO,
        isActive: true,
        mustChangePassword: false,
        responsiblePersonId: currentResponsiblePersonId,
      },
    );

    expect(prisma.responsiblePerson.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          id: { not: currentResponsiblePersonId },
          OR: expect.any(Array),
        }),
        select: expect.objectContaining({
          id: true,
          externalAccountingCode: true,
          management: expect.any(Object),
        }),
        take: 100,
      }),
    );
    expect(result.items).toEqual([
      {
        id: '99999999-9999-4999-8999-999999999999',
        externalAccountingCode: '0057',
        fullName: 'Левіс Артур Сергійович',
        management: { id: ids.management, name: 'Управління' },
        service: { id: ids.service, name: 'Служба' },
        unit: { id: ids.unit, name: 'Підрозділ' },
      },
    ]);
    expect(result.items[0]).not.toHaveProperty('phone');
    expect(result.items[0]).toHaveProperty('externalAccountingCode', '0057');
  });

  it('does not expose transfer targets to an unlinked MVO account', async () => {
    const service = createService(createPrismaMock());

    await expect(
      service.transferTargets(
        { page: 1, limit: 20 },
        {
          id: '88888888-8888-4888-8888-888888888888',
          username: 'mvo-without-person',
          role: UserRole.MVO,
          isActive: true,
          mustChangePassword: false,
          responsiblePersonId: null,
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
