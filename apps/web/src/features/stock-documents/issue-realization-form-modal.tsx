'use client';

import { useMemo, useRef, useState } from 'react';
import {
  Button,
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

const REALIZATION_ATTACHMENT_TYPES =
  'image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const availableLines = useMemo(
    () =>
      issue.lines.filter(
        (line) => Number(line.availableToRealize ?? line.quantity) > 0,
      ),
    [issue.lines],
  );
  const quantityErrors = useMemo(
    () => Object.fromEntries(
      availableLines.map((line) => {
        const value = quantities[line.id]?.trim() ?? '';
        const available = Number(line.availableToRealize ?? line.quantity);
        if (!value) return [line.id, ''];
        const quantity = Number(value);
        if (!Number.isFinite(quantity) || quantity <= 0) {
          return [line.id, 'Вкажіть кількість більшу за нуль.'];
        }
        if (quantity > available) {
          return [
            line.id,
            `Кількість не може перевищувати ${formatQuantity(
              line.availableToRealize ?? line.quantity,
            )} ${line.inventoryItem.unitOfMeasure ?? ''}`.trim(),
          ];
        }
        return [line.id, ''];
      }),
    ),
    [availableLines, quantities],
  );
  const hasQuantity = availableLines.some(
    (line) => (quantities[line.id]?.trim() ?? '') !== '',
  );
  const hasQuantityError = Object.values(quantityErrors).some(Boolean);
  const canSubmit = Boolean(
    realizationDate &&
      availableLines.length &&
      hasQuantity &&
      !hasQuantityError &&
      !saving,
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

  function removeFile(index: number) {
    setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <Modal
      closeOnEscape={!saving}
      footer={
        <>
          <Button disabled={saving} type="button" variant="outline" onClick={onClose}>
            Скасувати
          </Button>
          <Button disabled={!canSubmit} form="issue-realization-form" type="submit">
            {saving ? 'Оформлюємо…' : 'Підтвердити реалізацію'}
          </Button>
        </>
      }
      onClose={onClose}
      title={`Реалізація видачі ${documentNumberLabel(issue.displayNumber)}`}
    >
      <form className="issue-realization-form" id="issue-realization-form" onSubmit={submit}>
        {error || validationError ? (
          <ErrorState message={error || validationError} />
        ) : null}
        <div className="issue-realization-form__fields">
          <FormField label="Дата реалізації" required>
            <Input
              required
              type="date"
              value={realizationDate}
              onChange={(event) => setRealizationDate(event.target.value)}
            />
          </FormField>
          <FormField
            label={issue.recipientName
              ? 'Примітка до одержувача'
              : 'Одержувач / примітка'}
          >
            <Input
              placeholder={issue.recipientName
                ? 'За потреби додайте уточнення'
                : undefined}
              value={recipientText}
              onChange={(event) => setRecipientText(event.target.value)}
            />
          </FormField>
          <FormField label="Коментар">
            <Textarea
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </FormField>
        </div>

        <section
          aria-labelledby="issue-realization-lines-title"
          className="issue-realization-section"
        >
          <h3 id="issue-realization-lines-title">Позиції для реалізації</h3>
          <div className="issue-realization-lines">
            {availableLines.map((line) => (
              <article className="issue-realization-line" key={line.id}>
                <header className="issue-realization-line__item">
                  <strong>{line.inventoryItem.name}</strong>
                  <span>Код: {line.inventoryItem.externalCode}</span>
                </header>
                <dl className="issue-realization-line__summary">
                  <div><dt>Видано</dt><dd>{formatQuantity(line.quantity)} {line.inventoryItem.unitOfMeasure ?? ''}</dd></div>
                  <div><dt>Реалізовано</dt><dd>{formatQuantity(line.realizedQuantity ?? '0')} {line.inventoryItem.unitOfMeasure ?? ''}</dd></div>
                  <div><dt>Залишилось</dt><dd>{formatQuantity(line.availableToRealize ?? line.quantity)} {line.inventoryItem.unitOfMeasure ?? ''}</dd></div>
                </dl>
                <div className="issue-realization-line__quantity">
                  <label htmlFor={`issue-realization-quantity-${line.id}`}>
                    Кількість до реалізації
                  </label>
                  <div className="issue-realization-line__quantity-control">
                    <Input
                      aria-describedby={`issue-realization-quantity-help-${line.id}`}
                      aria-invalid={Boolean(quantityErrors[line.id])}
                      id={`issue-realization-quantity-${line.id}`}
                      inputMode="decimal"
                      max={line.availableToRealize ?? line.quantity}
                      min="0.000000000001"
                      step="any"
                      type="number"
                      value={quantities[line.id] ?? ''}
                      onChange={(event) => {
                        setValidationError('');
                        setQuantities((current) => ({
                          ...current,
                          [line.id]: event.target.value,
                        }));
                      }}
                    />
                    <span>{line.inventoryItem.unitOfMeasure ?? ''}</span>
                  </div>
                  {quantityErrors[line.id] ? (
                    <p
                      className="form-field__error"
                      id={`issue-realization-quantity-help-${line.id}`}
                      role="alert"
                    >
                      {quantityErrors[line.id]}
                    </p>
                  ) : (
                    <p
                      className="form-field__hint"
                      id={`issue-realization-quantity-help-${line.id}`}
                    >
                      Доступно: {formatQuantity(
                        line.availableToRealize ?? line.quantity,
                      )} {line.inventoryItem.unitOfMeasure ?? ''}
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section
          aria-labelledby="issue-realization-attachments-title"
          className="issue-realization-section issue-realization-attachment"
        >
          <div>
            <h3 id="issue-realization-attachments-title">
              Підтверджуючий документ
            </h3>
            <p>Додайте фото або PDF за потреби.</p>
          </div>
          <input
            ref={fileInputRef}
            hidden
            multiple
            accept={REALIZATION_ATTACHMENT_TYPES}
            type="file"
            onChange={(event) =>
              setFiles(Array.from(event.target.files ?? []))
            }
          />
          <Button
            className="issue-realization-attachment__choose"
            disabled={saving}
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            Обрати файл
          </Button>
          {files.length ? (
            <ul className="issue-realization-attachment__files">
              {files.map((file, index) => (
                <li key={`${file.name}-${file.lastModified}-${index}`}>
                  <span title={file.name}>{file.name}</span>
                  <Button
                    aria-label={`Видалити файл ${file.name}`}
                    disabled={saving}
                    size="compact"
                    type="button"
                    variant="ghost"
                    onClick={() => removeFile(index)}
                  >
                    Видалити
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </form>
    </Modal>
  );
}
