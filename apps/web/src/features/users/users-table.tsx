import { DataTable, StatusBadge } from '@/components/ui';
import { formatDateTime, isUserLocked, responsiblePersonShortName } from '@/components/common';
import { roleLabels } from '@/lib/authz';
import type { ResponsiblePerson, UserSummary } from '@/lib/types';
import { UserActionsMenu } from './user-actions-menu';

type UserAction = (user: UserSummary) => void;

export function UsersTable({ users, personsById, canWrite, canResetPassword, canRevokeSessions, canDelete, onEdit, onResetPassword, onBlock, onUnblock, onRevokeSessions, onDeactivate, onActivate, onDelete }: {
  users: UserSummary[];
  personsById: Map<string, ResponsiblePerson>;
  canWrite: boolean;
  canResetPassword: boolean;
  canRevokeSessions: boolean;
  canDelete: boolean;
  onEdit: UserAction;
  onResetPassword: UserAction;
  onBlock: UserAction;
  onUnblock: UserAction;
  onRevokeSessions: UserAction;
  onDeactivate: UserAction;
  onActivate: UserAction;
  onDelete: UserAction;
}) {
  const rows = users.map((item) => {
    const person = item.responsiblePersonId ? personsById.get(item.responsiblePersonId) : undefined;
    const locked = isUserLocked(item);
    return [
      <strong key="username">{item.username}</strong>,
      roleLabels[item.role],
      item.responsiblePerson ? responsiblePersonShortName(item.responsiblePerson) : 'Не прив’язано',
      person?.management.name ?? '—',
      <StatusBadge key="active" tone={item.isActive ? 'success' : 'neutral'}>{item.isActive ? 'Активний' : 'Неактивний'}</StatusBadge>,
      <StatusBadge key="password" tone={item.mustChangePassword ? 'warning' : 'success'}>{item.mustChangePassword ? 'Потрібна зміна' : 'Актуальний'}</StatusBadge>,
      <span className="tabular-nums" key="attempts">{item.failedLoginAttempts}</span>,
      locked ? <StatusBadge key="locked" tone="danger">До {formatDateTime(item.lockedUntil)}</StatusBadge> : 'Не заблоковано',
      formatDateTime(item.lastLoginAt),
      <UserActionsMenu
        canDelete={canDelete}
        canResetPassword={canResetPassword}
        canRevokeSessions={canRevokeSessions}
        canWrite={canWrite}
        key="actions"
        locked={locked}
        user={item}
        onActivate={onActivate}
        onBlock={onBlock}
        onDeactivate={onDeactivate}
        onDelete={onDelete}
        onEdit={onEdit}
        onResetPassword={onResetPassword}
        onRevokeSessions={onRevokeSessions}
        onUnblock={onUnblock}
      />,
    ];
  });

  return <DataTable ariaLabel="Користувачі системи" columns={[
    { label: 'Логін' }, { label: 'Роль' }, { label: 'Пов’язаний МВО', className: 'users-table__person' }, { label: 'Управління', className: 'users-table__management' },
    { label: 'Активність' }, { label: 'Тимчасовий пароль' }, { label: 'Невдалі входи', numeric: true },
    { label: 'Блокування' }, { label: 'Останній вхід' }, { label: 'Дії', actions: true, className: 'users-table__actions' },
  ]} emptyMessage="Користувачів не знайдено." responsiveMode="cards-wide" rowKeys={users.map((item) => item.id)} rows={rows} scrollMode="horizontal" tableClassName="users-table" />;
}
