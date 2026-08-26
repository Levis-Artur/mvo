'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import qrcode from 'qrcode-generator';
import { AuthPageShell } from '@/components/auth/auth-page-shell';
import { Button, ErrorState, FormField, Input, LoadingState } from '@/components/ui';
import {
  authErrorMessage,
  loginValidationMessage,
  newPasswordValidationMessage,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  recoveryCodeValidationMessage,
  twoFactorTokenValidationMessage,
} from '@/features/auth/auth-form-model';
import { apiClient } from '@/lib/api-client';
import { copyToClipboard } from '@/lib/copy-to-clipboard';
import type {
  PreAuthStage,
  PreAuthUser,
  TwoFactorEnrollment,
} from '@/lib/types';
import { getDefaultAppPath, useAuth } from '../ui/auth-context';

type FlowStage = 'LOGIN' | PreAuthStage | 'RECOVERY_CODES';
type VerifyMode = 'TOTP' | 'RECOVERY';

export default function LoginPage() {
  const router = useRouter();
  const { loading, login, refresh, user } = useAuth();
  const [stage, setStage] = useState<FlowStage>('LOGIN');
  const [preAuthToken, setPreAuthToken] = useState('');
  const [preAuthUser, setPreAuthUser] = useState<PreAuthUser | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [totpToken, setTotpToken] = useState('');
  const [verifyMode, setVerifyMode] = useState<VerifyMode>('TOTP');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [enrollment, setEnrollment] = useState<TwoFactorEnrollment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [copyStatus, setCopyStatus] = useState('');

  useEffect(() => {
    if (!loading && user) {
      router.replace(getDefaultAppPath(user));
    }
  }, [loading, router, user]);

  function resetFlow() {
    setStage('LOGIN');
    setPreAuthToken('');
    setPreAuthUser(null);
    setPassword('');
    setNewPassword('');
    setConfirmation('');
    setTotpToken('');
    setRecoveryCode('');
    setRecoveryCodes([]);
    setEnrollment(null);
    setVerifyMode('TOTP');
    setError('');
    setCopyStatus('');
  }

  async function loadEnrollment(token: string) {
    setEnrollment(null);
    const result = await apiClient.beginTwoFactorEnrollment(token);
    setEnrollment(result);
  }

  async function moveToStage(nextStage: Exclude<PreAuthStage, 'CHANGE_PASSWORD'>, token: string) {
    setError('');
    setStage(nextStage);
    setPreAuthToken(token);
    setTotpToken('');
    setRecoveryCode('');
    setVerifyMode('TOTP');
    if (nextStage === 'ENROLL_2FA') {
      try {
        await loadEnrollment(token);
      } catch (reason) {
        setError(authErrorMessage(reason, 'Не вдалося створити ключ 2FA. Спробуйте ще раз.'));
      }
    }
  }

  async function finishAuthentication() {
    const currentUser = await refresh();
    if (!currentUser) {
      throw new Error('Authenticated session was not available after 2FA.');
    }
    router.replace(getDefaultAppPath(currentUser));
  }

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = loginValidationMessage(username, password);
    setError(validationError);
    if (validationError) return;

    setSubmitting(true);
    try {
      const result = await login({ username: username.trim(), password });
      setPreAuthUser(result.user);
      setPreAuthToken(result.preAuthToken);
      setPassword('');
      if (result.stage === 'CHANGE_PASSWORD') {
        setStage('CHANGE_PASSWORD');
      } else {
        await moveToStage(result.stage, result.preAuthToken);
      }
    } catch (reason) {
      setError(authErrorMessage(reason, 'Не вдалося увійти до системи. Спробуйте ще раз.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitPasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = newPasswordValidationMessage(newPassword, confirmation);
    setError(validationError);
    if (validationError) return;

    setSubmitting(true);
    try {
      const result = await apiClient.changePasswordPreAuth({
        preAuthToken,
        newPassword,
      });
      setNewPassword('');
      setConfirmation('');
      await moveToStage(result.stage, result.preAuthToken);
    } catch (reason) {
      setError(authErrorMessage(reason, 'Не вдалося змінити пароль. Спробуйте ще раз.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = twoFactorTokenValidationMessage(totpToken);
    setError(validationError);
    if (validationError) return;

    setSubmitting(true);
    try {
      const result = await apiClient.confirmTwoFactorEnrollment({
        preAuthToken,
        token: totpToken,
      });
      setTotpToken('');
      setEnrollment(null);
      setPreAuthToken('');
      setRecoveryCodes(result.recoveryCodes);
      setStage('RECOVERY_CODES');
    } catch (reason) {
      setError(authErrorMessage(reason, 'Не вдалося підтвердити 2FA. Перевірте код.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = verifyMode === 'TOTP'
      ? twoFactorTokenValidationMessage(totpToken)
      : recoveryCodeValidationMessage(recoveryCode);
    setError(validationError);
    if (validationError) return;

    setSubmitting(true);
    try {
      if (verifyMode === 'TOTP') {
        await apiClient.verifyTwoFactor({ preAuthToken, token: totpToken });
      } else {
        await apiClient.verifyTwoFactorRecovery({ preAuthToken, recoveryCode });
      }
      setPreAuthToken('');
      setTotpToken('');
      setRecoveryCode('');
      await finishAuthentication();
    } catch (reason) {
      setError(authErrorMessage(reason, 'Не вдалося підтвердити вхід. Спробуйте ще раз.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function copyRecoveryCodes() {
    const copied = await copyToClipboard(recoveryCodes.join('\n'));
    setCopyStatus(copied ? 'Резервні коди скопійовано.' : 'Не вдалося скопіювати коди. Скопіюйте їх вручну.');
  }

  async function continueAfterRecoveryCodes() {
    setSubmitting(true);
    setError('');
    try {
      await finishAuthentication();
    } catch (reason) {
      setError(authErrorMessage(reason, 'Не вдалося відкрити систему. Увійдіть повторно.'));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || user) {
    return (
      <AuthPageShell title="Перевірка сесії" description="Зачекайте, будь ласка.">
        <LoadingState label="Перевірка сесії…" />
      </AuthPageShell>
    );
  }

  if (stage === 'LOGIN') {
    return (
      <AuthPageShell title="Вхід до системи" description="Введіть облікові дані, надані адміністратором.">
        <form className="grid gap-4" onSubmit={submitLogin}>
          <FormField label="Логін" required>
            <Input autoComplete="username" autoFocus disabled={submitting} name="username" value={username} onChange={(event) => setUsername(event.target.value)} />
          </FormField>
          <FormField label="Пароль" required>
            <Input autoComplete="current-password" disabled={submitting} name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </FormField>
          {error ? <ErrorState message={error} /> : null}
          <Button disabled={submitting} type="submit">{submitting ? 'Перевірка…' : 'Продовжити'}</Button>
        </form>
      </AuthPageShell>
    );
  }

  if (stage === 'CHANGE_PASSWORD') {
    return (
      <AuthPageShell title="Обов’язкова зміна пароля" description="Змініть тимчасовий пароль перед налаштуванням двофакторної автентифікації.">
        <form className="grid gap-4" onSubmit={submitPasswordChange}>
          <AccountLabel user={preAuthUser} />
          <FormField label="Новий пароль" hint={`Від ${PASSWORD_MIN_LENGTH} до ${PASSWORD_MAX_LENGTH} символів.`} required>
            <Input autoComplete="new-password" autoFocus disabled={submitting} minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          </FormField>
          <FormField label="Підтвердження нового пароля" required>
            <Input autoComplete="new-password" disabled={submitting} minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
          </FormField>
          {error ? <ErrorState message={error} /> : null}
          <Button disabled={submitting} type="submit">{submitting ? 'Збереження…' : 'Змінити пароль і продовжити'}</Button>
          <Button disabled={submitting} variant="outline" type="button" onClick={resetFlow}>Повернутися до входу</Button>
        </form>
      </AuthPageShell>
    );
  }

  if (stage === 'ENROLL_2FA') {
    return (
      <AuthPageShell title="Налаштування двофакторної автентифікації" description="Додайте цей обліковий запис у Google Authenticator, Microsoft Authenticator, Aegis або інший TOTP-застосунок.">
        {!enrollment ? (
          <div className="grid gap-3">
            {error ? <ErrorState message={error} /> : <LoadingState label="Створення ключа 2FA…" />}
            {error ? <Button disabled={submitting} type="button" onClick={() => { setError(''); setSubmitting(true); void loadEnrollment(preAuthToken).catch((reason) => setError(authErrorMessage(reason, 'Не вдалося створити ключ 2FA. Спробуйте ще раз.'))).finally(() => setSubmitting(false)); }}>Спробувати ще раз</Button> : null}
            <Button disabled={submitting} variant="outline" type="button" onClick={resetFlow}>Повернутися до входу</Button>
          </div>
        ) : (
          <form className="grid gap-4" onSubmit={submitEnrollment}>
            <AccountLabel user={preAuthUser} />
            <div className="auth-2fa-instructions">
              <strong>1. Додайте обліковий запис в Authenticator</strong>
              <p>Відскануйте QR-код у Google Authenticator, Microsoft Authenticator, Aegis або іншому TOTP-застосунку.</p>
              <TwoFactorQrCode value={enrollment.otpauthUrl} />
              <p>Якщо ви відкрили систему на телефоні, можна скористатися системним посиланням або додати ключ вручну.</p>
              <a className="btn btn-outline" href={enrollment.otpauthUrl}>Відкрити в Authenticator</a>
            </div>
            <div className="auth-secret-box">
              <span>Ключ для ручного введення</span>
              <code>{enrollment.manualKey}</code>
            </div>
            <FormField label="2. Введіть 6-значний код" hint="Код змінюється приблизно кожні 30 секунд." required>
              <Input autoComplete="one-time-code" autoFocus disabled={submitting} inputMode="numeric" maxLength={6} pattern="[0-9]{6}" placeholder="000000" value={totpToken} onChange={(event) => setTotpToken(event.target.value.replace(/\D/g, '').slice(0, 6))} />
            </FormField>
            {error ? <ErrorState message={error} /> : null}
            <Button disabled={submitting} type="submit">{submitting ? 'Перевірка…' : 'Увімкнути 2FA'}</Button>
            <Button disabled={submitting} variant="outline" type="button" onClick={resetFlow}>Повернутися до входу</Button>
          </form>
        )}
      </AuthPageShell>
    );
  }

  if (stage === 'VERIFY_2FA') {
    return (
      <AuthPageShell title="Підтвердження входу" description={verifyMode === 'TOTP' ? 'Введіть поточний код із вашого Authenticator.' : 'Використайте один із резервних кодів, збережених під час налаштування 2FA.'}>
        <form className="grid gap-4" onSubmit={submitVerification}>
          <AccountLabel user={preAuthUser} />
          {verifyMode === 'TOTP' ? (
            <FormField label="Код Authenticator" required>
              <Input autoComplete="one-time-code" autoFocus disabled={submitting} inputMode="numeric" maxLength={6} pattern="[0-9]{6}" placeholder="000000" value={totpToken} onChange={(event) => setTotpToken(event.target.value.replace(/\D/g, '').slice(0, 6))} />
            </FormField>
          ) : (
            <FormField label="Резервний код" hint="Кожен резервний код можна використати лише один раз." required>
              <Input autoComplete="one-time-code" autoFocus disabled={submitting} maxLength={128} placeholder="XXXX-XXXX-XXXX-XXXX" value={recoveryCode} onChange={(event) => setRecoveryCode(event.target.value.toUpperCase())} />
            </FormField>
          )}
          {error ? <ErrorState message={error} /> : null}
          <Button disabled={submitting} type="submit">{submitting ? 'Перевірка…' : 'Підтвердити вхід'}</Button>
          <Button disabled={submitting} variant="outline" type="button" onClick={() => { setVerifyMode(verifyMode === 'TOTP' ? 'RECOVERY' : 'TOTP'); setError(''); }}>
            {verifyMode === 'TOTP' ? 'Використати резервний код' : 'Використати код Authenticator'}
          </Button>
          <Button disabled={submitting} variant="ghost" type="button" onClick={resetFlow}>Повернутися до входу</Button>
        </form>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell title="Збережіть резервні коди" description="Це єдиний раз, коли система показує ці коди у відкритому вигляді. Вони потрібні, якщо ви втратите доступ до Authenticator.">
      <div className="grid gap-4">
        <AccountLabel user={preAuthUser} />
        <div className="ui-alert" data-tone="warning" role="status">
          <strong>Збережіть коди зараз.</strong>
          <span>Кожен код одноразовий. Не надсилайте їх стороннім особам і не зберігайте у відкритому спільному документі.</span>
        </div>
        <div className="auth-recovery-codes" aria-label="Резервні коди 2FA">
          {recoveryCodes.map((code) => <code key={code}>{code}</code>)}
        </div>
        {copyStatus ? <div className="ui-alert" data-tone={copyStatus.startsWith('Не') ? 'warning' : 'success'} role="status">{copyStatus}</div> : null}
        {error ? <ErrorState message={error} /> : null}
        <Button variant="outline" type="button" onClick={() => void copyRecoveryCodes()}>Скопіювати всі коди</Button>
        <Button disabled={submitting} type="button" onClick={() => void continueAfterRecoveryCodes()}>{submitting ? 'Відкриття…' : 'Я зберіг коди — продовжити'}</Button>
      </div>
    </AuthPageShell>
  );
}

function AccountLabel({ user }: { user: PreAuthUser | null }) {
  return user ? <p className="text-sm text-[var(--color-text-secondary)]">Користувач: <strong>{user.username}</strong></p> : null;
}

function TwoFactorQrCode({ value }: { value: string }) {
  const dataUrl = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value, 'Byte');
    qr.make();
    return qr.createDataURL(6, 4);
  }, [value]);

  return (
    <div className="auth-qr-box">
      <img alt="QR-код для налаштування двофакторної автентифікації" src={dataUrl} />
    </div>
  );
}
