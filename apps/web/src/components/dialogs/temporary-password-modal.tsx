'use client';

import { useState } from 'react';
import { Alert, Field, Modal } from '@/components/common';

export function TemporaryPasswordModal({
  temporaryPassword,
  onClose,
}: {
  temporaryPassword: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <Modal title="Тимчасовий пароль" onClose={onClose}>
      <div className="grid gap-3">
        <Alert
          tone="warning"
          title="Збережіть пароль зараз"
          message="Пароль показується тільки один раз і не зберігається у браузері."
        />
        <Field label="Пароль">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input readOnly className="input font-mono" value={temporaryPassword} />
            <button
              className="btn btn-outline !w-auto"
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(temporaryPassword);
                setCopied(true);
              }}
            >
              {copied ? 'Скопійовано' : 'Копіювати'}
            </button>
          </div>
        </Field>
        <div className="flex justify-end">
          <button className="btn btn-primary !w-auto" type="button" onClick={onClose}>
            Закрити
          </button>
        </div>
      </div>
    </Modal>
  );
}

