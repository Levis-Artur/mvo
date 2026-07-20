import { UserRole } from '@prisma/client';
import {
  hasCapability,
  IMPORT_WRITE_ROLES,
  STOCK_DOCUMENT_WRITE_ROLES,
} from './access-policy';

describe('ACCOUNTANT access policy', () => {
  it('allows imports and read-only stock document access', () => {
    expect(IMPORT_WRITE_ROLES).toContain(UserRole.ACCOUNTANT);
    expect(hasCapability(UserRole.ACCOUNTANT, 'IMPORT_WRITE')).toBe(true);
    expect(hasCapability(UserRole.ACCOUNTANT, 'STOCK_DOCUMENT_READ')).toBe(
      true,
    );
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
