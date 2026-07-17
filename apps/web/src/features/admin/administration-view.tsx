'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/ui/auth-context';
import { PageHeader } from '@/components/layout/page-header';
import { Button, Card, ErrorState, LoadingState, StatusBadge, Toast } from '@/components/ui';
import { DESTRUCTIVE_MODE_DISABLED_MESSAGE } from './destructive-actions';
import { adminService } from './admin.service';
import { readDestructiveMode, type DestructiveModeState } from './administration-model';
import { ResetTestDataModal } from './reset-test-data-modal';

export function AdministrationView() {
  const router = useRouter();
  const { user } = useAuth();
  const [mode, setMode] = useState<DestructiveModeState>('checking');
  const [resetOpen, setResetOpen] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!user || user.role !== 'OWNER') return;
    readDestructiveMode(() => adminService.deletionPreview('users', user.id)).then(setMode);
  }, [user]);

  return <section className="grid gap-4">
    <PageHeader icon="settings" title="Адміністрування" description="Централізоване керування системою та тестовими даними." />
    {mode === 'error' ? <ErrorState message="Не вдалося отримати стан адміністративних операцій від сервера." /> : null}
    <div className="administration-grid">
      <Card title="Система"><dl className="detail-list"><div><dt>API</dt><dd><StatusBadge tone="success">Доступний</StatusBadge></dd></div><div><dt>Авторизація</dt><dd>Захищена серверною сесією</dd></div><div><dt>Поточний користувач</dt><dd>{user?.username ?? '—'}</dd></div></dl></Card>
      <Card title="Destructive mode">{mode === 'checking' ? <LoadingState label="Перевірка стану на сервері…" /> : <div className="grid gap-3"><StatusBadge tone={mode === 'enabled' ? 'danger' : 'neutral'}>{mode === 'enabled' ? 'Увімкнений на сервері' : 'Вимкнений на сервері'}</StatusBadge>{mode === 'disabled' ? <p className="text-sm text-[var(--color-text-secondary)]">{DESTRUCTIVE_MODE_DISABLED_MESSAGE}.</p> : <p className="text-sm text-[var(--color-danger)]">Небезпечні дії доступні лише OWNER та додатково перевіряються backend.</p>}</div>}</Card>
      <Card title="Користувачі"><div className="grid gap-3"><p className="text-sm text-[var(--color-text-secondary)]">Облікові записи, ролі, блокування, паролі та сесії.</p><Button variant="outline" type="button" onClick={() => router.push('/admin/users')}>Відкрити користувачів</Button></div></Card>
      <Card title="Організаційна структура"><div className="grid gap-3"><p className="text-sm text-[var(--color-text-secondary)]">Управління, служби, підрозділи та МВО.</p><Button variant="outline" type="button" onClick={() => router.push('/structure')}>Відкрити структуру</Button></div></Card>
      <Card title="Імпорти"><div className="grid gap-3"><p className="text-sm text-[var(--color-text-secondary)]">Контроль імпортів, rollback та deletion preview.</p><Button variant="outline" type="button" onClick={() => router.push('/imports')}>Відкрити імпорти</Button></div></Card>
      <Card title="Тестові дані"><div className="grid gap-3"><p className="text-sm text-[var(--color-text-secondary)]">Повне очищення тестових даних зі збереженням поточного OWNER, аудиту та системних налаштувань.</p><Button disabled={mode !== 'enabled'} variant="danger" type="button" onClick={() => setResetOpen(true)}>Очистити тестові дані</Button>{mode === 'disabled' ? <small>{DESTRUCTIVE_MODE_DISABLED_MESSAGE}.</small> : null}</div></Card>
      <Card title="Аудит безпеки"><p className="text-sm text-[var(--color-text-secondary)]">Destructive actions записуються backend в audit events. Окремий endpoint для перегляду журналу безпеки поточним API не надається.</p></Card>
    </div>
    {resetOpen ? <ResetTestDataModal onClose={() => setResetOpen(false)} onReset={() => setToast('Тестові дані очищено. Audit event створено сервером.')} /> : null}
    {toast ? <Toast message={toast} onClose={() => setToast('')} /> : null}
  </section>;
}
