import { BadRequestException } from '@nestjs/common';
import { ServicesService } from './services.service';

describe('ServicesService', () => {
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
