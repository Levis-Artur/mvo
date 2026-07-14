'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError } from '@/lib/api-client';
import { roleLabels, useAuth } from '../ui/auth-context';
import { AuthLoadingState } from '../ui/protected-mvo-app';

function formatDateTime(value?: string | null) {
  if (!value) {
    return 'Немає даних';
  }

  return new Intl.DateTimeFormat('uk-UA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function ProfilePage() {
  const router = useRouter();
  const { loading, logout, logoutAll, user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (loading || user) {
      return;
    }

    router.replace('/login');
  }, [loading, router, user]);

  async function handleLogoutAll() {
    setSubmitting(true);
    setError('');

    try {
      await logoutAll();
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Не вдалося завершити сесії.',
      );
      setSubmitting(false);
    }
  }

  if (loading || !user) {
    return <AuthLoadingState />;
  }

  return (
    <main className="min-h-screen bg-[var(--workspace-background)] text-[var(--text-primary)]">
      <header className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="flex h-10 items-center justify-between gap-3 px-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="grid h-6 w-8 place-items-center rounded border border-[var(--border)] bg-[var(--toolbar-background)] text-[11px] font-semibold text-[var(--primary)]">
              MVO
            </div>
            <p className="truncate text-sm font-semibold">
              Профіль користувача
            </p>
          </div>
          <button
            className="btn btn-outline !min-h-7 !w-auto"
            type="button"
            onClick={() => {
              void logout();
            }}
          >
            Вийти
          </button>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-3xl gap-3 p-3 sm:p-4">
        <section className="erp-panel">
          <div className="border-b border-[var(--border)] bg-[var(--toolbar-background)] px-4 py-3">
            <h1 className="text-lg font-semibold">Профіль</h1>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Дані поточної сесії та дії безпеки.
            </p>
          </div>

          <dl className="grid gap-0 p-4 sm:grid-cols-[190px_1fr]">
            <dt className="border-b border-[var(--border-light)] py-2 text-xs font-medium text-[var(--text-secondary)]">
              Логін
            </dt>
            <dd className="border-b border-[var(--border-light)] py-2 text-sm">
              {user.username}
            </dd>

            <dt className="border-b border-[var(--border-light)] py-2 text-xs font-medium text-[var(--text-secondary)]">
              Роль
            </dt>
            <dd className="border-b border-[var(--border-light)] py-2 text-sm">
              {roleLabels[user.role]}
            </dd>

            <dt className="border-b border-[var(--border-light)] py-2 text-xs font-medium text-[var(--text-secondary)]">
              Статус
            </dt>
            <dd className="border-b border-[var(--border-light)] py-2 text-sm">
              {user.isActive ? 'Активний' : 'Неактивний'}
            </dd>

            <dt className="border-b border-[var(--border-light)] py-2 text-xs font-medium text-[var(--text-secondary)]">
              Останній вхід
            </dt>
            <dd className="border-b border-[var(--border-light)] py-2 text-sm">
              {formatDateTime(user.lastLoginAt)}
            </dd>
          </dl>
        </section>

        {error ? (
          <div className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">
            {error}
          </div>
        ) : null}

        <section className="erp-toolbar flex flex-col gap-2 p-2 sm:flex-row">
          <button
            className="btn btn-primary !w-auto"
            type="button"
            onClick={() => router.push('/change-password')}
          >
            Змінити пароль
          </button>
          <button
            className="btn btn-outline !w-auto"
            disabled={submitting}
            type="button"
            onClick={() => {
              void handleLogoutAll();
            }}
          >
            {submitting ? 'Завершення...' : 'Завершити всі сесії'}
          </button>
          <button
            className="btn btn-outline !w-auto"
            type="button"
            onClick={() => router.push('/')}
          >
            Повернутися до системи
          </button>
        </section>
      </div>
    </main>
  );
}
