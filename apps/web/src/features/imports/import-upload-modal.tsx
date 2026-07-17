'use client';

import { type FormEvent, useState } from 'react';
import type { ImportBatch, ImportType } from '@/lib/types';
import { Button, ErrorState, FormField, Modal, Select } from '@/components/ui';
import { getErrorMessage } from '@/components/common';
import { importsService as apiClient } from './imports.service';

export function ImportUploadModal({ onClose, onSaved }: {
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
    <Modal closeOnEscape={!saving} footer={<>
      <Button disabled={saving} variant="outline" type="button" onClick={onClose}>Скасувати</Button>
      <Button disabled={saving || !file} form="import-upload-form" type="submit">{saving ? 'Завантаження…' : 'Завантажити'}</Button>
    </>} onClose={onClose} title="Новий імпорт">
      <form className="grid gap-4" id="import-upload-form" onSubmit={submit}>
        {error ? <ErrorState message={error} /> : null}
        <FormField label="Режим" required>
          <Select value={importType} onChange={(event) => setImportType(event.target.value as ImportType)}>
            <option value="INITIAL_BALANCE">Початкові залишки</option>
            <option value="RECEIPT">Нові надходження</option>
          </Select>
        </FormField>
        <p className="rounded border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 text-sm text-[var(--color-text-secondary)]">
          {importType === 'INITIAL_BALANCE'
            ? 'Буде використано колонку «Кількість кін.».'
            : 'Буде використано колонку «Кількість Дт». Колонка «Кількість кін.» використовується лише для звірки.'}
        </p>
        <FormField label="CSV або TSV файл" required>
          <input accept=".csv,.tsv" className="input" required type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </FormField>
      </form>
    </Modal>
  );
}
