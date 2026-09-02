import { BadRequestException } from '@nestjs/common';
import { UnitsService } from './units.service';
import { UserRole } from '@prisma/client';

describe('UnitsService', () => {
  it('limits MVO units to self OR access scopes', async () => {
    const prisma = { unit: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new UnitsService(prisma as never);
    await service.findAll({}, {
      id: 'user-id', username: 'mvo', role: UserRole.MVO, isActive: true,
      mustChangePassword: false, responsiblePersonId: 'person-id',
      accessScopes: [{ managementId: null, serviceCode: 'IT' }],
    });
    expect(prisma.unit.findMany.mock.calls[0][0].where.responsiblePersons)
      .toEqual({
        some: { OR: [{ id: 'person-id' }, { service: { code: 'IT' } }] },
      });
  });

  it('forbids creating a unit in a missing service', async () => {
    const prisma = {
      service: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      unit: {
        create: jest.fn(),
      },
    };
    const service = new UnitsService(prisma as never);

    await expect(
      service.create({
        name: 'Сектор логістики',
        code: 'LOGISTICS',
        serviceId: '11111111-1111-4111-8111-111111111111',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
