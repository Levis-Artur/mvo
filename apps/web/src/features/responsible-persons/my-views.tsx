'use client';

import { useEffect, useState } from 'react';
import { responsiblePersonsService as apiClient } from './responsible-persons.service';
import { useAuth } from '@/app/ui/auth-context';
import type { ResponsiblePerson } from '@/lib/types';
import {
  ErrorMessage,
  InfoRow,
  LoadingMessage,
  PageHeader,
  PlaceholderView,
  fullName,
  getErrorMessage,
} from '@/components/common';
import { PersonOperationsTab } from './person-stock-tabs';

export { MyStockView } from './my-stock-view';

export function MyCardView() {
  const { user } = useAuth();
  const [person, setPerson] = useState<ResponsiblePerson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.responsiblePersonId) {
      setLoading(false);
      setError('До користувача не прив’язано картку МВО.');
      return;
    }
    setLoading(true);
    apiClient
      .responsiblePerson(user.responsiblePersonId)
      .then(setPerson)
      .catch((reason: unknown) => setError(getErrorMessage(reason)))
      .finally(() => setLoading(false));
  }, [user?.responsiblePersonId]);

  return (
    <section className="grid gap-3">
      <PageHeader
        description="Персональна картка матеріально відповідальної особи."
        title="Моя картка"
      />
      {loading ? <LoadingMessage /> : null}
      {error ? <ErrorMessage message={error} /> : null}
      {person ? (
        <div className="erp-panel p-4">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <InfoRow label="ПІБ" value={fullName(person)} />
            <InfoRow label="Табельний номер" value={person.personnelNumber} />
            <InfoRow label="Посада" value={person.position ?? '—'} />
            <InfoRow label="Управління" value={person.management.name} />
            <InfoRow label="Служба" value={person.service.name} />
            <InfoRow label="Підрозділ" value={person.unit?.name ?? '—'} />
            <InfoRow label="Телефон" value={person.phone ?? '—'} />
            <InfoRow label="Email" value={person.email ?? '—'} />
            <InfoRow
              label="Статус"
              value={person.isActive ? 'Активний' : 'Неактивний'}
            />
          </dl>
        </div>
      ) : null}
    </section>
  );
}

export function MyTransactionsView() {
  const { user } = useAuth();
  if (!user?.responsiblePersonId) {
    return (
      <PlaceholderView
        description="До користувача не прив’язано картку МВО."
        title="Мої операції"
      />
    );
  }
  return (
    <section className="grid gap-3">
      <PageHeader
        description="Операції, у яких поточна МВО є стороною."
        title="Мої операції"
      />
      <PersonOperationsTab personId={user.responsiblePersonId} />
    </section>
  );
}
