import type { Service, UserSummary } from '../../lib/types';
import {
  safeUserPresentation,
  serviceCodeLabel,
  serviceCodesForScope,
  userUiAccess,
} from './user-model';

const user = {
  id: 'user-1', username: 'owner', role: 'OWNER', isActive: true,
  mustChangePassword: false, twoFactorEnabled: false, responsiblePersonId: null, lastLoginAt: null,
  failedLoginAttempts: 0, lockedUntil: null, passwordChangedAt: null,
  createdAt: '', updatedAt: '', createdById: null, responsiblePerson: null,
} satisfies UserSummary;

describe('users presentation permissions', () => {
  it('gives OWNER administrative and destructive actions', () => {
    expect(userUiAccess('OWNER')).toEqual({ visible: true, readOnly: false, destructive: true });
  });

  it('keeps AUDITOR read-only and hides users from MVO', () => {
    expect(userUiAccess('AUDITOR').readOnly).toBe(true);
    expect(userUiAccess('AUDITOR').destructive).toBe(false);
    expect(userUiAccess('MVO').visible).toBe(false);
  });

  it('never exposes password hashes or session tokens', () => {
    const keys = Object.keys(safeUserPresentation(user));
    expect(keys).not.toContain('passwordHash');
    expect(keys).not.toContain('sessionToken');
  });

  it('uses services of a selected management for manager scopes', () => {
    const services = [
      { id: '1', code: 'IT', managementId: 'm-1', isActive: true },
      { id: '2', code: 'MTZ', managementId: 'm-1', isActive: true },
      { id: '3', code: 'IT', managementId: 'm-2', isActive: true },
      { id: '4', code: 'UATZ', managementId: 'm-2', isActive: true },
    ] as Service[];

    expect(serviceCodesForScope(services, 'm-1')).toEqual(['IT', 'MTZ']);
  });

  it('deduplicates service codes across all managements', () => {
    const services = [
      { id: '1', code: 'IT', managementId: 'm-1', isActive: true },
      { id: '2', code: 'IT', managementId: 'm-2', isActive: true },
      { id: '3', code: 'MTZ', managementId: 'm-2', isActive: true },
      { id: '4', code: 'UATZ', managementId: 'm-2', isActive: true },
    ] as Service[];

    expect(serviceCodesForScope(services, null)).toEqual([
      'IT',
      'MTZ',
      'UATZ',
    ]);
    expect(serviceCodeLabel('IT')).toBe('ІТ');
    expect(serviceCodeLabel('MTZ')).toBe('МТЗ');
    expect(serviceCodeLabel('UATZ')).toBe('УАТЗ');
  });
});
