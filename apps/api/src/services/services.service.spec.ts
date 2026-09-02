import { BadRequestException } from '@nestjs/common';
import { ServicesService } from './services.service';
import { UserRole } from '@prisma/client';

describe('ServicesService', () => {
  it('limits MVO services to self OR access scopes', async () => {
    const prisma = { service: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new ServicesService(prisma as never);
    await service.findAll({}, {
      id: 'user-id', username: 'mvo', role: UserRole.MVO, isActive: true,
      mustChangePassword: false, responsiblePersonId: 'person-id',
      accessScopes: [{ managementId: null, serviceCode: 'IT' }],
    });
    expect(prisma.service.findMany.mock.calls[0][0].where.responsiblePersons)
      .toEqual({
        some: { OR: [{ id: 'person-id' }, { service: { code: 'IT' } }] },
      });
  });

  it('forbids creating a service in a missing management', async () => {
    const prisma = {
      management: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      service: {
        create: jest.fn(),
      },
    };
    const service = new ServicesService(prisma as never);

    await expect(
      service.create({
        name: 'Служба забезпечення',
        code: 'SUPPORT',
        managementId: '11111111-1111-4111-8111-111111111111',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
