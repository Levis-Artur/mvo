import { BadRequestException } from '@nestjs/common';
import { UnitsService } from './units.service';

describe('UnitsService', () => {
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
