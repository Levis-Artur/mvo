import type { UserSummary } from '../../lib/types';
import { safeUserPresentation, userUiAccess } from './user-model';

const user = {
  id: 'user-1', username: 'owner', role: 'OWNER', isActive: true,
  mustChangePassword: false, responsiblePersonId: null, lastLoginAt: null,
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
});
