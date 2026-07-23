'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  Card,
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
  documentRecipientMode,
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
import { RecipientCombobox } from './recipient-combobox';
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
  const recipientMode = documentRecipientMode(type);

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
      basis: type === 'MVO_TRANSFER' ? undefined : basis.trim() || undefined,
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
      size="fullscreen"
      title={title}
    >
      <form
        className="stock-document-form-layout"
        id="stock-document-form"
        onSubmit={submit}
      >
        <Card title="Основні реквізити">
          <div className="stock-document-form-fields">
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
            {user.role !== 'MVO' ? (
              <FormField label="МВО-відправник" required>
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
              </FormField>
            ) : null}
            {recipientMode === 'MVO' ? (
              <>
                <FormField
                  hint="Пошук за номером, ПІБ або управлінням"
                  label="Кому передаємо"
                  required
                >
                  <RecipientCombobox
                    disabled={
                      loadingTargets || Boolean(targetsError)
                    }
                    sourceId={sourceId}
                    targets={transferTargets}
                    value={destinationId}
                    onChange={(id) => {
                      setDestinationId(id);
                      setDirty(true);
                    }}
                  />
                </FormField>
                {loadingTargets ? (
                  <LoadingState label="Завантаження МВО-одержувачів…" />
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
            {!transfer ? (
              <FormField label="Мета або підстава" required>
                <Input
                  required
                  value={basis}
                  onChange={(event) => {
                    setBasis(event.target.value);
                    setDirty(true);
                  }}
                />
              </FormField>
            ) : null}
            <FormField label="Примітка">
              <Textarea
                placeholder="За потреби вкажіть додаткову інформацію"
                value={note}
                onChange={(event) => {
                  setNote(event.target.value);
                  setDirty(true);
                }}
              />
            </FormField>
          </div>
        </Card>
        <div className="stock-document-form-workspace">
          {transfer ? (
            <div className="stock-document-transfer-info" role="status">
              Після проведення кількість буде списана з вашого залишку.
              Одержувачу майно автоматично не додається.
            </div>
          ) : null}
          {loadingSources ? (
            <LoadingState label="Завантаження доступного майна…" />
          ) : null}
          <StockDocumentLines
            disabled={!sourceId}
            lines={lines}
            loading={loadingSources}
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
          {validationError || error || sourcesError ? (
            <ErrorState message={validationError || error || sourcesError} />
          ) : null}
        </div>
      </form>
    </Modal>
  );
}
