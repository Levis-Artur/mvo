import { BadRequestException } from '@nestjs/common';
import {
  Prisma,
  StockSourceKind,
  StockTransactionType,
  UserRole,
} from '@prisma/client';
import { StockService } from './stock.service';

describe('StockService', () => {
  it('forbids manual receipt with non-positive quantity', async () => {
    const service = new StockService({} as never);

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
    const service = new StockService({} as never);
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
    const service = new StockService({} as never);
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
    const service = new StockService({} as never);
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

  it('updates a custody bucket with Decimal precision and immutable history', async () => {
    const service = new StockService({} as never);
    const tx = {
      custodyBalance: {
        upsert: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      stockTransaction: {
        create: jest.fn().mockResolvedValue({ id: 'transaction' }),
      },
      $queryRaw: jest
        .fn()
        .mockResolvedValue([{ quantity: new Prisma.Decimal('1.1250') }]),
    };

    await service.createCustodyIncreasingTransactionInTx(tx as never, {
      type: StockTransactionType.ASSIGNMENT_IN_CUSTODY,
      accountingOwnerResponsiblePersonId:
        '11111111-1111-4111-8111-111111111111',
      custodianResponsiblePersonId:
        '22222222-2222-4222-8222-222222222222',
      inventoryItemId: '33333333-3333-4333-8333-333333333333',
      quantity: '0.3750',
      occurredAt: new Date('2026-01-01'),
    });

    expect(tx.custodyBalance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { quantity: new Prisma.Decimal('1.5000') },
      }),
    );
    expect(tx.stockTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bucketKind: StockSourceKind.ASSIGNED,
          balanceBefore: new Prisma.Decimal('1.1250'),
          balanceAfter: new Prisma.Decimal('1.5000'),
        }),
      }),
    );
  });

  it('returns direct and assigned holdings as separate available sources', async () => {
    const person = {
      id: '11111111-1111-4111-8111-111111111111',
      lastName: 'Левіс',
      firstName: 'Артур',
      middleName: null,
      personnelNumber: '003',
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
      custodyBalance: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'custody-id',
            quantity: new Prisma.Decimal('1.5'),
            inventoryItem: item,
            accountingOwnerResponsiblePerson: {
              ...person,
              id: '22222222-2222-4222-8222-222222222222',
            },
            custodianResponsiblePerson: person,
          },
        ]),
      },
    };
    const service = new StockService(prisma as never);

    const result = await service.availableToMe({
      id: 'user-id',
      username: 'mvo',
      role: UserRole.MVO,
      isActive: true,
      mustChangePassword: false,
      responsiblePersonId: person.id,
    });

    expect(result).toEqual([
      expect.objectContaining({
        sourceKind: StockSourceKind.DIRECT,
        availableQuantity: '2',
        sourceBalanceId: 'direct-id',
      }),
      expect.objectContaining({
        sourceKind: StockSourceKind.ASSIGNED,
        availableQuantity: '1.5',
        sourceBalanceId: 'custody-id',
      }),
    ]);
  });

  it('builds an MVO accounting card without mixing owned and held totals', async () => {
    const person = {
      id: '11111111-1111-4111-8111-111111111111',
      lastName: 'Левіс',
      firstName: 'Артур',
      middleName: null,
      personnelNumber: '003',
    };
    const item = { id: 'item-id', name: 'Клавіатура' };
    const prisma = {
      stockBalance: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'direct', quantity: new Prisma.Decimal(2), inventoryItem: item },
        ]),
      },
      custodyBalance: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            {
              id: 'assigned-out',
              quantity: new Prisma.Decimal(2),
              inventoryItem: item,
              accountingOwnerResponsiblePerson: person,
              custodianResponsiblePerson: { ...person, id: 'other' },
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ])
          .mockResolvedValueOnce([
            {
              id: 'assigned-in',
              quantity: new Prisma.Decimal(1),
              inventoryItem: item,
              accountingOwnerResponsiblePerson: { ...person, id: 'owner-2' },
              custodianResponsiblePerson: person,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ]),
      },
      stockDocument: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new StockService(prisma as never);

    const result = await service.responsiblePersonAccountingCard(person.id, {
      id: 'user-id',
      username: 'owner',
      role: UserRole.OWNER,
      isActive: true,
      mustChangePassword: false,
      responsiblePersonId: null,
    });

    expect(result.totalOwnedAccountingQuantity).toBe('4');
    expect(result.totalPhysicallyHeldQuantity).toBe('3');
    expect(result.directBalances).toHaveLength(1);
    expect(result.assignedToOthers).toHaveLength(1);
    expect(result.assignedToMe).toHaveLength(1);
  });

  it('adds direct, assigned-out and total quantities to balance rows', async () => {
    const responsiblePerson = {
      id: '11111111-1111-4111-8111-111111111111',
      lastName: 'Левіс',
      firstName: 'Артур',
      middleName: null,
      personnelNumber: '003',
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
      custodyBalance: {
        groupBy: jest.fn().mockResolvedValue([
          {
            accountingOwnerResponsiblePersonId: responsiblePerson.id,
            inventoryItemId: inventoryItem.id,
            _sum: { quantity: new Prisma.Decimal(2) },
          },
        ]),
      },
    };
    const service = new StockService(prisma as never);

    const result = await service.listBalances({ page: 1, limit: 20 });

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        directQuantity: '2',
        assignedToOthersQuantity: '2',
        totalAccountedQuantity: '4',
      }),
    );
  });
});
