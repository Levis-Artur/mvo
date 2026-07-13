import { BadRequestException } from '@nestjs/common';
import { ResponsiblePersonsService } from './responsible-persons.service';

type MockPrisma = {
  management: { findUnique: jest.Mock };
  service: { findUnique: jest.Mock };
  unit: { findUnique: jest.Mock };
  responsiblePerson: {
    create: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
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
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
}

function createService(prisma: MockPrisma): ResponsiblePersonsService {
  return new ResponsiblePersonsService(prisma as never);
}

function validDto() {
  return {
    lastName: 'Тестовий',
    firstName: 'Олександр',
    personnelNumber: 'TEST-001',
    managementId: ids.management,
    serviceId: ids.service,
    unitId: ids.unit,
  };
}

describe('ResponsiblePersonsService', () => {
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
          personnelNumber: 'TEST-001',
        }),
      }),
    );
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
            { personnelNumber: { contains: 'Тест', mode: 'insensitive' } },
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
});
