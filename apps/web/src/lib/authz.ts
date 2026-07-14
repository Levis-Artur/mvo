import type { AuthUser, UserRole } from './types';

export type PermissionAction =
  | 'read'
  | 'write'
  | 'manage'
  | 'resetPassword'
  | 'revokeSessions';

export type PermissionResource =
  | 'dashboard'
  | 'responsiblePersons'
  | 'organization'
  | 'nomenclature'
  | 'stock'
  | 'imports'
  | 'transactions'
  | 'users'
  | 'mvoUsers'
  | 'reports'
  | 'profile'
  | 'ownCard'
  | 'ownStock'
  | 'ownTransactions'
  | 'ownTransfers'
  | 'administration';

export type AppView =
  | 'home'
  | 'persons'
  | 'structure'
  | 'stock'
  | 'nomenclature'
  | 'imports'
  | 'transactions'
  | 'users'
  | 'reports'
  | 'administration'
  | 'my-card'
  | 'my-stock'
  | 'my-transactions'
  | 'transfers'
  | 'profile';

export type ToolbarActionId =
  | 'create'
  | 'create-management'
  | 'create-receipt'
  | 'new-import'
  | 'refresh'
  | 'focus-filter'
  | 'export'
  | 'print';

export type NavigationItem = {
  label: string;
  href: string;
  view: AppView;
  resource: PermissionResource;
  action?: PermissionAction;
  disabled?: boolean;
  title?: string;
};

export type ToolbarActionConfig = {
  label: string;
  id?: ToolbarActionId;
  resource: PermissionResource;
  action: PermissionAction;
  primary?: boolean;
  disabled?: boolean;
  title?: string;
};

const UNIMPLEMENTED_TITLE = 'Функція ще не реалізована';

export const roleLabels: Record<UserRole, string> = {
  OWNER: 'Власник',
  AUDITOR: 'Аудитор',
  DPP_ADMIN: 'Адміністратор ДПП',
  MVO: 'Матеріально відповідальна особа',
};

const permissions: Record<
  UserRole,
  Partial<Record<PermissionResource, PermissionAction[]>>
> = {
  OWNER: {
    dashboard: ['read'],
    responsiblePersons: ['read', 'write'],
    organization: ['read', 'write'],
    nomenclature: ['read', 'write'],
    stock: ['read', 'write'],
    imports: ['read', 'write'],
    transactions: ['read'],
    users: ['read', 'write', 'manage', 'resetPassword', 'revokeSessions'],
    mvoUsers: ['read', 'write', 'manage', 'resetPassword', 'revokeSessions'],
    reports: ['read'],
    profile: ['read', 'write'],
    administration: ['read'],
  },
  AUDITOR: {
    dashboard: ['read'],
    responsiblePersons: ['read'],
    organization: ['read'],
    nomenclature: ['read'],
    stock: ['read'],
    imports: ['read'],
    transactions: ['read'],
    reports: ['read'],
    profile: ['read', 'write'],
  },
  DPP_ADMIN: {
    dashboard: ['read'],
    responsiblePersons: ['read', 'write'],
    organization: ['read', 'write'],
    nomenclature: ['read', 'write'],
    stock: ['read', 'write'],
    imports: ['read', 'write'],
    transactions: ['read'],
    mvoUsers: ['read', 'write', 'manage', 'resetPassword', 'revokeSessions'],
    profile: ['read', 'write'],
  },
  MVO: {
    ownCard: ['read'],
    ownStock: ['read'],
    ownTransactions: ['read'],
    ownTransfers: ['read', 'write'],
    profile: ['read', 'write'],
  },
};

