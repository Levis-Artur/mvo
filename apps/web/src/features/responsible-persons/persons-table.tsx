'use client';

import type { ResponsiblePerson, UserSummary } from '@/lib/types';
import { Button, DataTable, StatusBadge } from '@/components/ui';
import { personDisplayName } from './persons-model';

type StockPresence = boolean | undefined;

export function PersonsTable({
  persons,
  loading,
  canEdit,
  canCreateAccount,
  canDelete,
  accounts,
  accountsAvailable,
  stockPresence,
  onView,
  onEdit,
  onCreateAccount,
  onDelete,
  onToggleActive,
}: {
  persons: ResponsiblePerson[];
  loading: boolean;
  canEdit: boolean;
  canCreateAccount: boolean;
  canDelete: boolean;
  accounts: Map<string, UserSummary>;
  accountsAvailable: boolean;
  stockPresence: Record<string, StockPresence>;
  onView: (person: ResponsiblePerson) => void;
  onEdit: (person: ResponsiblePerson) => void;
  onCreateAccount: (person: ResponsiblePerson) => void;
  onDelete: (person: ResponsiblePerson) => void;
  onToggleActive: (person: ResponsiblePerson) => void;
}) {
  return (
    <DataTable
      ariaLabel="Реєстр матеріально відповідальних осіб"
      columns={[
        { label: 'Номер МВО' },
        { label: 'ПІБ' },
        { label: 'Управління' },
        { label: 'Служба' },
        { label: 'Підрозділ' },
        { label: 'Обліковий запис' },
        { label: 'Активність' },
        { label: 'Залишки' },
        { label: 'Дії', actions: true },
      ]}
      emptyMessage="МВО за вказаними фільтрами не знайдено."
      loading={loading}
      rows={persons.map((person) => {
        const account = accounts.get(person.id);
        const hasStock = stockPresence[person.id];

        return [
          <span className="font-mono font-semibold" key="number">
            {person.personnelNumber}
          </span>,
          <button
            className="text-left font-semibold text-[var(--color-primary)] hover:underline"
            key="name"
            type="button"
            onClick={() => onView(person)}
          >
            {personDisplayName(person)}
          </button>,
          person.management.name,
          person.service.name,
          person.unit?.name ?? 'Без підрозділу',
          accountsAvailable ? (
            account ? (
              <StatusBadge key="account" tone="success">
                {account.username}
              </StatusBadge>
            ) : (
              <StatusBadge key="account" tone="warning">
                Немає облікового запису
              </StatusBadge>
            )
          ) : (
            <StatusBadge key="account" tone="neutral">
              Недоступно для ролі
            </StatusBadge>
          ),
          <StatusBadge
            key="active"
            tone={person.isActive ? 'success' : 'neutral'}
          >
            {person.isActive ? 'Активний' : 'Неактивний'}
          </StatusBadge>,
          hasStock === undefined ? (
            <StatusBadge key="stock" tone="info">
              У картці МВО
            </StatusBadge>
          ) : (
            <StatusBadge key="stock" tone={hasStock ? 'warning' : 'neutral'}>
              {hasStock ? 'Має залишки' : 'Залишків немає'}
            </StatusBadge>
          ),
          <div className="flex min-w-48 flex-wrap gap-1" key="actions">
            <Button variant="ghost" type="button" onClick={() => onView(person)}>
              Переглянути
            </Button>
            {canEdit ? (
              <Button variant="ghost" type="button" onClick={() => onEdit(person)}>
                Редагувати
              </Button>
            ) : null}
            {canCreateAccount && accountsAvailable && !account ? (
              <Button
                variant="outline"
                type="button"
                onClick={() => onCreateAccount(person)}
              >
                Створити обліковий запис
              </Button>
            ) : null}
            {canEdit ? (
              <Button
                variant="outline"
                type="button"
                onClick={() => onToggleActive(person)}
              >
                {person.isActive ? 'Деактивувати' : 'Активувати'}
              </Button>
            ) : null}
            {canEdit ? (
              <Button variant="ghost" type="button" onClick={() => onEdit(person)}>
                Перемістити
              </Button>
            ) : null}
            {canDelete ? (
              <Button variant="danger" type="button" onClick={() => onDelete(person)}>
                Видалити
              </Button>
            ) : null}
          </div>,
        ];
      })}
    />
  );
}
