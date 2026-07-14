'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError } from '@/lib/api-client';
import { getDefaultAppPath, useAuth } from '../ui/auth-context';
import { AuthLoadingState } from '../ui/protected-mvo-app';

export default function LoginPage() {
  const router = useRouter();
  const { loading, login, user } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (loading || !user) {
      return;
    }

    router.replace(
      user.mustChangePassword ? '/change-password' : getDefaultAppPath(user),
    );
  }, [loading, router, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('Вкажіть логін і пароль.');
      return;
    }

    setSubmitting(true);
    try {
      const currentUser = await login({ username, password });
      router.replace(
        currentUser.mustChangePassword
          ? '/change-password'
          : getDefaultAppPath(currentUser),
      );
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Не вдалося увійти до системи.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || user) {
    return <AuthLoadingState />;
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--app-background)] px-4 py-8 text-[var(--text-primary)]">
      <section className="app-card w-full max-w-[420px]">
        <div className="border-b border-[var(--border)] bg-[var(--toolbar-background)] px-4 py-3">
          <p className="text-xs font-semibold uppercase text-[var(--primary)]">
            MVO
          </p>
          <h1 className="mt-1 text-lg font-semibold">Вхід до системи</h1>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Система обліку майна матеріально відповідальних осіб
          </p>
        </div>

        <form className="grid gap-4 p-4" onSubmit={handleSubmit}>
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-[var(--text-secondary)]">
              Логін
            </span>
            <input
              autoComplete="username"
              className="input"
              disabled={submitting}
              name="username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-[var(--text-secondary)]">
              Пароль
            </span>
            <input
              autoComplete="current-password"
              className="input"
              disabled={submitting}
              name="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {error ? (
            <div className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </div>
          ) : null}

          <button className="btn btn-primary" disabled={submitting} type="submit">
            {submitting ? 'Вхід...' : 'Увійти'}
          </button>
        </form>
      </section>
    </main>
  );
}
