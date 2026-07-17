'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthPageShell } from '@/components/auth/auth-page-shell';
import { Button, ErrorState, FormField, Input, LoadingState } from '@/components/ui';
import {
  authErrorMessage,
  loginDestination,
  loginValidationMessage,
} from '@/features/auth/auth-form-model';
import { getDefaultAppPath, useAuth } from '../ui/auth-context';

export default function LoginPage() {
  const router = useRouter();
  const { loading, login, user } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && user) {
      router.replace(loginDestination(user) ?? getDefaultAppPath(user));
    }
  }, [loading, router, user]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = loginValidationMessage(username, password);
    setError(validationError);
    if (validationError) return;

    setSubmitting(true);
    try {
      const currentUser = await login({ username: username.trim(), password });
      router.replace(loginDestination(currentUser) ?? getDefaultAppPath(currentUser));
    } catch (reason) {
      setError(authErrorMessage(reason, 'Не вдалося увійти до системи. Спробуйте ще раз.'));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || user) {
    return <AuthPageShell title="Перевірка сесії" description="Зачекайте, будь ласка."><LoadingState label="Перевірка сесії…" /></AuthPageShell>;
  }

  return (
    <AuthPageShell title="Вхід до системи" description="Введіть облікові дані, надані адміністратором.">
      <form className="grid gap-4" onSubmit={submit}>
        <FormField label="Логін" required>
          <Input autoComplete="username" autoFocus disabled={submitting} name="username" value={username} onChange={(event) => setUsername(event.target.value)} />
        </FormField>
        <FormField label="Пароль" required>
          <Input autoComplete="current-password" disabled={submitting} name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </FormField>
        {error ? <ErrorState message={error} /> : null}
        <Button disabled={submitting} type="submit">{submitting ? 'Вхід…' : 'Увійти'}</Button>
      </form>
    </AuthPageShell>
  );
}
