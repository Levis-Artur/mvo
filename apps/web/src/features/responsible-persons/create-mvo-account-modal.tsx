'use client';

import { FormEvent, useState } from 'react';
import { responsiblePersonsService as apiClient } from './responsible-persons.service';
import type { ResponsiblePerson } from '@/lib/types';
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
    <Modal title="РЎС‚РІРѕСЂРёС‚Рё РѕР±Р»С–РєРѕРІРёР№ Р·Р°РїРёСЃ РњР’Рћ" onClose={onClose}>
      <div className="grid gap-3">
        <Alert
          tone="warning"
          title="РўРёРјС‡Р°СЃРѕРІРёР№ РїР°СЂРѕР»СЊ РїРѕРєР°Р·СѓС”С‚СЊСЃСЏ РѕРґРёРЅ СЂР°Р·"
          message="РџС–СЃР»СЏ Р·Р°РєСЂРёС‚С‚СЏ С†СЊРѕРіРѕ РІС–РєРЅР° Р№РѕРіРѕ РЅРµ РјРѕР¶РЅР° Р±СѓРґРµ РІС–РґРЅРѕРІРёС‚Рё. Р—Р° РїРѕС‚СЂРµР±Рё РІРёРєРѕРЅР°Р№С‚Рµ reset password."
        />
        <div className="erp-panel p-3 text-sm">
          <p className="font-semibold">{fullName(person)}</p>
          <p className="mt-1 text-[var(--text-secondary)]">
            РўР°Р±РµР»СЊРЅРёР№ РЅРѕРјРµСЂ: {person.personnelNumber}
          </p>
        </div>

        {temporaryPassword ? (
          <div className="grid gap-3">
            <Field label="РўРёРјС‡Р°СЃРѕРІРёР№ РїР°СЂРѕР»СЊ">
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  readOnly
                  className="input font-mono"
                  value={temporaryPassword}
                />
                <button
                  className="btn btn-outline !w-auto"
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(temporaryPassword);
                    setCopied(true);
                  }}
                >
                  {copied ? 'РЎРєРѕРїС–Р№РѕРІР°РЅРѕ' : 'РљРѕРїС–СЋРІР°С‚Рё'}
                </button>
              </div>
            </Field>
            <div className="flex justify-end">
              <button className="btn btn-primary !w-auto" type="button" onClick={onClose}>
                Р—Р°РєСЂРёС‚Рё
              </button>
            </div>
          </div>
        ) : (
          <form className="grid gap-3" onSubmit={submit}>
            {error ? <ErrorMessage message={error} /> : null}
            <Field label="Р›РѕРіС–РЅ">
              <input
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


