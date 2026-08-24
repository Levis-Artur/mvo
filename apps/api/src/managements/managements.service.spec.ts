import { ManagementsService } from './managements.service';

describe('ManagementsService', () => {
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
