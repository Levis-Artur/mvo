'use client';

import { useMemo, useState } from 'react';
import {
  Button,
  Card,
  ErrorState,
  FormField,
  Input,
  Modal,
  Textarea,
} from '@/components/ui';
import { formatQuantity } from '@/features/inventory/quantity-format';
import type {
  CreateIssueRealizationInput,
  StockDocument,
} from '@/lib/types';
import { documentNumberLabel } from './stock-document-rules';

export function IssueRealizationFormModal({
  issue,
  error,
  saving,
  onClose,
  onSubmit,
}: {
  issue: StockDocument;
  error: string;
  saving: boolean;
  onClose: () => void;
  onSubmit: (input: CreateIssueRealizationInput, files: File[]) => void;
}) {
  const [realizationDate, setRealizationDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [recipientText, setRecipientText] = useState('');
  const [note, setNote] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [validationError, setValidationError] = useState('');

  const availableLines = useMemo(
    () =>
      issue.lines.filter(
        (line) => Number(line.availableToRealize ?? line.quantity) > 0,
      ),
    [issue.lines],
  );

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const lines = availableLines
      .map((line) => ({
        issueLineId: line.id,
        quantity: quantities[line.id]?.trim() ?? '',
        available: Number(line.availableToRealize ?? line.quantity),
      }))
      .filter((line) => line.quantity !== '');
    if (!lines.length) {
      setValidationError('Вкажіть кількість хоча б для однієї позиції.');
      return;
    }
    if (
      lines.some(
        (line) =>
          !Number.isFinite(Number(line.quantity)) ||
          Number(line.quantity) <= 0 ||
          Number(line.quantity) > line.available,
      )
    ) {
      setValidationError(
        'Кількість має бути більшою за нуль і не перевищувати доступну.',
      );
      return;
    }
    setValidationError('');
    onSubmit(
      {
        realizationDate,
        recipientText: recipientText.trim() || undefined,
        note: note.trim() || undefined,
        lines: lines.map(({ issueLineId, quantity }) => ({
          issueLineId,
          quantity,
        })),
      },
      files,
    );
  }

  return (
    <Modal
      closeOnEscape={!saving}
      footer={
        <>
          <Button disabled={saving} type="button" variant="outline" onClick={onClose}>
            Закрити
          </Button>
          <Button disabled={saving || !availableLines.length} form="issue-realization-form" type="submit">
            {saving ? 'Оформлюємо…' : 'Підтвердити реалізацію'}
          </Button>
        </>
      }
      onClose={onClose}
      size="large"
      title={`Реалізація видачі ${documentNumberLabel(issue.displayNumber)}`}
    >
      <form className="issue-realization-form" id="issue-realization-form" onSubmit={submit}>
        {error || validationError ? (
          <ErrorState message={error || validationError} />
        ) : null}
        <p className="text-sm text-[var(--color-text-secondary)]">
          Кому видано: <strong>{issue.recipientName ?? 'Не вказано'}</strong>
        </p>
        <div className="issue-realization-form__fields">
          <FormField label="Дата реалізації" required>
            <Input
              required
              type="date"
              value={realizationDate}
              onChange={(event) => setRealizationDate(event.target.value)}
            />
          </FormField>
          <FormField label="Одержувач або примітка до одержувача">
            <Input
              value={recipientText}
              onChange={(event) => setRecipientText(event.target.value)}
            />
          </FormField>
          <FormField label="Коментар">
            <Textarea value={note} onChange={(event) => setNote(event.target.value)} />
          </FormField>
        </div>

        <Card title="Позиції для реалізації">
          <div className="issue-realization-lines">
            {availableLines.map((line) => (
              <div className="issue-realization-line" key={line.id}>
                <div className="issue-realization-line__item">
                  <strong>{line.inventoryItem.name}</strong>
                  <span>
                    {line.inventoryItem.externalCode} · видано{' '}
                    {formatQuantity(line.quantity)} · реалізовано{' '}
                    {formatQuantity(line.realizedQuantity ?? '0')} · доступно{' '}
                    {formatQuantity(line.availableToRealize ?? line.quantity)}{' '}
                    {line.inventoryItem.unitOfMeasure ?? ''}
                  </span>
                </div>
                <FormField label={`Кількість — ${line.inventoryItem.name}`}>
                  <Input
                    inputMode="decimal"
                    min="0"
                    step="any"
                    type="number"
                    value={quantities[line.id] ?? ''}
                    onChange={(event) =>
                      setQuantities((current) => ({
                        ...current,
                        [line.id]: event.target.value,
                      }))
                    }
                  />
                </FormField>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Фото або PDF (необов’язково)">
          <Input
            multiple
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
            type="file"
            onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
          />
          {files.length ? (
            <p className="form-field__hint">Вибрано файлів: {files.length}</p>
          ) : null}
        </Card>
      </form>
    </Modal>
  );
}
