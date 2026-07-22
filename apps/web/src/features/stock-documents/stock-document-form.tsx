'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  Modal,
  Select,
  Textarea,
} from '@/components/ui';
import type { StockDocumentInput } from '@/lib/types';
import { StockDocumentAttachments } from './stock-document-attachments';
import { StockDocumentLines } from './stock-document-lines';
import {
  documentNumberLabel,
  documentRecipientMode,
  filterRecipientOptions,
  personOptionLabel,
  resolveSourceId,
  shouldConfirmUnsavedDocument,
  validateDocumentInput,
} from './stock-document-rules';
import type {
  DocumentFormLine,
  StockDocumentFormProps,
} from './stock-document.types';
import { StockSourcePickerModal } from './stock-source-picker-modal';
import {
  addSelectedStockSource,
  availableSourceOptions,
  documentLineSourceKey,
  stockSourceKey,
} from './stock-source-picker-model';

export function StockDocumentForm(props: StockDocumentFormProps) {
  const {
    user,
    type,
    document,
    initialSourceId,
    persons,
    transferTargets,
    availableSources,
    loadingSources,
    loadingTargets,
    saving,
    error,
    sourcesError,
    targetsError,
    onSourceChange,
    onSubmit,
    onRemoveAttachment,
    onClose,
  } = props;
  const initialSource = resolveSourceId(
    user,
    document?.sourceResponsiblePersonId ?? initialSourceId,
  );
  const [documentDate, setDocumentDate] = useState(
    (document?.documentDate ?? new Date().toISOString()).slice(0, 10),
  );
  const [sourceId, setSourceId] = useState(initialSource);
  const [destinationId, setDestinationId] = useState(
    document?.destinationResponsiblePersonId ?? '',
  );
  const [recipientName, setRecipientName] = useState(
    document?.recipientName ?? '',
  );
  const [recipientUnit, setRecipientUnit] = useState(
    document?.recipientUnit ?? '',
  );
  const [basis, setBasis] = useState(document?.basis ?? '');
  const [note, setNote] = useState(document?.note ?? '');
  const [lines, setLines] = useState<DocumentFormLine[]>(
    document?.lines.map((line) => ({
      inventoryItemId: line.inventoryItemId,
      sourceBalanceId: line.sourceBalanceId ?? '',
      quantity: line.quantity,
      note: line.note ?? '',
    })) ?? [],
  );
  const [files, setFiles] = useState<File[]>([]);
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [discardConfirmation, setDiscardConfirmation] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [recipientSearch, setRecipientSearch] = useState('');
  const source = persons.find((person) => person.id === sourceId);
  const recipientMode = documentRecipientMode(type);
  const simplified = user.role === 'MVO';
  const recipients = useMemo(
    () => filterRecipientOptions(transferTargets, sourceId, recipientSearch),
    [recipientSearch, sourceId, transferTargets],
  );

  useEffect(() => {
    const uploaded = document?.attachments ?? [];
    if (!uploaded.length) return;
    setFiles((current) =>
      current.filter(
        (file) =>
          !uploaded.some(
            (attachment) =>
              attachment.originalFileName === file.name &&
              attachment.sizeBytes === file.size,
          ),
      ),
    );
  }, [document?.attachments]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const input: StockDocumentInput = {
      type,
      documentDate: new Date(`${documentDate}T00:00:00.000Z`).toISOString(),
      sourceResponsiblePersonId: resolveSourceId(user, sourceId),
      destinationResponsiblePersonId:
        recipientMode === 'MVO' ? destinationId : undefined,
      recipientName:
        recipientMode === 'EXTERNAL' ? recipientName.trim() : undefined,
      recipientUnit:
        recipientMode === 'EXTERNAL'
          ? recipientUnit.trim() || undefined
          : undefined,
      basis: basis.trim() || undefined,
      note: note.trim() || undefined,
      lines: lines.map((line) => ({
        inventoryItemId: line.inventoryItemId,
        sourceBalanceId: line.sourceBalanceId,
        quantity: line.quantity,
        note: line.note.trim() || undefined,
      })),
    };
    const message = validateDocumentInput(input, availableSources);
    if (message) {
      setValidationError(message);
      return;
    }
    setValidationError('');
    await onSubmit(input, files);
  }

  function changeSource(id: string) {
    setSourceId(id);
    setDestinationId('');
    setLines([]);
    setDirty(true);
    void onSourceChange(id);
  }

  function requestClose() {
    if (shouldConfirmUnsavedDocument(dirty, saving)) {
      setDiscardConfirmation(true);
    } else {
      onClose();
    }
  }

  const eligibleSources = availableSourceOptions(availableSources, [], type);
  const selectedSourceKeys = lines.map(documentLineSourceKey);

  if (sourcePickerOpen) {
    return (
      <StockSourcePickerModal
        error={sourcesError}
        loading={loadingSources}
        selectedSourceKeys={selectedSourceKeys}
        sources={availableSources}
        type={type}
        onClose={() => setSourcePickerOpen(false)}
        onConfirm={(selectedSource) => {
          if (!selectedSourceKeys.includes(stockSourceKey(selectedSource))) {
            setLines((current) =>
              addSelectedStockSource(current, selectedSource),
            );
            setDirty(true);
          }
          setSourcePickerOpen(false);
        }}
        onRefresh={() => onSourceChange(sourceId)}
      />
    );
  }

  if (discardConfirmation) {
    return (
      <Modal
        closeOnEscape
        destructive
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDiscardConfirmation(false)}
            >
              Продовжити заповнення
            </Button>
            <Button type="button" variant="danger" onClick={onClose}>
              Закрити без збереження
            </Button>
          </>
        }
        onClose={() => setDiscardConfirmation(false)}
        size="small"
        title="Закрити форму без збереження?"
      >
        <p>
          Ви внесли дані, але ще не зберегли чернетку. Закрити форму без
          збереження?
        </p>
      </Modal>
    );
  }

  const transfer = type === 'MVO_TRANSFER';
  const title = document
    ? `Редагування ${transfer ? 'передачі' : 'видачі'}`
    : `Нова ${transfer ? 'передача' : 'видача'}`;
  const steps = transfer
    ? ['Кому передаємо', 'Що передаємо', 'Скільки', 'Перевірка та збереження']
    : [
        'Кому видаємо',
        'Для чого',
        'Що видаємо',
        'Додати накладну',
        'Перевірка та збереження',
      ];

  return (
    <Modal
      closeOnEscape={!saving}
      footer={
        <>
          <Button
            disabled={saving}
            type="button"
            variant="outline"
            onClick={requestClose}
          >
            Закрити
          </Button>
          <Button
            disabled={saving || loadingSources || loadingTargets}
            form="stock-document-form"
            type="submit"
          >
            {saving
              ? files.length
                ? 'Завантаження вкладень…'
                : 'Збереження…'
              : 'Зберегти чернетку'}
          </Button>
        </>
      }
      onClose={requestClose}
      size="large"
      title={title}
    >
      {simplified ? (
        <ol
          aria-label="Етапи заповнення документа"
          className={`stock-document-steps stock-document-steps--${transfer ? 'transfer' : 'issue'}`}
        >
          {steps.map((step, index) => (
            <li key={step}>
              <span>{index + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      ) : null}
      <form
        className="grid min-w-0 gap-4 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.7fr)]"
        id="stock-document-form"
        onSubmit={submit}
      >
        <Card
          title={
            simplified
              ? transfer
                ? 'Кому передаємо'
                : 'Кому видаємо'
              : 'Основні дані'
          }
        >
          <div className="grid gap-3">
            <FormField
              hint={
                document
                  ? 'Номер присвоєно під час створення документа.'
                  : 'Наступний номер буде присвоєно під час збереження чернетки.'
              }
              label="Номер"
            >
              <Input
                readOnly
                value={
                  document
                    ? documentNumberLabel(document.displayNumber)
                    : 'Буде присвоєно автоматично'
                }
              />
            </FormField>
            <FormField label="Дата" required>
              <Input
                required
                type="date"
                value={documentDate}
                onChange={(event) => {
                  setDocumentDate(event.target.value);
                  setDirty(true);
                }}
              />
            </FormField>
            <FormField
              hint={
                simplified
                  ? 'Відправником автоматично є ваша картка МВО.'
                  : undefined
              }
              label="МВО-відправник"
              required
            >
              {user.role === 'MVO' ? (
                <Input
                  disabled
                  readOnly
                  value={source ? personOptionLabel(source) : user.username}
                />
              ) : (
                <Select
                  required
                  value={sourceId}
                  onChange={(event) => changeSource(event.target.value)}
                >
                  <option value="">Оберіть МВО</option>
                  {persons
                    .filter((person) => person.isActive)
                    .map((person) => (
                      <option key={person.id} value={person.id}>
                        {personOptionLabel(person)}
                      </option>
                    ))}
                </Select>
              )}
            </FormField>
            {recipientMode === 'MVO' ? (
              <>
                <FormField label="Пошук МВО" hint="Номер, ПІБ або управління">
                  <Input
                    placeholder="003 або прізвище"
                    value={recipientSearch}
                    onChange={(event) => setRecipientSearch(event.target.value)}
                  />
                </FormField>
                <FormField label="Кому передаємо" required>
                  <Select
                    disabled={
                      loadingTargets || Boolean(targetsError) || !recipients.length
                    }
                    required
                    value={destinationId}
                    onChange={(event) => {
                      setDestinationId(event.target.value);
                      setDirty(true);
                    }}
                  >
                    <option value="">Оберіть МВО</option>
                    {recipients.map((person) => (
                      <option key={person.id} value={person.id}>
                        {personOptionLabel(person)}
                      </option>
                    ))}
                  </Select>
                </FormField>
                {loadingTargets ? (
                  <LoadingState label="Завантаження МВО-одержувачів…" />
                ) : null}
                {!loadingTargets && !targetsError && !recipients.length ? (
                  <EmptyState message="Активних МВО за вказаним пошуком не знайдено." />
                ) : null}
                {targetsError ? (
                  <div className="ui-alert" data-tone="warning" role="status">
                    {targetsError}
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <FormField label="Кому видано" required>
                  <Input
                    required
                    value={recipientName}
                    onChange={(event) => {
                      setRecipientName(event.target.value);
                      setDirty(true);
                    }}
                  />
                </FormField>
                <FormField label="Підрозділ одержувача">
                  <Input
                    value={recipientUnit}
                    onChange={(event) => {
                      setRecipientUnit(event.target.value);
                      setDirty(true);
                    }}
                  />
                </FormField>
              </>
            )}
            <FormField
              label={transfer ? 'Підстава' : 'Мета або підстава'}
              required={!transfer}
            >
              <Input
                required={!transfer}
                value={basis}
                onChange={(event) => {
                  setBasis(event.target.value);
                  setDirty(true);
                }}
              />
            </FormField>
            <FormField label="Примітка">
              <Textarea
                value={note}
                onChange={(event) => {
                  setNote(event.target.value);
                  setDirty(true);
                }}
              />
            </FormField>
          </div>
        </Card>
        <div className="grid min-w-0 content-start gap-3">
          <div
            className="ui-alert"
            data-tone={transfer ? 'info' : 'warning'}
            role="status"
          >
            {transfer
              ? 'Після проведення залишок відправника зменшиться. Одержувачу залишок автоматично не додається.'
              : 'Після проведення документа вказана кількість буде списана з обліку.'}
          </div>
          {loadingSources ? (
            <LoadingState label="Завантаження доступного майна…" />
          ) : null}
          <StockDocumentLines
            disabled={!sourceId}
            lines={lines}
            loading={loadingSources}
            simplified={simplified}
            sources={eligibleSources}
            type={type}
            onAddRequest={() => setSourcePickerOpen(true)}
            onChange={(nextLines) => {
              setLines(nextLines);
              setDirty(true);
            }}
          />
          {type === 'ISSUE' ? (
            <StockDocumentAttachments
              attachments={document?.attachments ?? []}
              disabled={saving}
              files={files}
              onFilesChange={(nextFiles) => {
                setFiles(nextFiles);
                setDirty(true);
              }}
              onRemoveAttachment={onRemoveAttachment}
            />
          ) : null}
          {simplified ? (
            <div className="stock-document-review-note">
              <strong>{transfer ? '4.' : '5.'} Перевірка та збереження</strong>
              <span>
                Перевірте одержувача, майно та кількість, потім збережіть
                чернетку.
              </span>
            </div>
          ) : null}
          {validationError || error || sourcesError ? (
            <ErrorState message={validationError || error || sourcesError} />
          ) : null}
        </div>
      </form>
    </Modal>
  );
}
