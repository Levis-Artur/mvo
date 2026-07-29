'use client';

import type { ResponsiblePerson, UserSummary } from '@/lib/types';
import { Button, DataTable, StatusBadge } from '@/components/ui';
import { personDisplayName } from './persons-model';
import { personAccountingCode } from './persons-model';
import { PersonActionsMenu } from './person-actions-menu';

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
        { label: 'Код МВО', className: 'persons-table__code' },
        { label: 'ПІБ' },
        { label: 'Управління' },
        { label: 'Служба' },
        { label: 'Підрозділ' },
        { label: 'Обліковий запис' },
        { label: 'Активність' },
        { label: 'Залишки' },
        { label: 'Дії', actions: true, className: 'persons-table__actions' },
      ]}
      emptyMessage="МВО за вказаними фільтрами не знайдено."
      loading={loading}
      tableClassName="persons-table"
      rowKeys={persons.map((person) => person.id)}
      rows={persons.map((person) => {
        const account = accounts.get(person.id);
        const hasStock = stockPresence[person.id];

        return [
          <span className="font-mono font-semibold" key="code">
            {personAccountingCode(person)}
          </span>,
          <Button
            variant="link"
            key="name"
            type="button"
            onClick={() => onView(person)}
          >
            {personDisplayName(person)}
          </Button>,
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
          <PersonActionsMenu
            canCreateAccount={canCreateAccount && accountsAvailable && !account}
            canDelete={canDelete}
            canEdit={canEdit}
            key="actions"
            person={person}
            onCreateAccount={() => onCreateAccount(person)}
            onDelete={() => onDelete(person)}
            onEdit={() => onEdit(person)}
            onToggleActive={() => onToggleActive(person)}
            onView={() => onView(person)}
          />,
        ];
      })}
    />
  );
}
