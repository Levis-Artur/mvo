'use client';

import { FormEvent, useState } from 'react';
import { responsiblePersonsService as apiClient } from './responsible-persons.service';
import type { ResponsiblePerson } from '@/lib/types';
import { Button, Card, ErrorState, FormField, Input, Modal } from '@/components/ui';
import { fullName, getErrorMessage } from '@/components/common';
import { copyToClipboard } from '@/lib/copy-to-clipboard';
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
  const [copyError, setCopyError] = useState('');

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

  const footer = temporaryPassword ? (
    <Button type="button" onClick={onClose}>Закрити</Button>
  ) : (
    <><Button variant="outline" type="button" onClick={onClose}>Скасувати</Button><Button disabled={saving} form="create-mvo-account-form" type="submit">{saving ? 'Створення…' : 'Створити'}</Button></>
  );

  return (
    <Modal closeOnEscape={!saving} footer={footer} title="Створити обліковий запис МВО" onClose={onClose}>
      <div className="grid gap-3">
        <div className="ui-alert" data-tone="warning" role="status"><strong>Тимчасовий пароль показується один раз</strong><span>Після закриття цього вікна його не можна буде відновити. За потреби виконайте скидання пароля.</span></div>
        <Card>
          <p className="font-semibold">{fullName(person)}</p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Табельний номер: {person.personnelNumber}
          </p>
        </Card>

        {temporaryPassword ? (
          <div className="grid gap-3">
            {copyError ? <ErrorState message={copyError} /> : null}
            <FormField label="Тимчасовий пароль">
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
                    void copyToClipboard(temporaryPassword).then((success) => {
                      setCopied(success);
                      setCopyError(success ? '' : 'Не вдалося скопіювати пароль. Скопіюйте його вручну.');
                    });
                  }}
                >
                  {copied ? 'Скопійовано' : 'Копіювати'}
                </Button>
              </div>
            </FormField>
          </div>
        ) : (
          <form className="grid gap-3" id="create-mvo-account-form" onSubmit={submit}>
            {error ? <ErrorState message={error} /> : null}
            <FormField label="Логін" required>
              <Input
                required
                className="input"
                minLength={3}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </FormField>
          </form>
        )}
      </div>
    </Modal>
  );
}


