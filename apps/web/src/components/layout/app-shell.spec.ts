import { APP_SHELL_REGIONS } from './app-shell-model';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isNavigationActive } from './navigation-model';
import { can, getAccessRedirectPath, getNavigationItems } from '../../lib/authz';
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
      '/transactions', '/transfers', '/accounting/mvo-transfers', '/admin/users', '/admin',
    ]);
    expect(paths('DPP_ADMIN')).toEqual([
      '/', '/persons', '/structure', '/nomenclature', '/stock', '/imports',
      '/transactions', '/transfers', '/accounting/mvo-transfers', '/mvo-users',
    ]);
    expect(paths('AUDITOR')).toEqual([
      '/', '/persons', '/structure', '/nomenclature', '/stock', '/imports',
      '/transactions', '/transfers', '/accounting/mvo-transfers',
    ]);
    expect(paths('ACCOUNTANT')).toEqual([
      '/persons', '/nomenclature', '/stock', '/imports', '/transactions',
      '/transfers', '/accounting/mvo-transfers', '/profile',
    ]);
    expect(paths('MVO')).toEqual([
      '/my-stock', '/transfers', '/profile',
    ]);
    expect(getNavigationItems(user('MVO')).map((item) => item.label)).toEqual([
      'Моє майно', 'Передачі та видачі', 'Профіль',
    ]);
  });

  it('ACCOUNTANT може проводити імпорти, але не бачить дій передачі чи адміністрування', () => {
    const accountant = user('ACCOUNTANT');
    expect(can(accountant, 'write', 'imports')).toBe(true);
    expect(can(accountant, 'read', 'stockDocuments')).toBe(true);
    expect(can(accountant, 'write', 'stockDocuments')).toBe(false);
    expect(can(accountant, 'read', 'users')).toBe(false);
  });

  it('зберігає AUDITOR у read-only режимі та не відкриває користувачів для MVO', () => {
    const auditor = user('AUDITOR');
    expect(can(auditor, 'read', 'stockDocuments')).toBe(true);
    expect(can(auditor, 'write', 'stockDocuments')).toBe(false);
    expect(can(auditor, 'write', 'imports')).toBe(false);
    expect(getNavigationItems(user('MVO')).some((item) => item.resource === 'users')).toBe(false);
  });

  it('перенаправляє MVO зі старого журналу до документів', () => {
    expect(getAccessRedirectPath(user('MVO'), 'my-transactions')).toBe('/transfers');
    expect(getAccessRedirectPath(user('OWNER'), 'my-transactions')).toBe('/');
  });

  it('відкриває MVO моє майно за замовчуванням і перенаправляє стару картку у профіль', () => {
    expect(getAccessRedirectPath(user('MVO'), 'my-card')).toBe('/profile');
    expect(getAccessRedirectPath(user('MVO'), 'home')).toBe('/my-stock');
  });

  it('не монтує технічний журнал під час завантаження MVO AppShell', () => {
    const app = readFileSync(join(__dirname, '../../app/ui/mvo-app.tsx'), 'utf8');
    const views = readFileSync(join(__dirname, '../../features/responsible-persons/my-views.tsx'), 'utf8');
    expect(app).not.toContain('MyTransactionsView');
    expect(app).not.toContain('MyCardView');
    expect(views).not.toContain('PersonOperationsTab');
    expect(views).not.toContain('getResponsiblePersonStockTransactions');
  });
});
