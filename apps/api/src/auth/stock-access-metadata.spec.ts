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
    ]);
    expect(roles(StockController.prototype.myProperty)).toEqual(
      expect.arrayContaining([UserRole.MVO, UserRole.OWNER, UserRole.AUDITOR]),
    );
    expect(roles(StockController.prototype.exportMyProperty)).toEqual(
      expect.arrayContaining([UserRole.MVO, UserRole.DPP_ADMIN]),
    );
    expect(roles(StockController.prototype.exportMyProperty)).not.toContain(UserRole.ACCOUNTANT);
  });

  it('allows transfer-targets without opening the administrative registry', () => {
    expect(
      roles(ResponsiblePersonsController.prototype.transferTargets),
    ).toContain(UserRole.MVO);
    expect(roles(ResponsiblePersonsController)).not.toContain(UserRole.MVO);
  });

  it('keeps AUDITOR read-only and closes stock documents to ACCOUNTANT', () => {
    expect(roles(StockDocumentsController)).toContain(UserRole.AUDITOR);
    expect(roles(StockDocumentsController)).not.toContain(UserRole.ACCOUNTANT);
  });

  it('keeps the technical transaction journal closed to MVO', () => {
    expect(roles(StockController.prototype.listTransactions)).not.toContain(UserRole.MVO);
    expect(roles(StockController.prototype.findTransaction)).not.toContain(UserRole.MVO);
    expect(roles(ResponsiblePersonsController.prototype.stockTransactions)).not.toContain(UserRole.MVO);
    expect(roles(StockController.prototype.listTransactions)).toEqual(
      expect.arrayContaining([UserRole.OWNER, UserRole.DPP_ADMIN, UserRole.AUDITOR]),
    );
    expect(roles(StockController.prototype.listTransactions)).not.toContain(UserRole.ACCOUNTANT);
  });

  it('keeps the global inventory accounting card read-only and closed to MVO', () => {
    const cardRoles = roles(InventoryItemsController.prototype.accountingCard);
    const exportRoles = roles(
      InventoryItemsController.prototype.exportAccountingCardMovements,
    );
    expect(cardRoles).toEqual(
      expect.arrayContaining([
        UserRole.OWNER,
        UserRole.DPP_ADMIN,
        UserRole.AUDITOR,
      ]),
    );
    expect(cardRoles).not.toContain(UserRole.MVO);
    expect(cardRoles).not.toContain(UserRole.ACCOUNTANT);
    expect(exportRoles).toEqual(cardRoles);
  });
});
