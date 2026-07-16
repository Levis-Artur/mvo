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
    <Modal title="Новий імпорт" onClose={onClose}>
      <form className="grid gap-3" onSubmit={submit}>
        {error ? <ErrorMessage message={error} /> : null}
        <Field label="Режим">
          <Select
            value={importType}
            onChange={(value) => setImportType(value as ImportType)}
          >
            <option value="INITIAL_BALANCE">Початкові залишки</option>
            <option value="RECEIPT">Нові надходження</option>
          </Select>
        </Field>
        <p className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-sm text-[var(--text-secondary)]">
          {importType === 'INITIAL_BALANCE'
            ? 'Буде використано колонку «Кількість кін.»'
            : 'Буде використано колонку «Кількість Дт». Колонка «Кількість кін.» використовується лише для звірки.'}
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



