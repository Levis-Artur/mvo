import { APP_SHELL_REGIONS } from './app-shell-model';
import { isNavigationActive } from './navigation-model';
import { can, getNavigationItems } from '../../lib/authz';
import type { AuthUser } from '../../lib/types';

const user = (role: AuthUser['role']) => ({ id: role, username: role, role, isActive: true, mustChangePassword: false, responsiblePersonId: role === 'MVO' ? 'person-1' : null }) as AuthUser;

describe('AppShell presentation model', () => {
  it('містить header, navigation, main і footer', () => {
    expect(APP_SHELL_REGIONS).toEqual(['header', 'navigation', 'main', 'footer']);
  });

  it('визначає активний пункт за поточним маршрутом', () => {
    expect(isNavigationActive('/imports/123', '/imports')).toBe(true);
    expect(isNavigationActive('/stock', '/imports')).toBe(false);
    expect(isNavigationActive('/persons', '/')).toBe(false);
  });

  it('роль впливає на видимі пункти навігації', () => {
    expect(getNavigationItems(user('OWNER')).some((item) => item.href === '/admin/users')).toBe(true);
    expect(getNavigationItems(user('AUDITOR')).some((item) => item.href === '/admin/users')).toBe(false);
    expect(getNavigationItems(user('MVO')).some((item) => item.href === '/my-stock')).toBe(true);
  });

  it('надає кожній ролі лише її активні маршрути', () => {
    const paths = (role: AuthUser['role']) =>
      getNavigationItems(user(role)).filter((item) => !item.disabled).map((item) => item.href);

    expect(paths('OWNER')).toEqual([
      '/', '/persons', '/structure', '/nomenclature', '/stock', '/imports',
      '/transactions', '/transfers', '/admin/users', '/admin',
    ]);
    expect(paths('DPP_ADMIN')).toEqual([
      '/', '/persons', '/structure', '/nomenclature', '/stock', '/imports',
      '/transactions', '/transfers', '/mvo-users',
    ]);
    expect(paths('AUDITOR')).toEqual([
      '/', '/persons', '/structure', '/nomenclature', '/stock', '/imports',
      '/transactions', '/transfers',
    ]);
    expect(paths('MVO')).toEqual([
      '/my-card', '/my-stock', '/my-transactions', '/transfers', '/profile',
    ]);
  });

  it('зберігає AUDITOR у read-only режимі та не відкриває користувачів для MVO', () => {
    const auditor = user('AUDITOR');
    expect(can(auditor, 'read', 'stockDocuments')).toBe(true);
    expect(can(auditor, 'write', 'stockDocuments')).toBe(false);
    expect(can(auditor, 'write', 'imports')).toBe(false);
    expect(getNavigationItems(user('MVO')).some((item) => item.resource === 'users')).toBe(false);
  });
});
