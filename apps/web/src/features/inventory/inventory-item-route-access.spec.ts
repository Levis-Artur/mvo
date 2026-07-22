import { can, canAccessPath } from '../../lib/authz';
import type { AuthUser, UserRole } from '../../lib/types';

function user(role: UserRole): AuthUser {
  return {
    id: `${role}-id`,
    username: role.toLowerCase(),
    role,
    isActive: true,
    mustChangePassword: false,
    responsiblePersonId: role === 'MVO' ? 'person-1' : null,
  };
}

describe('inventory item card route access', () => {
  it.each(['OWNER', 'DPP_ADMIN', 'ACCOUNTANT', 'AUDITOR'] as UserRole[])(
    'allows %s to open a global inventory item card',
    (role) => {
      expect(
        canAccessPath(
          user(role),
          '/inventory-items/11111111-1111-4111-8111-111111111111',
          'nomenclature',
        ),
      ).toBe(true);
    },
  );

  it('does not expose the global card to MVO', () => {
    expect(
      canAccessPath(
        user('MVO'),
        '/inventory-items/11111111-1111-4111-8111-111111111111',
        'nomenclature',
      ),
    ).toBe(false);
  });

  it.each(['ACCOUNTANT', 'AUDITOR'] as UserRole[])(
    'keeps %s read-only in nomenclature',
    (role) => {
      expect(can(user(role), 'read', 'nomenclature')).toBe(true);
      expect(can(user(role), 'write', 'nomenclature')).toBe(false);
    },
  );
});
