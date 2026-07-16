'use client';

import { FormEvent, useState } from 'react';
import { importsService as apiClient } from './imports.service';
import type { ImportBatch, ImportType } from '@/lib/types';
import {
  ErrorMessage,
  Field,
  FormActions,
  Modal,
  Select,
  getErrorMessage,
} from '@/components/common';
export function ImportUploadModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (batch: ImportBatch) => void;
}) {
  const [importType, setImportType] = useState<ImportType>('INITIAL_BALANCE');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    setSaving(true);
    setError('');
    try {
      onSaved(await apiClient.uploadImport(file, importType));
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="РќРѕРІРёР№ С–РјРїРѕСЂС‚" onClose={onClose}>
      <form className="grid gap-3" onSubmit={submit}>
        {error ? <ErrorMessage message={error} /> : null}
        <Field label="Р РµР¶РёРј">
          <Select
            value={importType}
            onChange={(value) => setImportType(value as ImportType)}
          >
            <option value="INITIAL_BALANCE">РџРѕС‡Р°С‚РєРѕРІС– Р·Р°Р»РёС€РєРё</option>
            <option value="RECEIPT">РќРѕРІС– РЅР°РґС…РѕРґР¶РµРЅРЅСЏ</option>
          </Select>
        </Field>
        <p className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-sm text-[var(--text-secondary)]">
          {importType === 'INITIAL_BALANCE'
            ? 'Р‘СѓРґРµ РІРёРєРѕСЂРёСЃС‚Р°РЅРѕ РєРѕР»РѕРЅРєСѓ В«РљС–Р»СЊРєС–СЃС‚СЊ РєС–РЅ.В»'
            : 'Р‘СѓРґРµ РІРёРєРѕСЂРёСЃС‚Р°РЅРѕ РєРѕР»РѕРЅРєСѓ В«РљС–Р»СЊРєС–СЃС‚СЊ Р”С‚В». РљРѕР»РѕРЅРєР° В«РљС–Р»СЊРєС–СЃС‚СЊ РєС–РЅ.В» РІРёРєРѕСЂРёСЃС‚РѕРІСѓС”С‚СЊСЃСЏ Р»РёС€Рµ РґР»СЏ Р·РІС–СЂРєРё.'}
        </p>
        <input
          required
          className="input"
          type="file"
          accept=".csv,.tsv"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        <FormActions saving={saving} onClose={onClose} />
      </form>
    </Modal>
  );
}



