import { BadRequestException } from '@nestjs/common';
import { Prisma, StockTransactionType } from '@prisma/client';
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
});
