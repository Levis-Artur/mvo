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
  sourceToDocumentLine,
} from './stock-source-picker-model';

export function StockDocumentForm(props: StockDocumentFormProps) {
  const {
    user,
    type,
    initialInventoryItemId,
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
    onClose,
  } = props;
  const operationContext = user.role === 'ORG_MANAGER' || user.role === 'OWNER' ? props.operationContext : undefined;
  const initialSource = operationContext?.responsiblePersonId ?? resolveSourceId(user, initialSourceId);
  const [documentDate, setDocumentDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [sourceId, setSourceId] = useState(initialSource);
  const [destinationId, setDestinationId] = useState('');
  const [destinationLabel, setDestinationLabel] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<DocumentFormLine[]>(() => {
    const initialSource = initialInventoryItemId
      ? availableSources.find(
          (source) =>
            source.inventoryItem.id === initialInventoryItemId &&
            (type === 'MVO_TRANSFER' ? source.canTransfer : source.canIssue) &&
            Number(source.availableQuantity) > 0,
        )
      : undefined;
    return initialSource ? [sourceToDocumentLine(initialSource)] : [];
  });
  const [files, setFiles] = useState<File[]>([]);
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [discardConfirmation, setDiscardConfirmation] = useState(false);
  const [validationError, setValidationError] = useState('');
  const recipientMode = documentRecipientMode(type);
  const transfer = type === 'MVO_TRANSFER';
  const issue = type === 'ISSUE';
  const createAndPostTransfer = transfer;
  const createAndPostIssue = issue;

  useEffect(() => {
    if (!destinationId || destinationLabel) return;
    const target = transferTargets.find(({ id }) => id === destinationId);
    if (target) setDestinationLabel(personOptionLabel(target));
  }, [destinationId, destinationLabel, transferTargets]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const input: StockDocumentInput = {
      type,
      documentDate: new Date(`${documentDate}T00:00:00.000Z`).toISOString(),
      sourceResponsiblePersonId: operationContext?.responsiblePersonId ?? resolveSourceId(user, sourceId),
      destinationResponsiblePersonId:
        recipientMode === 'MVO' ? destinationId : undefined,
      recipientName:
        recipientMode === 'EXTERNAL' ? recipientName.trim() : undefined,
      note: note.trim() || undefined,
      lines: lines.map((line) => ({
        inventoryItemId: line.inventoryItemId,
        sourceBalanceId: line.sourceBalanceId,
        quantity: line.quantity,
        note: line.note.trim() || undefined,
      })),
    };
    const message = validateDocumentInput(input, availableSources, {
      requireIssueBasis: !createAndPostIssue,
    });
    if (message) {
      setValidationError(message);
      return;
    }
    if (createAndPostIssue && !files.length) {
      setValidationError(
        'Для видачі додайте хоча б одне фото або скан накладної',
      );
      return;
    }
    setValidationError('');
    await onSubmit(input, files);
  }

  function changeSource(id: string) {
    setSourceId(id);
    setDestinationId('');
    setDestinationLabel('');
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
        operationContextName={operationContext?.fullName}
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
        title={operationContext ? `Закрити форму без збереження? МВО: ${operationContext.fullName}` : 'Закрити форму без збереження?'}
      >
        <p>
          Ви внесли дані, але ще не підтвердили операцію. Закрити форму без підтвердження?
        </p>
      </Modal>
    );
  }

  const title = transfer ? 'Нова передача' : 'Нова видача';
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
            {createAndPostTransfer
              ? saving
                ? 'Передаємо…'
                : 'Підтвердити передачу'
              : saving
                ? 'Видаємо…'
                : 'Підтвердити видачу'}
          </Button>
        </>
      }
      onClose={requestClose}
      size="fullscreen"
      title={operationContext ? `${title} — ${operationContext.fullName}` : title}
    >
      <form
        className="stock-document-form-layout"
        id="stock-document-form"
        onSubmit={submit}
      >
        {operationContext ? <div className="ui-alert" role="status">Операція від імені МВО: <strong>{operationContext.fullName}</strong></div> : null}
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
            {user.role !== 'MVO' && !operationContext ? (
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
                    initialFocus
                    sourceId={sourceId}
                    targets={transferTargets}
                    value={destinationId}
                    selectedLabel={destinationLabel}
                    onChange={(id, label) => {
                      setDestinationId(id);
                      setDestinationLabel(label);
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
              </>
            )}
            <FormField label={createAndPostIssue ? 'Коментар' : 'Примітка'}>
              <Textarea
                placeholder={
                  createAndPostIssue
                    ? 'За потреби вкажіть призначення або додаткову інформацію'
                    : 'За потреби вкажіть додаткову інформацію'
                }
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
          ) : createAndPostIssue ? (
            <div className="stock-document-transfer-info" role="status">
              Після підтвердження кількість буде списана з вашого поточного залишку.
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
              disabled={saving}
              files={files}
              onFilesChange={(nextFiles) => {
                setFiles(nextFiles);
                setDirty(true);
              }}
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
