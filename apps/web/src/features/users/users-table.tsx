'use client';

import type { UserSummary } from '@/lib/types';
import { roleLabels } from '@/lib/authz';
import {
  EmptyState,
  StatusBadge,
  StatusPill,
  formatDateTime,
  isUserLocked,
  responsiblePersonShortName,
} from '@/components/common';
export function UsersTable({
  users,
  canWrite,
  canResetPassword,
  canRevokeSessions,
  onEdit,
  onResetPassword,
  onBlock,
  onUnblock,
  onRevokeSessions,
  onDeactivate,
  onActivate,
}: {
  users: UserSummary[];
  canWrite: boolean;
  canResetPassword: boolean;
  canRevokeSessions: boolean;
  onEdit: (user: UserSummary) => void;
  onResetPassword: (user: UserSummary) => void;
  onBlock: (user: UserSummary) => void;
  onUnblock: (user: UserSummary) => void;
  onRevokeSessions: (user: UserSummary) => void;
  onDeactivate: (user: UserSummary) => void;
  onActivate: (user: UserSummary) => void;
}) {
  if (users.length === 0) {
    return <EmptyState message="Користувачів не знайдено." />;
  }

  return (
    <div className="erp-panel overflow-hidden">
      <div className="compact-scrollbar overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              {[
                'Логін',
                'Роль',
                'Статус',
                'ResponsiblePerson',
                'Останній вхід',
                'Дії',
              ].map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((item) => (
              <tr key={item.id}>
                <td className="font-medium">{item.username}</td>
                <td>{roleLabels[item.role]}</td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    <StatusBadge active={item.isActive} />
                    {isUserLocked(item) ? (
                      <StatusPill status="BLOCKED" />
                    ) : null}
                  </div>
                </td>
                <td>
                  {item.responsiblePerson
                    ? responsiblePersonShortName(item.responsiblePerson)
                    : '-'}
                </td>
                <td>{formatDateTime(item.lastLoginAt)}</td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    {canWrite ? (
                      <button
                        className="btn btn-ghost !min-h-0 !w-fit !p-0"
                        type="button"
                        onClick={() => onEdit(item)}
                      >
                        Редагувати
                      </button>
                    ) : null}
                    {canResetPassword ? (
                      <button
                        className="btn btn-ghost !min-h-0 !w-fit !p-0"
                        type="button"
                        onClick={() => onResetPassword(item)}
                      >
                        Reset password
                      </button>
                    ) : null}
                    {canWrite && isUserLocked(item) ? (
                      <button
                        className="btn btn-ghost !min-h-0 !w-fit !p-0"
                        type="button"
                        onClick={() => onUnblock(item)}
                      >
                        Unblock
                      </button>
                    ) : null}
                    {canWrite && !isUserLocked(item) ? (
                      <button
                        className="btn btn-ghost !min-h-0 !w-fit !p-0"
                        type="button"
                        onClick={() => onBlock(item)}
                      >
                        Block
                      </button>
                    ) : null}
                    {canRevokeSessions ? (
                      <button
                        className="btn btn-ghost !min-h-0 !w-fit !p-0"
                        type="button"
                        onClick={() => onRevokeSessions(item)}
                      >
                        Revoke sessions
                      </button>
                    ) : null}
                    {canWrite && item.isActive ? (
                      <button
                        className="btn btn-ghost !min-h-0 !w-fit !p-0"
                        type="button"
                        onClick={() => onDeactivate(item)}
                      >
                        Deactivate
                      </button>
                    ) : null}
                    {canWrite && !item.isActive ? (
                      <button
                        className="btn btn-ghost !min-h-0 !w-fit !p-0"
                        type="button"
                        onClick={() => onActivate(item)}
                      >
                        Activate
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

