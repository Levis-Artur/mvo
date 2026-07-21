'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/ui/auth-context';
import { PageHeader } from '@/components/layout/page-header';
import { Button, Card, ErrorState, LoadingState, StatusBadge } from '@/components/ui';
import { apiClient } from '@/lib/api-client';
import type { ResponsiblePerson } from '@/lib/types';
import { getErrorMessage, getMvoErrorMessage } from '@/components/common';
import { profilePresentation } from './profile-model';

export function ProfileView() {
  const router = useRouter();
  const { loading, logout, logoutAll, user } = useAuth();
  const [person, setPerson] = useState<ResponsiblePerson | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    else if (!loading && user?.mustChangePassword) router.replace('/change-password');
  }, [loading, router, user]);
  useEffect(() => {
    if (!user?.responsiblePersonId) { setPerson(null); return; }
    setDetailsLoading(true);
    apiClient.responsiblePerson(user.responsiblePersonId).then(setPerson)
      .catch((reason: unknown) => setError(user.role === 'MVO' ? getMvoErrorMessage(reason) : getErrorMessage(reason)))
      .finally(() => setDetailsLoading(false));
  }, [user?.responsiblePersonId, user?.role]);

  if (loading || !user || user.mustChangePassword) return <main className="auth-page"><LoadingState label="Перевірка сесії…" /></main>;
  const profile = profilePresentation(user, person);

  async function endAllSessions() {
    setSubmitting(true); setError('');
    try { await logoutAll(); }
    catch (reason) { setError(getErrorMessage(reason)); setSubmitting(false); }
  }

  return <main className="min-h-screen bg-[var(--color-workspace)]">
    <header className="app-topbar"><div className="app-topbar__inner"><div className="app-brand"><span className="app-brand__badge">МВО</span><strong className="app-brand__title">Облік майна МВО</strong></div><Button variant="ghost" type="button" onClick={() => void logout().catch(() => undefined)}>Вийти</Button></div></header>
    <div className="page-container grid gap-4">
      <PageHeader icon="profile" title="Профіль" description="Облікові дані, організаційна належність і дії безпеки." action={<Button variant="outline" type="button" onClick={() => router.push('/')}>До системи</Button>} />
      {error ? <ErrorState message={error} /> : null}
      <div className="profile-grid">
        {user.role === 'MVO' ? <Card title="Дані матеріально відповідальної особи">{detailsLoading ? <LoadingState label="Завантаження даних МВО…" /> : <div className="grid gap-3"><p className="text-sm text-[var(--color-text-secondary)]">Ці дані доступні лише для перегляду. Для їх зміни зверніться до адміністратора.</p><dl className="detail-list" data-read-only="true"><div><dt>Номер МВО</dt><dd>{profile.personnelNumber}</dd></div><div><dt>ПІБ</dt><dd>{profile.fullName}</dd></div><div><dt>Управління</dt><dd>{profile.management}</dd></div><div><dt>Служба</dt><dd>{profile.service}</dd></div><div><dt>Підрозділ</dt><dd>{profile.unit}</dd></div><div><dt>Стан облікового запису</dt><dd><StatusBadge tone={user.isActive ? 'success' : 'danger'}>{profile.accountState}</StatusBadge></dd></div></dl></div>}</Card> : <>
          <Card title="Обліковий запис"><dl className="detail-list"><div><dt>Логін</dt><dd>{profile.username}</dd></div><div><dt>Роль</dt><dd><StatusBadge tone="info">{profile.role}</StatusBadge></dd></div><div><dt>Стан</dt><dd><StatusBadge tone={user.isActive ? 'success' : 'danger'}>{profile.accountState}</StatusBadge></dd></div><div><dt>Пов’язаний МВО</dt><dd>{profile.responsiblePerson}</dd></div></dl></Card>
          <Card title="Організаційна належність">{detailsLoading ? <LoadingState label="Завантаження даних МВО…" /> : <dl className="detail-list"><div><dt>Управління</dt><dd>{profile.management}</dd></div><div><dt>Служба</dt><dd>{profile.service}</dd></div><div><dt>Підрозділ</dt><dd>{profile.unit}</dd></div></dl>}</Card>
        </>}
        <Card title="Пароль"><p className="mb-4 text-sm text-[var(--color-text-secondary)]">Зміна пароля виконується через захищений маршрут авторизації.</p><Button type="button" onClick={() => router.push('/change-password')}>Змінити пароль</Button></Card>
        <Card title="Активні сесії"><div className="grid gap-4"><p className="text-sm text-[var(--color-text-secondary)]">API не надає список окремих активних сесій. Можна безпечно завершити всі сесії облікового запису.</p><Button disabled={submitting} variant="danger" type="button" onClick={() => void endAllSessions()}>{submitting ? 'Завершення…' : 'Завершити всі сесії'}</Button></div></Card>
      </div>
    </div>
  </main>;
}
