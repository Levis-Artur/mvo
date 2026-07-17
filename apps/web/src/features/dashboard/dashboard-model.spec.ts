import type { AuthUser, DashboardStats } from '@/lib/types';
import { dashboardContentState, dashboardMetrics, getDashboardActions } from './dashboard-model';

const owner = { id: 'owner', username: 'owner', role: 'OWNER', isActive: true, mustChangePassword: false, responsiblePersonId: null } as AuthUser;
const auditor = { ...owner, id: 'auditor', username: 'auditor', role: 'AUDITOR' } as AuthUser;
const stats: DashboardStats = { activeResponsiblePersons: 2, managements: 1, services: 3, units: 4, inventoryItems: 51, inventoryItemsNeedsReview: 5, responsiblePersonsWithStock: 6, completedImports: 7, importsWithErrors: 8, recentReceiptDiscrepancies: 9 };

describe('dashboard presentation model', () => {
  it('показує фактичні dashboard metrics без підміни значень', () => {
    expect(Object.fromEntries(dashboardMetrics.map((metric) => [metric.label, stats[metric.key]]))).toMatchObject({ 'Активні МВО': 2, Номенклатура: 51, 'Імпорти з помилками': 8 });
  });

  it('quick actions мають правильні URL', () => {
    expect(getDashboardActions(owner).map(({ label, href }) => [label, href])).toEqual([
      ['Новий імпорт', '/imports'], ['Реєстр МВО', '/persons'], ['Переглянути залишки', '/stock'], ['Організаційна структура', '/structure'], ['Журнал операцій', '/transactions'],
    ]);
    expect(getDashboardActions(auditor).some((action) => action.label === 'Новий імпорт')).toBe(false);
  });

  it('API error використовує ErrorState branch', () => {
    expect(dashboardContentState(false, 'Помилка API', null)).toBe('error');
  });

  it('loading використовує LoadingState branch', () => {
    expect(dashboardContentState(true, '', null)).toBe('loading');
  });

  it('responsive структура не залежить від ширини у JavaScript', () => {
    expect(dashboardContentState(false, '', stats)).toBe('ready');
    expect(dashboardMetrics).toHaveLength(10);
  });
});
