import { UserRole } from '@prisma/client';
import {
  ACCOUNTING_ANALYTICS_READ_ROLES,
  ACCOUNTING_TRANSFER_EXPORT_ROLES,
  ACCOUNTING_TRANSFER_READ_ROLES,
  hasCapability,
  IMPORT_MAINTENANCE_ROLES,
  IMPORT_READ_ROLES,
  IMPORT_WRITE_ROLES,
  INVENTORY_ITEM_ACCOUNTING_CARD_READ_ROLES,
  REFERENCE_DATA_READ_ROLES,
  STOCK_DOCUMENT_WRITE_ROLES,
  STOCK_DOCUMENT_READ_ROLES,
  STOCK_READ_ROLES,
  TRANSFER_TARGET_READ_ROLES,
  TRANSACTION_READ_ROLES,
} from './access-policy';

describe('ACCOUNTANT access policy', () => {
  it('allows only the production import workflow and the simple accounting entry point', () => {
    expect(IMPORT_READ_ROLES).toContain(UserRole.ACCOUNTANT);
    expect(IMPORT_WRITE_ROLES).toContain(UserRole.ACCOUNTANT);
    expect(IMPORT_MAINTENANCE_ROLES).not.toContain(UserRole.ACCOUNTANT);
    expect(hasCapability(UserRole.ACCOUNTANT, 'IMPORT_READ')).toBe(true);
    expect(hasCapability(UserRole.ACCOUNTANT, 'IMPORT_WRITE')).toBe(true);
    expect(hasCapability(UserRole.ACCOUNTANT, 'ACCOUNTING_WORKSPACE_READ')).toBe(true);
    expect(hasCapability(UserRole.ACCOUNTANT, 'REFERENCE_DATA_READ')).toBe(false);
    expect(hasCapability(UserRole.ACCOUNTANT, 'STOCK_READ')).toBe(false);
    expect(hasCapability(UserRole.ACCOUNTANT, 'STOCK_DOCUMENT_READ')).toBe(false);
    expect(hasCapability(UserRole.ACCOUNTANT, 'ACCOUNTING_TRANSFER_READ')).toBe(false);
    expect(REFERENCE_DATA_READ_ROLES).not.toContain(UserRole.ACCOUNTANT);
    expect(STOCK_READ_ROLES).not.toContain(UserRole.ACCOUNTANT);
    expect(STOCK_DOCUMENT_READ_ROLES).not.toContain(UserRole.ACCOUNTANT);
    expect(TRANSACTION_READ_ROLES).not.toContain(UserRole.ACCOUNTANT);
    expect(INVENTORY_ITEM_ACCOUNTING_CARD_READ_ROLES).not.toContain(UserRole.ACCOUNTANT);
    expect(ACCOUNTING_TRANSFER_READ_ROLES).not.toContain(UserRole.ACCOUNTANT);
    expect(ACCOUNTING_TRANSFER_EXPORT_ROLES).not.toContain(UserRole.ACCOUNTANT);
  });

  it('keeps MVO read access to own stock and stock documents', () => {
    expect(STOCK_READ_ROLES).toContain(UserRole.MVO);
    expect(STOCK_DOCUMENT_READ_ROLES).toContain(UserRole.MVO);
    expect(TRANSFER_TARGET_READ_ROLES).toContain(UserRole.MVO);
    expect(TRANSFER_TARGET_READ_ROLES).not.toContain(UserRole.ACCOUNTANT);
    expect(TRANSFER_TARGET_READ_ROLES).not.toContain(UserRole.AUDITOR);
    expect(hasCapability(UserRole.MVO, 'REFERENCE_DATA_READ')).toBe(false);
    expect(hasCapability(UserRole.MVO, 'IMPORT_READ')).toBe(false);
    expect(hasCapability(UserRole.MVO, 'IMPORT_WRITE')).toBe(false);
    expect(hasCapability(UserRole.MVO, 'MVO_SCOPED_ACCESS')).toBe(true);
    expect(TRANSACTION_READ_ROLES).not.toContain(UserRole.MVO);
    expect(TRANSACTION_READ_ROLES).toEqual(expect.arrayContaining([
      UserRole.OWNER, UserRole.DPP_ADMIN, UserRole.AUDITOR,
    ]));
  });

  it('does not grant MVO, document-write, user or destructive permissions', () => {
    expect(STOCK_DOCUMENT_WRITE_ROLES).not.toContain(UserRole.ACCOUNTANT);
    expect(hasCapability(UserRole.ACCOUNTANT, 'MVO_SCOPED_ACCESS')).toBe(false);
    expect(hasCapability(UserRole.ACCOUNTANT, 'STOCK_DOCUMENT_WRITE')).toBe(
      false,
    );
    expect(hasCapability(UserRole.ACCOUNTANT, 'USER_ADMINISTRATION')).toBe(
      false,
    );
    expect(
      hasCapability(UserRole.ACCOUNTANT, 'OWNER_DESTRUCTIVE_ADMINISTRATION'),
    ).toBe(false);
  });

  it('keeps global accounting analytics OWNER-only', () => {
    expect(ACCOUNTING_ANALYTICS_READ_ROLES).toEqual([UserRole.OWNER]);
    expect(hasCapability(UserRole.ACCOUNTANT, 'ACCOUNTING_WORKSPACE_READ')).toBe(
      true,
    );
    expect(hasCapability(UserRole.DPP_ADMIN, 'ACCOUNTING_WORKSPACE_READ')).toBe(
      false,
    );
    expect(hasCapability(UserRole.AUDITOR, 'ACCOUNTING_WORKSPACE_READ')).toBe(
      false,
    );
    expect(hasCapability(UserRole.MVO, 'ACCOUNTING_WORKSPACE_READ')).toBe(false);
  });
});
