import { BadRequestException, ConflictException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { UserAccessScopesService } from './user-access-scopes.service';

function prismaMock() {
  return {
    user: { findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }) },
    management: {
      findUnique: jest.fn().mockResolvedValue({ id: 'management-1' }),
    },
    service: { findFirst: jest.fn().mockResolvedValue({ id: 'service-1' }) },
    userAccessScope: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn(),
      create: jest.fn().mockImplementation(({ data }) => ({
        id: 'scope-1',
        ...data,
      })),
    },
  };
}

describe('UserAccessScopesService', () => {
  it('rejects a scope without management or service code', async () => {
    const prisma = prismaMock();
    const service = new UserAccessScopesService(
      prisma as unknown as PrismaService,
    );

    await expect(service.create('user-1', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.userAccessScope.create).not.toHaveBeenCalled();
  });

  it('rejects a blank service code', async () => {
    const service = new UserAccessScopesService(
      prismaMock() as unknown as PrismaService,
    );

    await expect(
      service.create('user-1', { serviceCode: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('validates that a service belongs to the selected management', async () => {
    const prisma = prismaMock();
    prisma.service.findFirst.mockResolvedValue(null);
    const service = new UserAccessScopesService(
      prisma as unknown as PrismaService,
    );

    await expect(
      service.create('user-1', {
        managementId: 'management-1',
        serviceCode: 'IT',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.service.findFirst).toHaveBeenCalledWith({
      where: { code: 'IT', managementId: 'management-1' },
      select: { id: true },
    });
  });

  it('does not create a duplicate scope', async () => {
    const prisma = prismaMock();
    prisma.userAccessScope.findFirst.mockResolvedValue({ id: 'scope-1' });
    const service = new UserAccessScopesService(
      prisma as unknown as PrismaService,
    );

    await expect(
      service.create('user-1', { managementId: 'management-1' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.userAccessScope.create).not.toHaveBeenCalled();
  });
});
