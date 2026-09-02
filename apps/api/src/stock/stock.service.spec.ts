import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  StockAccountingModel,
  StockTransactionType,
  UserRole,
} from '@prisma/client';
import { AccessControlService } from '../auth/access-control.service';
import type { CurrentUser } from '../auth/auth.types';
import type { ListStockBalancesQueryDto } from './dto/list-stock-balances-query.dto';
import type { ListStockTransactionsQueryDto } from './dto/list-stock-transactions-query.dto';
import { StockService } from './stock.service';

function createService(prisma: unknown = {}) {
  return new StockService(
    prisma as never,
    new AccessControlService(prisma as never),
  );
}

const scopeIds = {
  management: '11111111-1111-4111-8111-111111111111',
  otherManagement: '22222222-2222-4222-8222-222222222222',
  responsiblePerson: '33333333-3333-4333-8333-333333333333',
};

function actor(
  role: UserRole,
  options: Pick<CurrentUser, 'responsiblePersonId' | 'accessScopes'> = {
    responsiblePersonId: null,
    accessScopes: [],
  },
): CurrentUser {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    username: role.toLowerCase(),
    role,
    isActive: true,
    mustChangePassword: false,
    responsiblePersonId: options.responsiblePersonId,
    accessScopes: options.accessScopes,
  };
}

async function stockBalanceWhere(
  user: CurrentUser,
  query: ListStockBalancesQueryDto = { page: 1, limit: 20 },
) {
  const prisma = {
    stockBalance: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
  };
  await createService(prisma).listBalances(query, user);
  return prisma.stockBalance.findMany.mock.calls[0][0].where;
}

async function stockTransactionWhere(
  user: CurrentUser,
  query: ListStockTransactionsQueryDto = { page: 1, limit: 20 },
) {
  const prisma = {
    stockTransaction: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
  };
  await createService(prisma).listTransactions(query, user);
  return prisma.stockTransaction.findMany.mock.calls[0][0].where;
}

