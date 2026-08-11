import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { can, getDefaultAppPath, getNavigationItems } from '@/lib/authz';
import type { AuthUser } from '@/lib/types';

const user = (role: AuthUser['role']) => ({
  id: role,
  username: role.toLowerCase(),
  role,
  isActive: true,
  mustChangePassword: false,
  responsiblePersonId: null,
}) as AuthUser;

describe('Accounting workspace', () => {
  it('routes ACCOUNTANT directly to the simple accounting workspace', () => {
    const accountant = user('ACCOUNTANT');
    expect(getDefaultAppPath(accountant)).toBe('/accounting');
    expect(getNavigationItems(accountant).map((item) => item.label)).toEqual([
      'Бухгалтерія',
      'Профіль',
    ]);
    expect(can(accountant, 'write', 'imports')).toBe(true);
    expect(can(user('MVO'), 'read', 'accounting')).toBe(false);
  });

  it('mounts only the production import workspace without analytics tabs', () => {
    const view = readFileSync(join(__dirname, 'accounting-workspace-view.tsx'), 'utf8');

    expect(view).toContain('<ImportsView accountingWorkspace embedded />');
    expect(view).not.toContain('AccountingOverview');
    expect(view).not.toContain('AccountingTransfersView');
    expect(view).not.toContain('AccountingMovementsView');
    expect(view).not.toContain('StockView');
    expect(view).not.toContain('tablist');
  });

  it('does not grant ACCOUNTANT frontend access to global registers', () => {
    const accountant = user('ACCOUNTANT');
    for (const resource of ['stock', 'transactions', 'stockDocuments', 'accountingTransfers'] as const) {
      expect(can(accountant, 'read', resource)).toBe(false);
    }
    expect(can(user('OWNER'), 'read', 'stock')).toBe(true);
    expect(can(user('OWNER'), 'read', 'accountingTransfers')).toBe(true);
  });
});
