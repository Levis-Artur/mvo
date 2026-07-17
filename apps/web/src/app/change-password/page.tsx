'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthPageShell } from '@/components/auth/auth-page-shell';
import { Button, ErrorState, FormField, Input, LoadingState } from '@/components/ui';
import {
  authErrorMessage,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordValidationMessage,
} from '@/features/auth/auth-form-model';
import { getDefaultAppPath, useAuth } from '../ui/auth-context';

export default function ChangePasswordPage() {
  const router = useRouter();
  const { changePassword, loading, user } = useAuth();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, router, user]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = passwordValidationMessage(oldPassword, newPassword, confirmation);
    setError(validationError);
    setSuccess('');
    if (validationError) return;

    setSubmitting(true);
    try {
      const currentUser = await changePassword({ oldPassword, newPassword });
      setSuccess('Пароль успішно змінено.');
      router.replace(currentUser.mustChangePassword ? '/change-password' : getDefaultAppPath(currentUser));
    } catch (reason) {
      setError(authErrorMessage(reason, 'Не вдалося змінити пароль. Спробуйте ще раз.'));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) {
    return <AuthPageShell title="Перевірка сесії" description="Зачекайте, будь ласка."><LoadingState label="Перевірка сесії…" /></AuthPageShell>;
  }

  return (
    <AuthPageShell
      title={user.mustChangePassword ? 'Обов’язкова зміна пароля' : 'Зміна пароля'}
      description={user.mustChangePassword ? 'Змініть тимчасовий пароль, щоб продовжити роботу в системі.' : 'Вкажіть поточний пароль і створіть новий.'}
    >
      <form className="grid gap-4" onSubmit={submit}>
        <p className="text-sm text-[var(--color-text-secondary)]">Користувач: <strong>{user.username}</strong></p>
        <FormField label="Поточний пароль" required><Input autoComplete="current-password" disabled={submitting} type="password" value={oldPassword} onChange={(event) => setOldPassword(event.target.value)} /></FormField>
        <FormField label="Новий пароль" hint={`Від ${PASSWORD_MIN_LENGTH} до ${PASSWORD_MAX_LENGTH} символів.`} required><Input autoComplete="new-password" disabled={submitting} minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></FormField>
        <FormField label="Підтвердження" required><Input autoComplete="new-password" disabled={submitting} minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></FormField>
        {error ? <ErrorState message={error} /> : null}
        {success ? <div className="ui-alert" data-tone="success" role="status">{success}</div> : null}
        <Button disabled={submitting} type="submit">{submitting ? 'Збереження…' : 'Змінити пароль'}</Button>
        {!user.mustChangePassword ? <Button variant="outline" type="button" onClick={() => router.push(getDefaultAppPath(user))}>Повернутися до системи</Button> : null}
      </form>
    </AuthPageShell>
  );
}
