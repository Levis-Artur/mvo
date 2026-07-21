import { UserRole } from '@prisma/client';
import {
  hasCapability,
  IMPORT_WRITE_ROLES,
  STOCK_DOCUMENT_WRITE_ROLES,
  STOCK_DOCUMENT_READ_ROLES,
  STOCK_READ_ROLES,
  TRANSFER_TARGET_READ_ROLES,
  TRANSACTION_READ_ROLES,
} from './access-policy';

describe('ACCOUNTANT access policy', () => {
  it('allows imports and read-only stock document access', () => {
    expect(IMPORT_WRITE_ROLES).toContain(UserRole.ACCOUNTANT);
    expect(hasCapability(UserRole.ACCOUNTANT, 'IMPORT_WRITE')).toBe(true);
    expect(hasCapability(UserRole.ACCOUNTANT, 'STOCK_DOCUMENT_READ')).toBe(
      true,
    );
  });

  it('keeps MVO read access to own stock and stock documents', () => {
    expect(STOCK_READ_ROLES).toContain(UserRole.MVO);
    expect(STOCK_DOCUMENT_READ_ROLES).toContain(UserRole.MVO);
    expect(TRANSFER_TARGET_READ_ROLES).toContain(UserRole.MVO);
    expect(TRANSFER_TARGET_READ_ROLES).not.toContain(UserRole.ACCOUNTANT);
    expect(TRANSFER_TARGET_READ_ROLES).not.toContain(UserRole.AUDITOR);
    expect(hasCapability(UserRole.MVO, 'REFERENCE_DATA_READ')).toBe(false);
    expect(hasCapability(UserRole.MVO, 'MVO_SCOPED_ACCESS')).toBe(true);
    expect(TRANSACTION_READ_ROLES).not.toContain(UserRole.MVO);
    expect(TRANSACTION_READ_ROLES).toEqual(expect.arrayContaining([
      UserRole.OWNER, UserRole.DPP_ADMIN, UserRole.ACCOUNTANT, UserRole.AUDITOR,
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
});
