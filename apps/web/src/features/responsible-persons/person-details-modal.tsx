'use client';

import { useCallback, useState } from 'react';
import type { ResponsiblePerson, UserSummary } from '@/lib/types';
import { Button, Card, Modal, StatusBadge } from '@/components/ui';
import { personDisplayName } from './persons-model';
import {
  PersonOperationsTab,
  PersonStockTab,
  PersonTransfersTab,
} from './person-stock-tabs';

type DetailsTab =
  | 'main'
  | 'account'
  | 'stock'
  | 'operations'
  | 'transfers'
  | 'admin';

const tabs: { id: DetailsTab; label: string }[] = [
  { id: 'main', label: 'Основні дані' },
  { id: 'account', label: 'Обліковий запис' },
  { id: 'stock', label: 'Залишки' },
  { id: 'operations', label: 'Операції' },
  { id: 'transfers', label: 'Передачі' },
  { id: 'admin', label: 'Адміністративні дії' },
];

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-[var(--color-border-light)] pb-2">
      <dt className="text-xs font-semibold text-[var(--color-text-secondary)]">
        {label}
      </dt>
      <dd>{value || '—'}</dd>
    </div>
  );
}

export function PersonDetailsModal({
  person,
  account,
  accountLookupAvailable,
  canEdit,
  canCreateAccount,
  canDelete,
  onClose,
  onEdit,
  onCreateAccount,
  onToggleActive,
  onDelete,
  onStockPresence,
}: {
  person: ResponsiblePerson;
  account?: UserSummary;
  accountLookupAvailable: boolean;
  canEdit: boolean;
  canCreateAccount: boolean;
  canDelete: boolean;
  onClose: () => void;
  onEdit: () => void;
  onCreateAccount: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  onStockPresence: (personId: string, hasStock: boolean) => void;
}) {
  const [tab, setTab] = useState<DetailsTab>('main');
  const reportStockPresence = useCallback(
    (hasStock: boolean) => onStockPresence(person.id, hasStock),
    [onStockPresence, person.id],
  );

  return (
    <Modal
      footer={
        <Button variant="outline" type="button" onClick={onClose}>
          Закрити
        </Button>
      }
      onClose={onClose}
      size="large"
      title={`Картка МВО: ${personDisplayName(person)}`}
    >
      <div className="grid min-w-0 gap-4">
        <nav aria-label="Розділи картки МВО" className="flex flex-wrap gap-2">
          {tabs.map((item) => (
            <Button
              key={item.id}
              aria-current={tab === item.id ? 'page' : undefined}
              type="button"
              variant={tab === item.id ? 'primary' : 'outline'}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </nav>

        {tab === 'main' ? (
          <div className="grid gap-3 lg:grid-cols-2">
            <Card title="Основні дані">
              <dl className="grid gap-3 sm:grid-cols-2">
                <Detail label="Номер МВО" value={person.personnelNumber} />
                <Detail label="ПІБ" value={personDisplayName(person)} />
                <Detail label="Посада" value={person.position} />
                <Detail label="Телефон" value={person.phone} />
                <Detail label="Email" value={person.email} />
                <Detail
                  label="Активність"
                  value={
                    <StatusBadge tone={person.isActive ? 'success' : 'neutral'}>
                      {person.isActive ? 'Активний' : 'Неактивний'}
                    </StatusBadge>
                  }
                />
              </dl>
            </Card>
            <Card title="Організаційна належність">
              <dl className="grid gap-3">
                <Detail label="Управління" value={person.management.name} />
                <Detail label="Служба" value={person.service.name} />
                <Detail
                  label="Підрозділ"
                  value={person.unit?.name ?? 'Без підрозділу'}
                />
                <Detail
                  label="Наказ про призначення"
                  value={person.appointmentOrderNumber}
                />
                <Detail
                  label="Дата призначення"
                  value={
                    person.appointmentDate
                      ? new Date(person.appointmentDate).toLocaleDateString('uk-UA')
                      : null
                  }
                />
              </dl>
            </Card>
          </div>
        ) : null}

        {tab === 'account' ? (
          <Card title="Обліковий запис">
            {!accountLookupAvailable ? (
              <p>Перегляд облікового запису недоступний для поточної ролі.</p>
            ) : account ? (
              <dl className="grid gap-3 sm:grid-cols-2">
                <Detail label="Логін" value={account.username} />
                <Detail label="Роль" value={account.role} />
                <Detail
                  label="Стан"
                  value={account.isActive ? 'Активний' : 'Неактивний'}
                />
                <Detail
                  label="Останній вхід"
                  value={
                    account.lastLoginAt
                      ? new Date(account.lastLoginAt).toLocaleString('uk-UA')
                      : 'Входів не було'
                  }
                />
              </dl>
            ) : (
              <div className="grid gap-3">
                <p>Для цього МВО обліковий запис не створено.</p>
                {canCreateAccount ? (
                  <Button type="button" onClick={onCreateAccount}>
                    Створити обліковий запис
                  </Button>
                ) : null}
              </div>
            )}
          </Card>
        ) : null}

        {tab === 'stock' ? (
          <PersonStockTab
            personId={person.id}
            onPresenceResolved={reportStockPresence}
          />
        ) : null}
        {tab === 'operations' ? <PersonOperationsTab personId={person.id} /> : null}
        {tab === 'transfers' ? <PersonTransfersTab personId={person.id} /> : null}

        {tab === 'admin' ? (
          <Card title="Адміністративні дії">
            {canEdit || canDelete ? (
              <div className="flex flex-wrap gap-2">
                {canEdit ? (
                  <>
                    <Button type="button" onClick={onEdit}>
                      Редагувати
                    </Button>
                    <Button variant="outline" type="button" onClick={onToggleActive}>
                      {person.isActive ? 'Деактивувати' : 'Активувати'}
                    </Button>
                    <Button variant="outline" type="button" onClick={onEdit}>
                      Змінити управління
                    </Button>
                    <Button variant="outline" type="button" onClick={onEdit}>
                      Змінити службу
                    </Button>
                    <Button variant="outline" type="button" onClick={onEdit}>
                      Змінити підрозділ
                    </Button>
                  </>
                ) : null}
                {canDelete ? (
                  <Button variant="danger" type="button" onClick={onDelete}>
                    Видалити
                  </Button>
                ) : null}
              </div>
            ) : (
              <p>Для поточної ролі доступний лише перегляд.</p>
            )}
          </Card>
        ) : null}
      </div>
    </Modal>
  );
}
