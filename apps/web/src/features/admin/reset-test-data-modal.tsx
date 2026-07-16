'use client';

import { useState } from 'react';
import { ErrorMessage, Modal } from '@/components/common';
import { adminService } from './admin.service';
import { destructiveErrorMessage } from './destructive-actions';

export function ResetTestDataModal({
  onClose,
  onReset,
}: {
  onClose: () => void;
  onReset: () => Promise<void> | void;
}) {
  const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function reset() {
    if (confirmation !== 'DELETE TEST DATA') {
      setError('Введіть точний текст підтвердження.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await adminService.resetTestData();
      await onReset();
      onClose();
    } catch (reason) {
      setError(destructiveErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Очистити тестові дані" onClose={onClose}>
      <div className="grid gap-4">
        {error ? <ErrorMessage message={error} /> : null}
        <p className="text-sm text-[var(--danger)]">
          Будуть видалені тестові імпорти, залишки, операції, номенклатура,
          МВО, структура та звичайні користувачі. Поточний OWNER і журнал
          аудиту збережуться.
        </p>
        <label className="grid gap-1 text-sm font-medium">
          Введіть «DELETE TEST DATA»
          <input className="input" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
        </label>
        <div className="flex justify-end gap-2">
          <button className="btn btn-outline" type="button" onClick={onClose}>Скасувати</button>
          <button className="btn btn-danger" disabled={saving} type="button" onClick={() => void reset()}>
            {saving ? 'Очищення...' : 'Очистити тестові дані'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
