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

      setError('Р”Рѕ РєРѕСЂРёСЃС‚СѓРІР°С‡Р° РЅРµ РїСЂРёРІвЂ™СЏР·Р°РЅРѕ РєР°СЂС‚РєСѓ РњР’Рћ.');

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

        title="РњРѕСЏ РєР°СЂС‚РєР°"

        description="РџРµСЂСЃРѕРЅР°Р»СЊРЅР° РєР°СЂС‚РєР° РјР°С‚РµСЂС–Р°Р»СЊРЅРѕ РІС–РґРїРѕРІС–РґР°Р»СЊРЅРѕС— РѕСЃРѕР±Рё."

      />

      {loading ? <LoadingMessage /> : null}

      {error ? <ErrorMessage message={error} /> : null}

      {person ? (

        <div className="erp-panel p-4">

          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">

            <InfoRow label="РџР†Рџ" value={fullName(person)} />

            <InfoRow label="РўР°Р±РµР»СЊРЅРёР№ РЅРѕРјРµСЂ" value={person.personnelNumber} />

            <InfoRow label="РџРѕСЃР°РґР°" value={person.position ?? '-'} />

            <InfoRow label="РЈРїСЂР°РІР»С–РЅРЅСЏ" value={person.management.name} />

            <InfoRow label="РЎР»СѓР¶Р±Р°" value={person.service.name} />

            <InfoRow label="РџС–РґСЂРѕР·РґС–Р»" value={person.unit?.name ?? '-'} />

            <InfoRow label="РўРµР»РµС„РѕРЅ" value={person.phone ?? '-'} />

            <InfoRow label="Email" value={person.email ?? '-'} />

            <InfoRow

              label="РЎС‚Р°С‚СѓСЃ"

              value={person.isActive ? 'РђРєС‚РёРІРЅРёР№' : 'РќРµР°РєС‚РёРІРЅРёР№'}

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

        title="РњРѕС” РјР°Р№РЅРѕ"

        description="Р”Рѕ РєРѕСЂРёСЃС‚СѓРІР°С‡Р° РЅРµ РїСЂРёРІвЂ™СЏР·Р°РЅРѕ РєР°СЂС‚РєСѓ РњР’Рћ."

      />

    );

  }



  return (

    <section className="grid gap-3">

      <PageHeader

        title="РњРѕС” РјР°Р№РЅРѕ"

        description="Р’Р»Р°СЃРЅС– Р·Р°Р»РёС€РєРё РјР°Р№РЅР° Р·Р° РїСЂРёРІвЂ™СЏР·Р°РЅРѕСЋ РєР°СЂС‚РєРѕСЋ РњР’Рћ."

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

        title="РњРѕС— РѕРїРµСЂР°С†С–С—"

        description="Р”Рѕ РєРѕСЂРёСЃС‚СѓРІР°С‡Р° РЅРµ РїСЂРёРІвЂ™СЏР·Р°РЅРѕ РєР°СЂС‚РєСѓ РњР’Рћ."

      />

    );

  }



  return (

    <section className="grid gap-3">

      <PageHeader

        title="РњРѕС— РѕРїРµСЂР°С†С–С—"

        description="РћРїРµСЂР°С†С–С—, Сѓ СЏРєРёС… РїРѕС‚РѕС‡РЅР° РњР’Рћ С” СЃС‚РѕСЂРѕРЅРѕСЋ."

      />

      <PersonOperationsTab personId={user.responsiblePersonId} />

    </section>

  );

}



export function MyTransfersView() {

  return (

    <PlaceholderView

      title="РџРµСЂРµРґР°С‡С–"

      description="РћРєСЂРµРјРёР№ endpoint РґР»СЏ РІР»Р°СЃРЅРёС… РїРµСЂРµРґР°С‡ С‰Рµ РЅРµ СЂРµР°Р»С–Р·РѕРІР°РЅРёР№ Сѓ backend."

    />

  );

}




