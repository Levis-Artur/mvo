import { ActionMenu, type ActionMenuItem } from '@/components/ui';
import type { ResponsiblePerson } from '@/lib/types';
import { personDisplayName } from './persons-model';

export function PersonActionsMenu({
  person,
  canEdit,
  canCreateAccount,
  canDelete,
  onView,
  onEdit,
  onCreateAccount,
  onDelete,
  onToggleActive,
}: {
  person: ResponsiblePerson;
  canEdit: boolean;
  canCreateAccount: boolean;
  canDelete: boolean;
  onView: () => void;
  onEdit: () => void;
  onCreateAccount: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
}) {
  const items: ActionMenuItem[] = [
    { key: 'view', label: 'Переглянути', onSelect: onView },
    ...(canEdit
      ? [{ key: 'edit', label: 'Редагувати', onSelect: onEdit }]
      : []),
    ...(canCreateAccount
      ? [
          {
            key: 'create-account',
            label: 'Створити обліковий запис',
            onSelect: onCreateAccount,
          },
        ]
      : []),
    ...(canEdit
      ? [
          {
            key: 'toggle-active',
            label: person.isActive ? 'Деактивувати' : 'Активувати',
            onSelect: onToggleActive,
          },
          { key: 'move', label: 'Перемістити', onSelect: onEdit },
        ]
      : []),
    ...(canDelete
      ? [
          {
            key: 'delete',
            label: 'Видалити',
            danger: true,
            onSelect: onDelete,
          },
        ]
      : []),
  ];

  return (
    <ActionMenu
      ariaLabel={`Дії для МВО ${personDisplayName(person)}`}
      items={items}
    />
  );
}
