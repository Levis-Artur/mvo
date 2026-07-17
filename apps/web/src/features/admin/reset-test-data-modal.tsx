'use client';

import { useState } from 'react';
import { Button, ErrorState, FormField, Input, Modal } from '@/components/ui';
import { adminService } from './admin.service';
import { destructiveErrorMessage } from './destructive-actions';
import { isResetConfirmationValid, RESET_CONFIRMATION } from './administration-model';

export function ResetTestDataModal({ onClose, onReset }: { onClose: () => void; onReset: () => Promise<void> | void }) {
  const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function reset() {
    if (!isResetConfirmationValid(confirmation)) { setError(`Введіть точний текст «${RESET_CONFIRMATION}».`); return; }
    setSaving(true); setError('');
    try { await adminService.resetTestData(); await onReset(); onClose(); }
    catch (reason) { setError(destructiveErrorMessage(reason)); }
    finally { setSaving(false); }
  }

  const footer = <><Button variant="outline" type="button" onClick={onClose}>Скасувати</Button><Button disabled={saving || !isResetConfirmationValid(confirmation)} variant="danger" type="button" onClick={() => void reset()}>{saving ? 'Очищення…' : 'Очистити тестові дані'}</Button></>;
  return <Modal closeOnEscape={!saving} destructive footer={footer} size="large" title="Очищення тестових даних" onClose={onClose}>
    <div className="grid gap-4">
      {error ? <ErrorState message={error} /> : null}
      <div className="ui-alert" data-tone="danger"><strong>Операція незворотна</strong><span>Видалення виконується сервером транзакційно та фіксується в аудиті.</span></div>
      <div className="grid gap-4 sm:grid-cols-2"><section><h3 className="font-semibold">Буде видалено</h3><ul className="mt-2 list-disc pl-5 text-sm"><li>імпорти та рядки імпортів;</li><li>операції та залишки;</li><li>тестова номенклатура;</li><li>МВО й організаційна структура;</li><li>звичайні користувачі.</li></ul></section><section><h3 className="font-semibold">Буде збережено</h3><ul className="mt-2 list-disc pl-5 text-sm"><li>поточний користувач із роллю «Власник»;</li><li>події аудиту та безпеки;</li><li>системні налаштування;</li><li>міграції Prisma.</li></ul></section></div>
      <FormField label={`Введіть «${RESET_CONFIRMATION}»`} required><Input autoComplete="off" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></FormField>
    </div>
  </Modal>;
}
