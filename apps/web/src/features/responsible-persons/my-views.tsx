'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/app/ui/auth-context';
import { PageHeader } from '@/components/layout/page-header';
import { Button, Card, ErrorState, LoadingState, StatusBadge } from '@/components/ui';
import { fullName, getErrorMessage, PlaceholderView } from '@/components/common';
import type { ResponsiblePerson } from '@/lib/types';
import { PersonOperationsTab } from './person-stock-tabs';
import { responsiblePersonsService as apiClient } from './responsible-persons.service';

export { MyStockView } from './my-stock-view';

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt>{label}</dt><dd>{children}</dd></div>;
}

export function MyCardView() {
  const { user } = useAuth();
  const [person, setPerson] = useState<ResponsiblePerson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user?.responsiblePersonId) {
      setPerson(null);
      setError('До користувача не прив’язано картку МВО.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try { setPerson(await apiClient.responsiblePerson(user.responsiblePersonId)); }
    catch (reason) { setError(getErrorMessage(reason)); }
    finally { setLoading(false); }
  }, [user?.responsiblePersonId]);

  useEffect(() => { void load(); }, [load]);

  return <section className="grid min-w-0 gap-4">
    <PageHeader icon="profile" title="Моя картка" description="Персональна картка матеріально відповідальної особи." action={<Button disabled={loading} icon="refresh" variant="outline" type="button" onClick={() => void load()}>Оновити</Button>} />
    {loading ? <LoadingState label="Завантаження картки МВО…" /> : null}
    {error ? <ErrorState message={error} /> : null}
    {person ? <Card title="Основні дані"><dl className="detail-list"><Detail label="ПІБ">{fullName(person)}</Detail><Detail label="Табельний номер">{person.personnelNumber}</Detail><Detail label="Посада">{person.position ?? '—'}</Detail><Detail label="Управління">{person.management.name}</Detail><Detail label="Служба">{person.service.name}</Detail><Detail label="Підрозділ">{person.unit?.name ?? '—'}</Detail><Detail label="Телефон">{person.phone ?? '—'}</Detail><Detail label="Email">{person.email ?? '—'}</Detail><Detail label="Статус"><StatusBadge tone={person.isActive ? 'success' : 'neutral'}>{person.isActive ? 'Активний' : 'Неактивний'}</StatusBadge></Detail></dl></Card> : null}
  </section>;
}

export function MyTransactionsView() {
  const { user } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  if (!user?.responsiblePersonId) return <PlaceholderView description="До користувача не прив’язано картку МВО." title="Мої операції" />;
  return <section className="grid min-w-0 gap-4"><PageHeader icon="journal" title="Мої операції" description="Операції, у яких поточна МВО є стороною." action={<Button icon="refresh" variant="outline" type="button" onClick={() => setRefreshKey((value) => value + 1)}>Оновити</Button>} /><PersonOperationsTab key={refreshKey} personId={user.responsiblePersonId} /></section>;
}
