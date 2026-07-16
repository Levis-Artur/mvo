'use client';

import { useMemo, useState } from 'react';
import { ErrorMessage, Field, Modal, Select } from '@/components/common';
import { fullName } from '@/components/common/formatters';
import type { StockDocumentInput } from '@/lib/types';
import {
  filterRecipientOptions,
  personOptionLabel,
  resolveSourceId,
  validateDocumentInput,
} from './stock-document-rules';
import { StockDocumentLines } from './stock-document-lines';
import type { DocumentFormLine, StockDocumentFormProps } from './stock-document.types';

export function StockDocumentForm(props: StockDocumentFormProps) {
  const { user, type, document, persons, balances, loadingBalances, saving, error, onSourceChange, onSubmit, onClose } = props;
  const initialSource = resolveSourceId(user, document?.sourceResponsiblePersonId ?? '');
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
    () => filterRecipientOptions(persons, sourceId, recipientSearch),
    [persons, recipientSearch, sourceId],
  );
  const source = persons.find((person) => person.id === sourceId);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const input: StockDocumentInput = {
      type,
      documentNumber: documentNumber || undefined,
      documentDate: new Date(`${documentDate}T00:00:00.000Z`).toISOString(),
      sourceResponsiblePersonId: resolveSourceId(user, sourceId),
      destinationResponsiblePersonId: type === 'TRANSFER' ? destinationId : undefined,
      recipientName: type === 'ISSUE' ? recipientName.trim() : undefined,
      recipientUnit: type === 'ISSUE' ? recipientUnit.trim() || undefined : undefined,
      basis: basis.trim() || undefined,
      note: note.trim() || undefined,
      lines: lines.map((line) => ({ ...line, note: line.note.trim() || undefined })),
    };
    const message = validateDocumentInput(input, balances);
    if (message) return setValidationError(message);
    setValidationError('');
    await onSubmit(input);
  }

  function changeSource(id: string) {
    setSourceId(id);
    setDestinationId('');
    setLines([]);
    onSourceChange(id);
  }

  return (
    <Modal title={`${document ? 'Редагування' : 'Створення'}: ${type === 'TRANSFER' ? 'передача' : 'видача'}`} onClose={onClose}>
      <form className="grid gap-3" onSubmit={submit}>
        <Field label="Номер"><input className="input" value={documentNumber} onChange={(event) => setDocumentNumber(event.target.value)} /></Field>
        <Field label="Дата"><input className="input" required type="date" value={documentDate} onChange={(event) => setDocumentDate(event.target.value)} /></Field>
        <Field label="МВО-відправник">
          {user.role === 'MVO' ? (
            <input className="input" disabled value={source ? fullName(source) : user.username} />
          ) : (
            <Select required value={sourceId} onChange={changeSource}>
              <option value="">Оберіть МВО</option>
              {persons.filter((person) => person.isActive).map((person) => <option key={person.id} value={person.id}>{personOptionLabel(person)}</option>)}
            </Select>
          )}
        </Field>
        {type === 'TRANSFER' ? (
          <>
            <Field label="Пошук МВО">
              <input
                className="input"
                placeholder="Номер, ПІБ або управління"
                value={recipientSearch}
                onChange={(event) => setRecipientSearch(event.target.value)}
              />
            </Field>
            <Field label="МВО-одержувач"><Select required value={destinationId} onChange={setDestinationId}><option value="">Оберіть МВО</option>{recipients.map((person) => <option key={person.id} value={person.id}>{personOptionLabel(person)}</option>)}</Select></Field>
          </>
        ) : (
          <>
            <Field label="Одержувач"><input className="input" required value={recipientName} onChange={(event) => setRecipientName(event.target.value)} /></Field>
            <Field label="Підрозділ"><input className="input" value={recipientUnit} onChange={(event) => setRecipientUnit(event.target.value)} /></Field>
          </>
        )}
        <Field label="Підстава"><input className="input" value={basis} onChange={(event) => setBasis(event.target.value)} /></Field>
        <Field label="Примітка"><textarea className="input min-h-16" value={note} onChange={(event) => setNote(event.target.value)} /></Field>
        {loadingBalances ? <p className="text-sm">Завантаження залишків...</p> : <StockDocumentLines balances={balances} disabled={!sourceId} lines={lines} onChange={setLines} />}
        {validationError || error ? <ErrorMessage message={validationError || error} /> : null}
        <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-3">
          <button className="btn btn-outline !w-auto" type="button" onClick={onClose}>Закрити</button>
          <button className="btn btn-primary !w-auto" disabled={saving || loadingBalances} type="submit">
            {saving ? 'Збереження...' : 'Зберегти чернетку'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
