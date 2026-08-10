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
    sourceTransfer,
    initialIssueLineId,
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
    document?.sourceResponsiblePersonId ??
      sourceTransfer?.sourceResponsiblePersonId ??
      initialSourceId,
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
      sourceTransferLineId: line.sourceTransferLineId ?? undefined,
      quantity: line.quantity,
      note: line.note ?? '',
    })) ??
      (() => {
        const initialIssueSource = initialIssueLineId
          ? availableSources.find(
              (source) => source.sourceTransferLineId === initialIssueLineId,
            )
          : undefined;
        return initialIssueSource
          ? addSelectedStockSource([], initialIssueSource)
          : [];
      })(),
  );
  const [files, setFiles] = useState<File[]>([]);
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [discardConfirmation, setDiscardConfirmation] = useState(false);
  const [validationError, setValidationError] = useState('');
  const recipientMode = documentRecipientMode(type);
  const transfer = type === 'MVO_TRANSFER';
  const issue = type === 'ISSUE';
  const createAndPostTransfer = transfer && !document;
  const createAndPostIssue = issue && !document && Boolean(sourceTransfer);

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
        recipientMode === 'EXTERNAL' && !createAndPostIssue
          ? recipientUnit.trim() || undefined
          : undefined,
      basis:
        type === 'MVO_TRANSFER' || createAndPostIssue
          ? undefined
          : basis.trim() || undefined,
      note: note.trim() || undefined,
      lines: lines.map((line) => ({
        inventoryItemId: line.inventoryItemId,
        sourceBalanceId: line.sourceBalanceId,
        sourceTransferLineId: line.sourceTransferLineId,
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
          {createAndPostTransfer || createAndPostIssue
            ? 'Ви внесли дані, але ще не підтвердили операцію. Закрити форму без підтвердження?'
            : 'Ви внесли дані, але ще не зберегли чернетку. Закрити форму без збереження?'}
        </p>
      </Modal>
    );
  }

  const title = document
    ? `Редагування ${transfer ? 'передачі' : 'видачі'}`
    : transfer
      ? 'Нова передача'
      : 'Видача переданого майна';
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
              : createAndPostIssue
                ? saving
                  ? 'Видаємо…'
                  : 'Підтвердити видачу'
              : saving
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
                    initialFocus={!document}
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
                {!createAndPostIssue ? (
                  <FormField label="Підрозділ одержувача">
                    <Input
                      value={recipientUnit}
                      onChange={(event) => {
                        setRecipientUnit(event.target.value);
                        setDirty(true);
                      }}
                    />
                  </FormField>
                ) : null}
              </>
            )}
            {!transfer && !createAndPostIssue ? (
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
          {createAndPostIssue && sourceTransfer ? (
            <Card title={`Передача № ${sourceTransfer.displayNumber}`}>
              <dl className="transfer-issue-context">
                <div>
                  <dt>Кому передано</dt>
                  <dd>
                    {sourceTransfer.destinationResponsiblePerson
                      ? `${sourceTransfer.destinationResponsiblePerson.externalAccountingCode ?? sourceTransfer.destinationResponsiblePerson.personnelNumber} — ${[
                          sourceTransfer.destinationResponsiblePerson.lastName,
                          sourceTransfer.destinationResponsiblePerson.firstName,
                          sourceTransfer.destinationResponsiblePerson.middleName,
                        ]
                          .filter(Boolean)
                          .join(' ')}`
                      : 'Не вказано'}
                  </dd>
                </div>
                <div>
                  <dt>Номенклатура</dt>
                  <dd>
                    {lines.length === 1
                      ? (() => {
                          const source = eligibleSources.find(
                            (item) =>
                              item.sourceTransferLineId ===
                              lines[0]?.sourceTransferLineId,
                          );
                          return source
                            ? `${source.inventoryItem.externalCode} — ${source.inventoryItem.name}`
                            : 'Оберіть позицію';
                        })()
                      : `${lines.length} позицій`}
                  </dd>
                </div>
                <div>
                  <dt>Передано / вже видано / доступно</dt>
                  <dd>
                    {lines.length === 1
                      ? (() => {
                          const sourceLine = sourceTransfer.lines.find(
                            (line) =>
                              line.id === lines[0]?.sourceTransferLineId,
                          );
                          return sourceLine
                            ? `${sourceLine.quantity} / ${sourceLine.issuedQuantity ?? '0'} / ${sourceLine.availableToIssue ?? sourceLine.quantity} ${sourceLine.inventoryItem.unitOfMeasure ?? ''}`
                            : '—';
                        })()
                      : 'Значення наведені у таблиці позицій'}
                  </dd>
                </div>
              </dl>
              <p className="stock-document-transfer-info" role="status">
                Залишок МВО повторно не списується.
              </p>
            </Card>
          ) : null}
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
