import { ActionMenu, type ActionMenuItem } from '@/components/ui';
import type { UserSummary } from '@/lib/types';

type UserAction = (user: UserSummary) => void;

export function UserActionsMenu({
  user,
  locked,
  canWrite,
  canResetPassword,
  canResetTwoFactor,
  canRevokeSessions,
  canDelete,
  onEdit,
  onResetPassword,
  onResetTwoFactor,
  onBlock,
  onUnblock,
  onRevokeSessions,
  onDeactivate,
  onActivate,
  onDelete,
}: {
  user: UserSummary;
  locked: boolean;
  canWrite: boolean;
  canResetPassword: boolean;
  canResetTwoFactor: boolean;
  canRevokeSessions: boolean;
  canDelete: boolean;
  onEdit: UserAction;
  onResetPassword: UserAction;
  onResetTwoFactor: UserAction;
  onBlock: UserAction;
  onUnblock: UserAction;
  onRevokeSessions: UserAction;
  onDeactivate: UserAction;
  onActivate: UserAction;
  onDelete: UserAction;
}) {
  const items: ActionMenuItem[] = [
    ...(canWrite
      ? [
          { key: 'edit', label: 'Редагувати', onSelect: () => onEdit(user) },
        ]
      : []),
    ...(canResetPassword
      ? [
          {
            key: 'reset-password',
            label: 'Скинути пароль',
            onSelect: () => onResetPassword(user),
          },
        ]
      : []),
    ...(canResetTwoFactor && user.role !== 'OWNER' && user.twoFactorEnabled
      ? [
          {
            key: 'reset-2fa',
            label: 'Скинути 2FA',
            danger: true,
            onSelect: () => onResetTwoFactor(user),
          },
        ]
      : []),
    ...(canWrite
      ? [
          {
            key: 'toggle-lock',
            label: locked ? 'Розблокувати' : 'Заблокувати',
            onSelect: () => (locked ? onUnblock(user) : onBlock(user)),
          },
        ]
      : []),
    ...(canRevokeSessions
      ? [
          {
            key: 'revoke-sessions',
            label: 'Відкликати сесії',
            onSelect: () => onRevokeSessions(user),
          },
        ]
      : []),
    ...(canWrite
      ? [
          {
            key: 'toggle-active',
            label: user.isActive ? 'Деактивувати' : 'Активувати',
            onSelect: () =>
              user.isActive ? onDeactivate(user) : onActivate(user),
          },
        ]
      : []),
    ...(canDelete
      ? [
          {
            key: 'delete',
            label: 'Видалити',
            danger: true,
            onSelect: () => onDelete(user),
          },
        ]
      : []),
  ];

  return (
    <ActionMenu
      ariaLabel={`Дії для користувача ${user.username}`}
      items={items}
    />
  );
}
