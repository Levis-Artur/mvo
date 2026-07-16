'use client';



import { useEffect, useState } from 'react';

import { responsiblePersonsService as apiClient } from './responsible-persons.service';

import { useAuth } from '@/app/ui/auth-context';

import type { ResponsiblePerson } from '@/lib/types';

import { ErrorMessage, InfoRow, LoadingMessage, PageHeader, PlaceholderView, fullName, getErrorMessage } from '@/components/common';

import { PersonOperationsTab, PersonStockTab } from './person-stock-tabs';

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

        title="Моя картка"

        description="Персональна картка матеріально відповідальної особи."

      />

      {loading ? <LoadingMessage /> : null}

      {error ? <ErrorMessage message={error} /> : null}

      {person ? (

        <div className="erp-panel p-4">

          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">

            <InfoRow label="ПІП" value={fullName(person)} />

            <InfoRow label="Табельний номер" value={person.personnelNumber} />

            <InfoRow label="Посада" value={person.position ?? '-'} />

            <InfoRow label="Управління" value={person.management.name} />

            <InfoRow label="Служба" value={person.service.name} />

            <InfoRow label="Підрозділ" value={person.unit?.name ?? '-'} />

            <InfoRow label="Телефон" value={person.phone ?? '-'} />

            <InfoRow label="Email" value={person.email ?? '-'} />

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



export function MyStockView() {

  const { user } = useAuth();



  if (!user?.responsiblePersonId) {

    return (

      <PlaceholderView

        title="Моє майно"

        description="До користувача не прив’язано картку МВО."

      />

    );

  }



  return (

    <section className="grid gap-3">

      <PageHeader

        title="Моє майно"

        description="Власні залишки майна за прив’язаною карткою МВО."

      />

      <PersonStockTab personId={user.responsiblePersonId} />

    </section>

  );

}



export function MyTransactionsView() {

  const { user } = useAuth();



  if (!user?.responsiblePersonId) {

    return (

      <PlaceholderView

        title="Мої операції"

        description="До користувача не прив’язано картку МВО."

      />

    );

  }



  return (

    <section className="grid gap-3">

      <PageHeader

        title="Мої операції"

        description="Операції, у яких поточна МВО є стороною."

      />

      <PersonOperationsTab personId={user.responsiblePersonId} />

    </section>

  );

}



export function MyTransfersView() {

  return (

    <PlaceholderView

      title="Передачі"

      description="Окремий endpoint для власних передач ще не реалізований у backend."

    />

  );

}




