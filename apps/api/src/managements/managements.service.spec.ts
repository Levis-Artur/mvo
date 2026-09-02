import { ManagementsService } from './managements.service';
import { UserRole } from '@prisma/client';

describe('ManagementsService', () => {
  it('limits MVO reference data to self OR access scopes', async () => {
    const prisma = { management: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new ManagementsService(prisma as never);
    await service.findAll({
      id: 'user-id', username: 'mvo', role: UserRole.MVO, isActive: true,
      mustChangePassword: false, responsiblePersonId: 'person-id',
      accessScopes: [{ managementId: null, serviceCode: 'IT' }],
    });
    expect(prisma.management.findMany.mock.calls[0][0].where).toEqual({
      responsiblePersons: {
        some: { OR: [{ id: 'person-id' }, { service: { code: 'IT' } }] },
      },
    });
  });

  it('creates a new management and its three base services atomically', async () => {
    const transaction = {
      management: {
        create: jest.fn().mockResolvedValue({
          id: 'management-1',
          name: 'УПП м. Луцьк',
          code: 'LUTSK',
        }),
      },
      service: {
        createMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
    };
    const prisma = {
      $transaction: jest
        .fn()
        .mockImplementation(
          (run: (client: typeof transaction) => unknown) => run(transaction),
        ),
    };

    const result = await new ManagementsService(prisma as never).create({
      name: 'УПП м. Луцьк',
      code: 'LUTSK',
    });

    expect(result).toEqual(expect.objectContaining({ id: 'management-1' }));
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(transaction.service.createMany).toHaveBeenCalledWith({
      data: [
        {
          managementId: 'management-1',
          code: 'IT',
          name: 'ІТ',
          isActive: true,
        },
        {
          managementId: 'management-1',
          code: 'MTZ',
          name: 'МТЗ',
          isActive: true,
        },
        {
          managementId: 'management-1',
          code: 'UATZ',
          name: 'УАТЗ',
          isActive: true,
        },
      ],
      skipDuplicates: true,
    });
  });
});
