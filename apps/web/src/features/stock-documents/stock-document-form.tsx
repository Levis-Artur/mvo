'use client';

import { useMemo, useState } from 'react';
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
import {
  documentRecipientMode,
  filterRecipientOptions,
  personOptionLabel,
  resolveSourceId,
  validateDocumentInput,
} from './stock-document-rules';
import { StockDocumentLines } from './stock-document-lines';
import type { DocumentFormLine, StockDocumentFormProps } from './stock-document.types';

export function StockDocumentForm(props: StockDocumentFormProps) {
  const {
    user, type, document, initialSourceId, persons, transferTargets, balances,
    loadingBalances, loadingTargets, saving, error, targetsError,
    onSourceChange, onSubmit, onClose,
  } = props;
  const initialSource = resolveSourceId(
    user,
    document?.sourceResponsiblePersonId ?? initialSourceId,
  );
  const [documentNumber, setDocumentNumber] = useState(document?.documentNumber ?? '');
  const [documentDate, setDocumentDate] = useState((document?.documentDate ?? new Date().toISOString()).slice(0, 10));
  const [sourceId, setSourceId] = useState(initialSource);
  const [destinationId, setDestinationId] = useState(document?.destinationResponsiblePersonId ?? '');
  const [recipientName, setRecipientName] = useState(document?.recipientName ?? '');
  const [recipientUnit, setRecipientUnit] = useState(document?.recipientUnit ?? '');
  const [basis, setBasis] = useState(document?.basis ?? '');
  const [note, setNote] = useState(document?.note ?? '');
  const [lines, setLines] = useState<DocumentFormLine[]>(
    document?.lines.map((line) => ({ inventoryItemId: line.inventoryItemId, quantity: line.quantity, note: line.note ?? '' })) ?? [],
  );
  const [validationError, setValidationError] = useState('');
  const [recipientSearch, setRecipientSearch] = useState('');
  const recipients = useMemo(
    () => filterRecipientOptions(transferTargets, sourceId, recipientSearch),
    [recipientSearch, sourceId, transferTargets],
  );
  const source = persons.find((person) => person.id === sourceId);
  const recipientMode = documentRecipientMode(type);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const input: StockDocumentInput = {
      type,
      documentNumber: documentNumber.trim() || undefined,
      documentDate: new Date(`${documentDate}T00:00:00.000Z`).toISOString(),
      sourceResponsiblePersonId: resolveSourceId(user, sourceId),
      destinationResponsiblePersonId: recipientMode === 'MVO' ? destinationId : undefined,
      recipientName: recipientMode === 'EXTERNAL' ? recipientName.trim() : undefined,
      recipientUnit: recipientMode === 'EXTERNAL' ? recipientUnit.trim() || undefined : undefined,
      basis: basis.trim() || undefined,
      note: note.trim() || undefined,
      lines: lines.map((line) => ({ ...line, note: line.note.trim() || undefined })),
    };
    const message = validateDocumentInput(input, balances);
    if (message) { setValidationError(message); return; }
    setValidationError('');
    await onSubmit(input);
  }

  function changeSource(id: string) {
    setSourceId(id); setDestinationId(''); setLines([]); onSourceChange(id);
  }

  const title = `${document ? 'Редагування' : 'Створення'}: ${type === 'TRANSFER' ? 'передача' : 'видача'}`;
  return <Modal
    closeOnEscape={!saving}
    footer={<><Button disabled={saving} variant="outline" type="button" onClick={onClose}>Закрити</Button><Button disabled={saving || loadingBalances} form="stock-document-form" type="submit">{saving ? 'Збереження…' : 'Зберегти чернетку'}</Button></>}
    onClose={onClose}
    size="large"
    title={title}
  >
    <form className="grid min-w-0 gap-4 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.7fr)]" id="stock-document-form" onSubmit={submit}>
      <Card title="Основні дані">
        <div className="grid gap-3">
          <FormField label="Номер" hint="Якщо не вказати, номер сформує сервер."><Input value={documentNumber} onChange={(event) => setDocumentNumber(event.target.value)} /></FormField>
          <FormField label="Дата" required><Input required type="date" value={documentDate} onChange={(event) => setDocumentDate(event.target.value)} /></FormField>
          <FormField label="МВО-відправник" required>
            {user.role === 'MVO' ? (
              <Input disabled readOnly value={source ? personOptionLabel(source) : user.username} />
            ) : (
              <Select required value={sourceId} onChange={(event) => changeSource(event.target.value)}>
                <option value="">Оберіть МВО</option>
                {persons.filter((person) => person.isActive).map((person) => <option key={person.id} value={person.id}>{personOptionLabel(person)}</option>)}
              </Select>
            )}
          </FormField>
          {recipientMode === 'MVO' ? <>
            <FormField label="Пошук МВО" hint="Номер, ПІБ або управління"><Input placeholder="003 або прізвище" value={recipientSearch} onChange={(event) => setRecipientSearch(event.target.value)} /></FormField>
            <FormField label="МВО-одержувач" required>
              <Select disabled={loadingTargets || Boolean(targetsError) || !recipients.length} required value={destinationId} onChange={(event) => setDestinationId(event.target.value)}>
                <option value="">Оберіть МВО</option>
                {recipients.map((person) => <option key={person.id} value={person.id}>{personOptionLabel(person)}</option>)}
              </Select>
            </FormField>
            {loadingTargets ? <LoadingState label="Завантаження МВО-одержувачів…" /> : null}
            {!loadingTargets && !targetsError && !recipients.length ? <EmptyState message="Активних МВО за вказаним пошуком не знайдено." /> : null}
            {targetsError ? <ErrorState message={targetsError} /> : null}
          </> : <>
            <FormField label="Одержувач" required><Input required value={recipientName} onChange={(event) => setRecipientName(event.target.value)} /></FormField>
            <FormField label="Підрозділ"><Input value={recipientUnit} onChange={(event) => setRecipientUnit(event.target.value)} /></FormField>
          </>}
          <FormField label="Підстава"><Input value={basis} onChange={(event) => setBasis(event.target.value)} /></FormField>
          <FormField label="Примітка"><Textarea value={note} onChange={(event) => setNote(event.target.value)} /></FormField>
        </div>
      </Card>
      <div className="grid min-w-0 content-start gap-3">
        {loadingBalances ? <LoadingState label="Завантаження залишків відправника…" /> : null}
        <StockDocumentLines balances={balances} disabled={!sourceId} lines={lines} loading={loadingBalances} onChange={setLines} />
        {validationError || error ? <ErrorState message={validationError || error} /> : null}
      </div>
    </form>
  </Modal>;
}