describe('StockService', () => {
  it('keeps OWNER stock-balance listing global', async () => {
    const where = await stockBalanceWhere(actor(UserRole.OWNER));
    expect(where.responsiblePerson).not.toHaveProperty('AND');
  });

  it('limits MVO stock balances to its linked responsible person', async () => {
    const where = await stockBalanceWhere(
      actor(UserRole.MVO, {
        responsiblePersonId: scopeIds.responsiblePerson,
        accessScopes: [],
      }),
    );
    expect(where.responsiblePerson.AND[0]).toEqual({
      OR: [{ id: scopeIds.responsiblePerson }],
    });
  });

  it('allows scoped MVO reads but forbids writes for a foreign responsible person', async () => {
    const foreignResponsiblePersonId =
      '55555555-5555-4555-8555-555555555555';
    const mvo = actor(UserRole.MVO, {
      responsiblePersonId: scopeIds.responsiblePerson,
      accessScopes: [{ managementId: null, serviceCode: 'IT' }],
    });
    const where = await stockBalanceWhere(mvo);

    expect(where.responsiblePerson.AND[0]).toEqual({
      OR: [
        { id: scopeIds.responsiblePerson },
        { service: { code: 'IT' } },
      ],
    });

    const prisma = {
      securityEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const accessControl = new AccessControlService(prisma as never);
    await expect(
      accessControl.assertMvoResponsiblePersonAccess(
        mvo,
        foreignResponsiblePersonId,
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns no stock balances for ORG_MANAGER without scopes', async () => {
    const where = await stockBalanceWhere(actor(UserRole.ORG_MANAGER));
    expect(where.responsiblePerson.AND[0]).toEqual({ id: { in: [] } });
  });

  it('scopes stock balances through ResponsiblePerson management', async () => {
    const where = await stockBalanceWhere(
      actor(UserRole.ORG_MANAGER, {
        responsiblePersonId: null,
        accessScopes: [
          { managementId: scopeIds.management, serviceCode: null },
        ],
      }),
    );
    expect(where.responsiblePerson.AND[0]).toEqual({
      OR: [{ managementId: scopeIds.management }],
    });
  });

  it('scopes stock balances by service code across managements', async () => {
    const where = await stockBalanceWhere(
      actor(UserRole.ORG_MANAGER, {
        responsiblePersonId: null,
        accessScopes: [{ managementId: null, serviceCode: 'IT' }],
      }),
    );
    expect(where.responsiblePerson.AND[0]).toEqual({
      OR: [{ service: { code: 'IT' } }],
    });
  });

  it('intersects management and service code for stock balances', async () => {
    const where = await stockBalanceWhere(
      actor(UserRole.ORG_MANAGER, {
        responsiblePersonId: null,
        accessScopes: [
          { managementId: scopeIds.management, serviceCode: 'IT' },
        ],
      }),
    );
    expect(where.responsiblePerson.AND[0]).toEqual({
      OR: [
        {
          managementId: scopeIds.management,
          service: { code: 'IT' },
        },
      ],
    });
  });

  it('uses the union of manager scopes for stock balances', async () => {
    const where = await stockBalanceWhere(
      actor(UserRole.ORG_MANAGER, {
        responsiblePersonId: null,
        accessScopes: [
          { managementId: scopeIds.management, serviceCode: 'IT' },
          { managementId: scopeIds.otherManagement, serviceCode: 'MTZ' },
        ],
      }),
    );
    expect(where.responsiblePerson.AND[0].OR).toHaveLength(2);
  });

  it('cannot expand stock scope with a client responsible-person filter', async () => {
    const where = await stockBalanceWhere(
      actor(UserRole.ORG_MANAGER, {
        responsiblePersonId: null,
        accessScopes: [
          { managementId: scopeIds.management, serviceCode: null },
        ],
      }),
      {
        page: 1,
        limit: 20,
        responsiblePersonId: '55555555-5555-4555-8555-555555555555',
        managementId: scopeIds.otherManagement,
      },
    );
    expect(where.responsiblePersonId).toBe(
      '55555555-5555-4555-8555-555555555555',
    );
    expect(where.responsiblePerson.AND).toEqual([
      { OR: [{ managementId: scopeIds.management }] },
      expect.objectContaining({ managementId: scopeIds.otherManagement }),
    ]);
  });

  it('does not return a stock balance outside manager scope by ID', async () => {
    const prisma = {
      stockBalance: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const manager = actor(UserRole.ORG_MANAGER, {
      responsiblePersonId: null,
      accessScopes: [{ managementId: scopeIds.management, serviceCode: 'IT' }],
    });

    await expect(
      createService(prisma).findBalance('outside-balance', manager),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.stockBalance.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'outside-balance',
          responsiblePerson: {
            OR: [
              {
                managementId: scopeIds.management,
                service: { code: 'IT' },
              },
            ],
          },
        },
      }),
    );
  });

  it('limits manager transactions to its organization scope', async () => {
    const where = await stockTransactionWhere(
      actor(UserRole.ORG_MANAGER, {
        responsiblePersonId: null,
        accessScopes: [
          { managementId: scopeIds.management, serviceCode: 'IT' },
        ],
      }),
    );

    expect(where.AND[0]).toEqual(
      expect.objectContaining({
        OR: expect.arrayContaining([
          {
            responsiblePerson: {
              OR: [
                {
                  managementId: scopeIds.management,
                  service: { code: 'IT' },
                },
              ],
            },
          },
        ]),
      }),
    );
  });

  it('limits scoped MVO transaction journal to self OR service scope', async () => {
    const where = await stockTransactionWhere(
      actor(UserRole.MVO, {
        responsiblePersonId: scopeIds.responsiblePerson,
        accessScopes: [{ managementId: null, serviceCode: 'IT' }],
      }),
    );

    expect(where.AND[0]).toEqual(
      expect.objectContaining({
        OR: expect.arrayContaining([
          { responsiblePersonId: scopeIds.responsiblePerson },
          {
            responsiblePerson: {
              OR: [{ service: { code: 'IT' } }],
            },
          },
          {
            accountingOwnerResponsiblePerson: {
              OR: [{ service: { code: 'IT' } }],
            },
          },
          {
            sourceCustodianResponsiblePerson: {
              OR: [{ service: { code: 'IT' } }],
            },
          },
          {
            destinationCustodianResponsiblePerson: {
              OR: [{ service: { code: 'IT' } }],
            },
          },
          {
            document: {
              OR: [
                {
                  sourceResponsiblePerson: {
                    OR: [{ service: { code: 'IT' } }],
                  },
                },
                {
                  destinationResponsiblePerson: {
                    OR: [{ service: { code: 'IT' } }],
                  },
                },
              ],
            },
          },
        ]),
      }),
    );
  });

  it('does not expose foreign transactions to MVO without scopes', async () => {
    const where = await stockTransactionWhere(
      actor(UserRole.MVO, {
        responsiblePersonId: scopeIds.responsiblePerson,
        accessScopes: [],
      }),
    );
    expect(where.AND[0]).toEqual({
      OR: [{ responsiblePersonId: scopeIds.responsiblePerson }],
    });
  });

  it('does not let transaction query filters expand manager scope', async () => {
    const foreignResponsiblePersonId =
      '55555555-5555-4555-8555-555555555555';
    const where = await stockTransactionWhere(
      actor(UserRole.ORG_MANAGER, {
        responsiblePersonId: null,
        accessScopes: [{ managementId: null, serviceCode: 'IT' }],
      }),
      {
        page: 1,
        limit: 20,
        responsiblePersonId: foreignResponsiblePersonId,
      },
    );

    expect(where.AND[0]).toEqual(
      expect.objectContaining({ OR: expect.any(Array) }),
    );
    expect(where.AND[1]).toEqual(
      expect.objectContaining({ responsiblePersonId: foreignResponsiblePersonId }),
    );
  });

  it('does not return a transaction outside manager scope by ID', async () => {
    const prisma = {
      stockTransaction: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const manager = actor(UserRole.ORG_MANAGER, {
      responsiblePersonId: null,
      accessScopes: [{ managementId: scopeIds.management, serviceCode: null }],
    });

    await expect(
      createService(prisma).findTransaction('foreign-transaction', manager),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.stockTransaction.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { id: 'foreign-transaction' },
            expect.objectContaining({ OR: expect.any(Array) }),
          ],
        },
      }),
    );
  });

  it('forbids manual receipt with non-positive quantity', async () => {
    const service = createService();

    await expect(
      service.manualReceipt({
        responsiblePersonId: '11111111-1111-4111-8111-111111111111',
        inventoryItemId: '22222222-2222-4222-8222-222222222222',
        quantity: '0',
        occurredAt: '2026-01-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a manual receipt transaction in a transaction client', async () => {
    const service = createService();
    const tx = {
      responsiblePerson: {
        findUnique: jest.fn().mockResolvedValue({ id: 'rp' }),
      },
      inventoryItem: {
        findUnique: jest.fn().mockResolvedValue({ id: 'item' }),
      },
      stockBalance: {
        upsert: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      stockTransaction: {
        create: jest.fn().mockResolvedValue({ id: 'transaction' }),
      },
      $queryRaw: jest
        .fn()
        .mockResolvedValue([{ quantity: new Prisma.Decimal(2) }]),
    };

    await expect(
      service.createIncreasingTransactionInTx(tx as never, {
        type: StockTransactionType.MANUAL_RECEIPT,
        responsiblePersonId: '11111111-1111-4111-8111-111111111111',
        inventoryItemId: '22222222-2222-4222-8222-222222222222',
        quantity: '3',
        occurredAt: new Date('2026-01-01'),
      }),
    ).resolves.toEqual({ id: 'transaction' });

    expect(tx.stockBalance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { quantity: new Prisma.Decimal(5) },
      }),
    );
  });

  it('decreases the source balance and records the resulting balance', async () => {
    const service = createService();
    const tx = {
      stockBalance: { update: jest.fn().mockResolvedValue({}) },
      stockTransaction: {
        create: jest.fn().mockResolvedValue({ id: 'transaction' }),
      },
      $queryRaw: jest
        .fn()
        .mockResolvedValue([{ quantity: new Prisma.Decimal(5) }]),
    };

    await service.createDecreasingTransactionInTx(tx as never, {
      type: StockTransactionType.TRANSFER_OUT,
      responsiblePersonId: '11111111-1111-4111-8111-111111111111',
      inventoryItemId: '22222222-2222-4222-8222-222222222222',
      quantity: '2',
      occurredAt: new Date('2026-01-01'),
      documentId: '33333333-3333-4333-8333-333333333333',
      documentLineId: '44444444-4444-4444-8444-444444444444',
    });

    expect(tx.stockBalance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { quantity: new Prisma.Decimal(3) },
      }),
    );
    expect(
      (tx.$queryRaw.mock.calls[0][0] as TemplateStringsArray).join(' '),
    ).toContain('FOR UPDATE');
    expect(tx.stockTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          balanceBefore: new Prisma.Decimal(5),
          balanceAfter: new Prisma.Decimal(3),
        }),
      }),
    );
  });

  it('rejects a decreasing transaction when stock is insufficient', async () => {
    const service = createService();
    const tx = {
      stockBalance: { update: jest.fn() },
      stockTransaction: { create: jest.fn() },
      $queryRaw: jest
        .fn()
        .mockResolvedValue([{ quantity: new Prisma.Decimal(1) }]),
    };

    await expect(
      service.createDecreasingTransactionInTx(tx as never, {
        type: StockTransactionType.ISSUE,
        responsiblePersonId: '11111111-1111-4111-8111-111111111111',
        inventoryItemId: '22222222-2222-4222-8222-222222222222',
        quantity: '2',
        occurredAt: new Date('2026-01-01'),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.stockBalance.update).not.toHaveBeenCalled();
  });

  it('returns only positive direct balances as available sources', async () => {
    const person = {
      id: '11111111-1111-4111-8111-111111111111',
      lastName: 'Левіс',
      firstName: 'Артур',
      middleName: null,
      managementId: null,
      serviceId: null,
      unitId: null,
    };
    const item = {
      id: '33333333-3333-4333-8333-333333333333',
      externalCode: 'KB-1',
      name: 'Клавіатура',
      unitOfMeasure: 'шт',
    };
    const prisma = {
      stockBalance: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'direct-id',
            responsiblePersonId: person.id,
            inventoryItemId: item.id,
            quantity: new Prisma.Decimal(2),
            responsiblePerson: person,
            inventoryItem: item,
          },
        ]),
      },
    };
    const service = createService(prisma);

    const result = await service.availableToMe({
      id: 'user-id',
      username: 'mvo',
      role: UserRole.MVO,
      isActive: true,
      mustChangePassword: false,
      responsiblePersonId: person.id,
    });

    expect(result).toEqual([{
      inventoryItem: item,
      balanceId: 'direct-id',
      availableQuantity: '2',
      unit: 'шт',
      canTransfer: true,
      canIssue: true,
    }]);
    expect(prisma).not.toHaveProperty('custodyBalance');
  });

  it('builds an MVO accounting card from direct balances and exposes custody only as legacy archive', async () => {
    const person = {
      id: '11111111-1111-4111-8111-111111111111',
      lastName: 'Левіс',
      firstName: 'Артур',
      middleName: null,
    };
    const item = { id: 'item-id', name: 'Клавіатура' };
    const prisma = {
      stockBalance: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'direct', quantity: new Prisma.Decimal(2), inventoryItem: item },
        ]),
      },
      custodyBalance: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'legacy-custody',
            quantity: new Prisma.Decimal(2),
            inventoryItem: item,
            accountingOwnerResponsiblePerson: person,
            custodianResponsiblePerson: { ...person, id: 'other' },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
      },
      stockDocument: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = createService(prisma);

    const result = await service.responsiblePersonAccountingCard(person.id, {
      id: 'user-id',
      username: 'owner',
      role: UserRole.OWNER,
      isActive: true,
      mustChangePassword: false,
      responsiblePersonId: null,
    });

    expect(result.totalDirectQuantity).toBe('2');
    expect(result.directBalances).toHaveLength(1);
    expect(result.legacyCustodyArchive).toHaveLength(1);
    expect(prisma.custodyBalance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ quantity: { gt: 0 } }),
      }),
    );
  });

  it('scopes MVO accounting-card documents to outgoing records only', async () => {
    const personId = '11111111-1111-4111-8111-111111111111';
    const prisma = {
      responsiblePerson: {
        findFirst: jest.fn().mockResolvedValue({ id: personId }),
      },
      stockBalance: { findMany: jest.fn().mockResolvedValue([]) },
      custodyBalance: { findMany: jest.fn().mockResolvedValue([]) },
      stockDocument: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = createService(prisma);

    await service.responsiblePersonAccountingCard(personId, {
      id: 'user-id',
      username: 'mvo',
      role: UserRole.MVO,
      isActive: true,
      mustChangePassword: false,
      responsiblePersonId: personId,
    });

    expect(prisma.stockDocument.findMany).toHaveBeenCalledTimes(2);
    for (const call of prisma.stockDocument.findMany.mock.calls) {
      expect(call[0].where).toMatchObject({
        sourceResponsiblePersonId: personId,
        OR: undefined,
      });
    }
  });

  it('returns direct StockBalance quantities without custody aggregation', async () => {
    const responsiblePerson = {
      id: '11111111-1111-4111-8111-111111111111',
      lastName: 'Левіс',
      firstName: 'Артур',
      middleName: null,
      managementId: null,
      serviceId: null,
      unitId: null,
    };
    const inventoryItem = {
      id: '22222222-2222-4222-8222-222222222222',
      externalCode: 'KB-1',
      name: 'Клавіатура',
      unitOfMeasure: 'шт',
    };
    const prisma = {
      stockBalance: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'balance-id',
            responsiblePersonId: responsiblePerson.id,
            inventoryItemId: inventoryItem.id,
            quantity: new Prisma.Decimal(2),
            createdAt: new Date(),
            updatedAt: new Date(),
            responsiblePerson,
            inventoryItem,
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    const service = createService(prisma);

    const result = await service.listBalances({ page: 1, limit: 20 });

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        quantity: '2',
      }),
    );
    expect(prisma).not.toHaveProperty('custodyBalance');
  });

  it('marks manual receipts as direct-balance movements', async () => {
    const createIncreasingTransaction = jest.fn().mockResolvedValue({});
    const service = createService();
    service.createIncreasingTransaction = createIncreasingTransaction;

    await service.manualReceipt({
      responsiblePersonId: '11111111-1111-4111-8111-111111111111',
      inventoryItemId: '22222222-2222-4222-8222-222222222222',
      quantity: '1',
      occurredAt: '2026-01-01',
    });

    expect(createIncreasingTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        accountingModel: StockAccountingModel.DIRECT_BALANCE,
      }),
    );
  });
});
