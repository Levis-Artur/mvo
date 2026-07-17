'use client';

import { FormEvent, useState } from 'react';
import { responsiblePersonsService as apiClient } from './responsible-persons.service';
import type { ResponsiblePerson } from '@/lib/types';
import { Button, Card, Input } from '@/components/ui';
import {
  Alert,
  ErrorMessage,
  Field,
  FormActions,
  Modal,
  fullName,
  getErrorMessage,
} from '@/components/common';
export function CreateMvoAccountModal({
  person,
  onClose,
}: {
  person: ResponsiblePerson;
  onClose: () => void;
}) {
  const [username, setUsername] = useState(person.personnelNumber);
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSaving(true);

    try {
      const response = await apiClient.createUser({
        username,
        role: 'MVO',
        responsiblePersonId: person.id,
      });
      setTemporaryPassword(response.temporaryPassword);
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Створити обліковий запис МВО" onClose={onClose}>
      <div className="grid gap-3">
        <Alert
          tone="warning"
          title="Тимчасовий пароль показується один раз"
          message="Після закриття цього вікна його не можна буде відновити. За потреби виконайте reset password."
        />
        <Card>
          <p className="font-semibold">{fullName(person)}</p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Табельний номер: {person.personnelNumber}
          </p>
        </Card>

        {temporaryPassword ? (
          <div className="grid gap-3">
            <Field label="Тимчасовий пароль">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  readOnly
                  className="input font-mono"
                  value={temporaryPassword}
                />
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(temporaryPassword);
                    setCopied(true);
                  }}
                >
                  {copied ? 'Скопійовано' : 'Копіювати'}
                </Button>
              </div>
            </Field>
            <div className="flex justify-end">
              <Button type="button" onClick={onClose}>
                Закрити
              </Button>
            </div>
          </div>
        ) : (
          <form className="grid gap-3" onSubmit={submit}>
            {error ? <ErrorMessage message={error} /> : null}
            <Field label="Логін">
              <Input
                required
                className="input"
                minLength={3}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </Field>
            <FormActions saving={saving} onClose={onClose} />
          </form>
        )}
      </div>
    </Modal>
  );
}


