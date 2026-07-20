import 'reflect-metadata';
import { UserRole } from '@prisma/client';
import { ResponsiblePersonsController } from '../responsible-persons/responsible-persons.controller';
import { StockController } from '../stock/stock.controller';
import { StockDocumentsController } from '../stock-documents/stock-documents.controller';
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
      expect.arrayContaining([UserRole.MVO, UserRole.ACCOUNTANT, UserRole.DPP_ADMIN]),
    );
  });

  it('allows transfer-targets without opening the administrative registry', () => {
    expect(
      roles(ResponsiblePersonsController.prototype.transferTargets),
    ).toContain(UserRole.MVO);
    expect(roles(ResponsiblePersonsController)).not.toContain(UserRole.MVO);
  });

  it('keeps ACCOUNTANT and AUDITOR read-only for stock documents', () => {
    expect(roles(StockDocumentsController)).toEqual(
      expect.arrayContaining([UserRole.ACCOUNTANT, UserRole.AUDITOR]),
    );
  });
});
