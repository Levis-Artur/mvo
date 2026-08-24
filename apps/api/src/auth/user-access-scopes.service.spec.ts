import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { UserAccessScopesService } from './user-access-scopes.service';

function prismaMock(role: UserRole = UserRole.ORG_MANAGER) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: 'user-1', role }),
    },
    management: {
      findUnique: jest.fn().mockResolvedValue({ id: 'management-1' }),
    },
    service: {
      findFirst: jest.fn().mockResolvedValue({ id: 'service-1' }),
    },
    userAccessScope: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(({ data }) => ({
        id: 'scope-1',
        ...data,
      })),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(
    async (run: (transaction: typeof prisma) => unknown) => run(prisma),
  );
  return prisma;
}

function createService(prisma = prismaMock()) {
  return new UserAccessScopesService(prisma as unknown as PrismaService);
}

describe('UserAccessScopesService', () => {
  it('lists scopes for an ORG_MANAGER', async () => {
    const prisma = prismaMock();
    prisma.userAccessScope.findMany.mockResolvedValue([
      { id: 'scope-1', managementId: 'management-1', serviceCode: null },
    ]);

    await expect(createService(prisma).listForUser('user-1')).resolves.toEqual([
      expect.objectContaining({ id: 'scope-1' }),
    ]);
  });

  it('replaces scopes atomically with management-only, service-only and combined scopes', async () => {
    const prisma = prismaMock();

    await createService(prisma).replaceForUser('user-1', [
      { managementId: 'management-1' },
      { serviceCode: ' IT ' },
      { managementId: 'management-2', serviceCode: 'MTZ' },
    ]);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.userAccessScope.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(prisma.userAccessScope.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: 'user-1',
          managementId: 'management-1',
          serviceCode: null,
        },
        {
          userId: 'user-1',
          managementId: null,
          serviceCode: 'IT',
        },
        {
          userId: 'user-1',
          managementId: 'management-2',
          serviceCode: 'MTZ',
        },
      ],
    });
  });

  it('rejects a scope without management or service code before deleting existing scopes', async () => {
    const prisma = prismaMock();

    await expect(
      createService(prisma).replaceForUser('user-1', [{}]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.userAccessScope.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects duplicate scopes before deleting existing scopes', async () => {
    const prisma = prismaMock();

    await expect(
      createService(prisma).replaceForUser('user-1', [
        { managementId: 'management-1', serviceCode: 'IT' },
        { managementId: 'management-1', serviceCode: 'IT' },
      ]),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.userAccessScope.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects an invalid management', async () => {
    const prisma = prismaMock();
    prisma.management.findUnique.mockResolvedValue(null);

    await expect(
      createService(prisma).replaceForUser('user-1', [
        { managementId: 'missing-management' },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('validates that a service belongs to the selected management', async () => {
    const prisma = prismaMock();
    prisma.service.findFirst.mockResolvedValue(null);

    await expect(
      createService(prisma).replaceForUser('user-1', [
        { managementId: 'management-1', serviceCode: 'IT' },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.service.findFirst).toHaveBeenCalledWith({
      where: { code: 'IT', managementId: 'management-1' },
      select: { id: true },
    });
  });

  it('rejects scopes for a user without the ORG_MANAGER role', async () => {
    const prisma = prismaMock(UserRole.MVO);

    await expect(
      createService(prisma).replaceForUser('user-1', [
        { managementId: 'management-1' },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.userAccessScope.deleteMany).not.toHaveBeenCalled();
  });

  it('keeps duplicate protection for the single-scope create helper', async () => {
    const prisma = prismaMock();
    prisma.userAccessScope.findFirst.mockResolvedValue({ id: 'scope-1' });

    await expect(
      createService(prisma).create('user-1', {
        managementId: 'management-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.userAccessScope.create).not.toHaveBeenCalled();
  });
});