const navigationByRole: Record<UserRole, NavigationItem[]> = {
  OWNER: [
    nav('Головна', '/', 'home', 'dashboard'),
    nav('МВО', '/persons', 'persons', 'responsiblePersons'),
    nav('Організаційна структура', '/structure', 'structure', 'organization'),
    nav('Номенклатура', '/nomenclature', 'nomenclature', 'nomenclature'),
    nav('Залишки', '/stock', 'stock', 'stock'),
    nav('Імпорт', '/imports', 'imports', 'imports'),
    nav('Журнал операцій', '/transactions', 'transactions', 'transactions'),
    nav('Користувачі', '/admin/users', 'users', 'users'),
    nav('Адміністрування', '#', 'administration', 'administration', {
      disabled: true,
      title: UNIMPLEMENTED_TITLE,
    }),
  ],
  AUDITOR: [
    nav('Головна', '/', 'home', 'dashboard'),
    nav('МВО', '/persons', 'persons', 'responsiblePersons'),
    nav('Організаційна структура', '/structure', 'structure', 'organization'),
    nav('Номенклатура', '/nomenclature', 'nomenclature', 'nomenclature'),
    nav('Залишки', '/stock', 'stock', 'stock'),
    nav('Імпорт', '/imports', 'imports', 'imports'),
    nav('Журнал операцій', '/transactions', 'transactions', 'transactions'),
    nav('Звіти', '#', 'reports', 'reports', {
      disabled: true,
      title: UNIMPLEMENTED_TITLE,
    }),
  ],
  DPP_ADMIN: [
    nav('Головна', '/', 'home', 'dashboard'),
    nav('МВО', '/persons', 'persons', 'responsiblePersons'),
    nav('Організаційна структура', '/structure', 'structure', 'organization'),
    nav('Номенклатура', '/nomenclature', 'nomenclature', 'nomenclature'),
    nav('Залишки', '/stock', 'stock', 'stock'),
    nav('Імпорт', '/imports', 'imports', 'imports'),
    nav('Журнал операцій', '/transactions', 'transactions', 'transactions'),
    nav('Користувачі МВО', '/mvo-users', 'users', 'mvoUsers'),
  ],
  MVO: [
    nav('Моя картка', '/my-card', 'my-card', 'ownCard'),
    nav('Моє майно', '/my-stock', 'my-stock', 'ownStock'),
    nav('Мої операції', '/my-transactions', 'my-transactions', 'ownTransactions'),
    nav('Передачі', '/transfers', 'transfers', 'ownTransfers'),
    nav('Профіль', '/profile', 'profile', 'profile'),
  ],
};

const toolbarByView: Partial<Record<AppView, ToolbarActionConfig[]>> = {
  home: [
    action('Оновити дані', 'refresh', 'dashboard', 'read', { primary: true }),
  ],
  persons: [
    action('Створити', 'create', 'responsiblePersons', 'write', {
      primary: true,
    }),
    action('Редагувати', undefined, 'responsiblePersons', 'write', {
      disabled: true,
      title: UNIMPLEMENTED_TITLE,
    }),
    action('Оновити', 'refresh', 'responsiblePersons', 'read'),
  ],
  structure: [
    action('Створити управління', 'create-management', 'organization', 'write', {
      primary: true,
    }),
    action('Створити підрозділ', undefined, 'organization', 'write', {
      disabled: true,
      title: UNIMPLEMENTED_TITLE,
    }),
    action('Оновити', 'refresh', 'organization', 'read'),
  ],
  nomenclature: [
    action('Створити', 'create', 'nomenclature', 'write', { primary: true }),
    action('Редагувати', undefined, 'nomenclature', 'write', {
      disabled: true,
      title: UNIMPLEMENTED_TITLE,
    }),
    action('Оновити', 'refresh', 'nomenclature', 'read'),
  ],
  stock: [
    action('Фільтр', 'focus-filter', 'stock', 'read', { primary: true }),
    action('Оновити', 'refresh', 'stock', 'read'),
    action('Експорт', 'export', 'stock', 'read', {
      disabled: true,
      title: UNIMPLEMENTED_TITLE,
    }),
    action('Друк', 'print', 'stock', 'read', {
      disabled: true,
      title: UNIMPLEMENTED_TITLE,
    }),
  ],
  imports: [
    action('Новий імпорт', 'new-import', 'imports', 'write', { primary: true }),
    action('Оновити', 'refresh', 'imports', 'read'),
  ],
  transactions: [
    action('Фільтр', 'focus-filter', 'transactions', 'read', {
      disabled: true,
      title: UNIMPLEMENTED_TITLE,
    }),
    action('Оновити', 'refresh', 'transactions', 'read', { primary: true }),
    action('Експорт', 'export', 'transactions', 'read', {
      disabled: true,
      title: UNIMPLEMENTED_TITLE,
    }),
  ],
  users: [
    action('Створити', 'create', 'users', 'write', { primary: true }),
    action('Оновити', 'refresh', 'users', 'read'),
  ],
  'my-card': [action('Оновити', 'refresh', 'ownCard', 'read', { primary: true })],
  'my-stock': [
    action('Оновити', 'refresh', 'ownStock', 'read', { primary: true }),
  ],
  'my-transactions': [
    action('Оновити', 'refresh', 'ownTransactions', 'read', {
      primary: true,
    }),
  ],
  transfers: [
    action('Оновити', 'refresh', 'ownTransfers', 'read', { primary: true }),
  ],
};

