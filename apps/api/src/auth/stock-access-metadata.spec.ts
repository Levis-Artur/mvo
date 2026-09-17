import 'reflect-metadata';
import { UserRole } from '@prisma/client';
import { ResponsiblePersonsController } from '../responsible-persons/responsible-persons.controller';
import { StockController } from '../stock/stock.controller';
import { StockDocumentsController } from '../stock-documents/stock-documents.controller';
import { InventoryItemsController } from '../inventory-items/inventory-items.controller';
import { ROLES_KEY } from './roles.decorator';

function roles(target: object) {
  return Reflect.getMetadata(ROLES_KEY, target) as UserRole[] | undefined;
}

describe('stock route role metadata', () => {
  it('allows MVO scoped document reads and available-to-me', () => {
    expect(roles(StockDocumentsController)).toContain(UserRole.MVO);
    expect(roles(StockController.prototype.availableToMe)).toEqual([
      UserRole.MVO,
      UserRole.ORG_MANAGER,
    ]);
    expect(roles(StockController.prototype.myProperty)).toEqual(
      expect.arrayContaining([UserRole.MVO, UserRole.OWNER]),
    );
    expect(roles(StockController.prototype.exportMyProperty)).toEqual(
      expect.arrayContaining([UserRole.MVO]),
    );
    expect(roles(StockController.prototype.exportMyProperty)).not.toContain(UserRole.ACCOUNTANT);
    expect(
      roles(InventoryItemsController.prototype.myMovementHistory),
    ).toEqual([UserRole.MVO]);
  });

  it('allows scoped MVO registry reads and transfer-targets without registry writes', () => {
    expect(
      roles(ResponsiblePersonsController.prototype.transferTargets),
    ).toContain(UserRole.MVO);
    expect(roles(ResponsiblePersonsController)).toContain(UserRole.MVO);
    expect(roles(ResponsiblePersonsController.prototype.create)).toEqual([UserRole.OWNER]);
    expect(roles(ResponsiblePersonsController.prototype.update)).toEqual([UserRole.OWNER]);
  });

  it('closes stock documents to ACCOUNTANT', () => {
    expect(roles(StockDocumentsController)).not.toContain(UserRole.ACCOUNTANT);
  });

  it('preserves scoped transaction reads for MVO and ORG_MANAGER', () => {
    for (const method of [
      StockController.prototype.listTransactions,
      StockController.prototype.findTransaction,
      ResponsiblePersonsController.prototype.stockTransactions,
    ]) {
      expect(roles(method)).toEqual([UserRole.OWNER, UserRole.ORG_MANAGER, UserRole.MVO]);
    }
  });

  it('keeps the global inventory accounting card read-only and closed to MVO', () => {
    const cardRoles = roles(InventoryItemsController.prototype.accountingCard);
    const exportRoles = roles(
      InventoryItemsController.prototype.exportAccountingCardMovements,
    );
    expect(cardRoles).toEqual(
      expect.arrayContaining([
        UserRole.OWNER,
      ]),
    );
    expect(cardRoles).not.toContain(UserRole.MVO);
    expect(cardRoles).not.toContain(UserRole.ACCOUNTANT);
    expect(exportRoles).toEqual(cardRoles);
  });
});
