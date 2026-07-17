'use client';

import { Button, DataTable, StatusBadge } from '@/components/ui';
import { formatDateTime, isUserLocked, responsiblePersonShortName } from '@/components/common';
import { roleLabels } from '@/lib/authz';
import type { ResponsiblePerson, UserSummary } from '@/lib/types';

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
      <div className="flex flex-wrap justify-end gap-1" key="actions">
        {canWrite ? <Button variant="outline" type="button" onClick={() => onEdit(item)}>Редагувати</Button> : null}
        {canResetPassword ? <Button variant="outline" type="button" onClick={() => onResetPassword(item)}>Скинути пароль</Button> : null}
        {canWrite ? <Button variant="outline" type="button" onClick={() => locked ? onUnblock(item) : onBlock(item)}>{locked ? 'Розблокувати' : 'Заблокувати'}</Button> : null}
        {canRevokeSessions ? <Button variant="outline" type="button" onClick={() => onRevokeSessions(item)}>Відкликати сесії</Button> : null}
        {canWrite ? <Button variant="outline" type="button" onClick={() => item.isActive ? onDeactivate(item) : onActivate(item)}>{item.isActive ? 'Деактивувати' : 'Активувати'}</Button> : null}
        {canDelete ? <Button variant="danger" type="button" onClick={() => onDelete(item)}>Видалити</Button> : null}
      </div>,
    ];
  });

  return <DataTable ariaLabel="Користувачі системи" columns={[
    { label: 'Логін' }, { label: 'Роль' }, { label: 'Пов’язаний МВО' }, { label: 'Управління' },
    { label: 'Активність' }, { label: 'Тимчасовий пароль' }, { label: 'Невдалі входи', numeric: true },
    { label: 'Блокування' }, { label: 'Останній вхід' }, { label: 'Дії', actions: true },
  ]} emptyMessage="Користувачів не знайдено." rows={rows} />;
}