function nav(
  label: string,
  href: string,
  view: AppView,
  resource: PermissionResource,
  options: Pick<NavigationItem, 'disabled' | 'title'> = {},
): NavigationItem {
  return { label, href, view, resource, action: 'read', ...options };
}

function action(
  label: string,
  id: ToolbarActionId | undefined,
  resource: PermissionResource,
  actionName: PermissionAction,
  options: Pick<ToolbarActionConfig, 'primary' | 'disabled' | 'title'> = {},
): ToolbarActionConfig {
  return {
    label,
    id,
    resource,
    action: actionName,
    ...options,
  };
}

export function can(
  user: Pick<AuthUser, 'role'> | null,
  actionName: PermissionAction,
  resource: PermissionResource,
) {
  if (!user) {
    return false;
  }

  return permissions[user.role][resource]?.includes(actionName) ?? false;
}

export function getNavigationItems(user: AuthUser | null) {
  if (!user) {
    return [];
  }

  return navigationByRole[user.role].filter((item) =>
    item.disabled ? true : can(user, item.action ?? 'read', item.resource),
  );
}

export function getDefaultAppPath(user: AuthUser | null) {
  const firstEnabled = getNavigationItems(user).find((item) => !item.disabled);
  return firstEnabled?.href ?? '/profile';
}

export function canAccessView(user: AuthUser | null, view: AppView) {
  return getNavigationItems(user).some(
    (item) => item.view === view && !item.disabled,
  );
}

export function canAccessPath(
  user: AuthUser | null,
  pathname: string,
  view: AppView,
) {
  return getNavigationItems(user).some((item) => {
    if (item.disabled || item.view !== view) {
      return false;
    }

    if (item.href === '/') {
      return pathname === '/';
    }

    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  });
}

export function getViewHref(user: AuthUser | null, view: AppView) {
  return (
    getNavigationItems(user).find((item) => item.view === view && !item.disabled)
      ?.href ?? getDefaultAppPath(user)
  );
}

export function getToolbarActions(user: AuthUser | null, view: AppView) {
  return (toolbarByView[view] ?? []).filter((item) =>
    can(user, item.action, item.resource),
  );
}

export function getUserManagementResource(user: AuthUser | null) {
  return can(user, 'write', 'users') ? 'users' : 'mvoUsers';
}

export function resolveUserFormRole(
  resource: 'users' | 'mvoUsers',
  role: UserRole,
) {
  return resource === 'users' ? role : 'MVO';
}

export function getAssignableUserRoles(
  resource: 'users' | 'mvoUsers',
  currentRole?: UserRole,
) {
  if (resource === 'mvoUsers') {
    return ['MVO'] satisfies UserRole[];
  }

  if (currentRole === 'OWNER') {
    return ['OWNER'] satisfies UserRole[];
  }

  return ['AUDITOR', 'DPP_ADMIN', 'MVO'] satisfies UserRole[];
}

export function requiresResponsiblePerson(role: UserRole) {
  return role === 'MVO';
}
