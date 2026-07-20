import { Prisma, UserRole } from '@prisma/client';
import { InventoryItemsService } from './inventory-items.service';

describe('InventoryItemsService accounting card', () => {
  it('returns direct, custody and total accounted quantities separately', async () => {
    const person = {
      id: '11111111-1111-4111-8111-111111111111',
      lastName: 'Левіс',
      firstName: 'Артур',
      middleName: null,
      personnelNumber: '003',
    };
    const item = {
      id: '22222222-2222-4222-8222-222222222222',
      externalCode: 'KB-1',
      name: 'Клавіатура',
      unitOfMeasure: 'шт',
      isActive: true,
    };
    const prisma = {
      inventoryItem: { findFirst: jest.fn().mockResolvedValue(item) },
      stockBalance: {
        findMany: jest.fn().mockResolvedValue([
          {
            quantity: new Prisma.Decimal(4),
            responsiblePerson: person,
          },
        ]),
      },
      custodyBalance: {
        findMany: jest.fn().mockResolvedValue([
          {
            quantity: new Prisma.Decimal(2),
            accountingOwnerResponsiblePerson: person,
            custodianResponsiblePerson: {
              ...person,
              id: '33333333-3333-4333-8333-333333333333',
            },
          },
        ]),
      },
      stockDocument: { findMany: jest.fn().mockResolvedValue([]) },
      stockTransaction: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new InventoryItemsService(prisma as never);

    const result = await service.accountingCard(item.id, {
      id: 'user-id',
      username: 'auditor',
      role: UserRole.AUDITOR,
      isActive: true,
      mustChangePassword: false,
      responsiblePersonId: null,
    });

    expect(result.inventoryItem).toEqual(item);
    expect(result.totals).toEqual({
      directQuantity: '4',
      assignedQuantity: '2',
      totalAccountedQuantity: '6',
    });
    expect(result.directBalances).toEqual([
      expect.objectContaining({ quantity: '4' }),
    ]);
    expect(result.custodyBalances).toEqual([
      expect.objectContaining({ quantity: '2' }),
    ]);
  });
});
