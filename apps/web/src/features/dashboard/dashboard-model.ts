import type { IconName } from '@/components/ui';
import type { AppView } from '@/lib/authz';
import { can } from '../../lib/authz';
import type { AuthUser, DashboardStats } from '@/lib/types';

export type DashboardMetric = { key: keyof DashboardStats; label: string; icon: IconName; tone?: 'primary' | 'warning' | 'danger' };
export const dashboardMetrics: DashboardMetric[] = [
  { key: 'activeResponsiblePersons', label: 'Активні МВО', icon: 'people' },
  { key: 'managements', label: 'Управління', icon: 'structure' },
  { key: 'services', label: 'Служби', icon: 'building' },
  { key: 'units', label: 'Підрозділи', icon: 'building' },
  { key: 'inventoryItems', label: 'Номенклатура', icon: 'box' },
  { key: 'inventoryItemsNeedsReview', label: 'Потребують перевірки', icon: 'shield', tone: 'warning' },
  { key: 'responsiblePersonsWithStock', label: 'МВО із залишками', icon: 'database' },
  { key: 'completedImports', label: 'Проведені імпорти', icon: 'upload' },
  { key: 'importsWithErrors', label: 'Імпорти з помилками', icon: 'warning', tone: 'danger' },
  { key: 'recentReceiptDiscrepancies', label: 'Розбіжності надходжень', icon: 'warning' },
];

export type DashboardAction = { label: string; description: string; href: string; view: AppView; icon: IconName; importAction?: boolean };
const actions: (DashboardAction & { visible: (user: AuthUser | null) => boolean })[] = [
  { label: 'Новий імпорт', description: 'Завантажити та обробити дані', href: '/imports', view: 'imports', icon: 'upload', importAction: true, visible: (user) => can(user, 'write', 'imports') },
  { label: 'Реєстр МВО', description: 'Переглянути реєстр МВО', href: '/persons', view: 'persons', icon: 'people', visible: (user) => can(user, 'read', 'responsiblePersons') },
  { label: 'Переглянути залишки', description: 'Доступність та залишки майна', href: '/stock', view: 'stock', icon: 'database', visible: (user) => can(user, 'read', 'stock') },
  { label: 'Організаційна структура', description: 'Структура підрозділів і МВО', href: '/structure', view: 'structure', icon: 'structure', visible: (user) => can(user, 'read', 'organization') },
  { label: 'Журнал операцій', description: 'Переглянути історію подій', href: '/transactions', view: 'transactions', icon: 'journal', visible: (user) => can(user, 'read', 'transactions') },
];
export function getDashboardActions(user: AuthUser | null) {
  return actions.filter((action) => action.visible(user)).map((action) => ({
    label: action.label,
    description: action.description,
    href: action.href,
    view: action.view,
    icon: action.icon,
    importAction: action.importAction,
  }));
}
export function dashboardContentState(loading: boolean, error: string, stats: DashboardStats | null) { return loading ? 'loading' : error ? 'error' : stats ? 'ready' : 'empty'; }
