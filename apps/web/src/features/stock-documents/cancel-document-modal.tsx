'use client';
import { useState } from 'react';
import type { StockDocument } from '@/lib/types';
import { Button, ErrorState, FormField, Modal, Textarea } from '@/components/ui';
import { documentActionState, documentNumberLabel } from './stock-document-rules';

export function CancelDocumentModal({ document, loading, error, onConfirm, onClose, requireReason = false }: {
  document: StockDocument; loading: boolean; error: string; onConfirm: (reason?: string) => void; onClose: () => void; requireReason?: boolean;
}) {
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  function handleConfirm() {
    if (loading) return;
    if (requireReason && (!reason.trim() || reason.trim().length > 1000)) {
      setReasonError('Вкажіть причину скасування (від 1 до 1000 символів).');
      return;
    }
    if (requireReason) onConfirm(reason.trim());
    else onConfirm();
  }
  const state = documentActionState(error, loading);
  const documentaryIssue =
    document.type === 'ISSUE' && Boolean(document.sourceTransferId);
  const directIssue = document.type === 'ISSUE' && !document.sourceTransferId;
  return <Modal
    closeOnEscape={!state.loading}
    destructive
    footer={<><Button disabled={state.disabled} variant="outline" type="button" onClick={onClose}>Закрити</Button><Button disabled={state.disabled} variant="danger" type="button" onClick={handleConfirm}>{state.loading ? 'Скасування…' : requireReason ? 'Скасувати операцію' : directIssue ? 'Скасувати видачу' : 'Скасувати документ'}</Button></>}
    onClose={onClose}
    title="Скасування документа"
  >
    <div className="grid gap-4 text-sm">
      {state.error ? <ErrorState message={state.error} /> : null}
      <p>Скасувати проведений документ <strong>{documentNumberLabel(document.displayNumber)}</strong>?</p>
      {requireReason ? <>
        <dl className="grid gap-2">
          <div><dt>Тип операції</dt><dd>{document.type === 'ISSUE' ? 'Видача' : 'Передача'}</dd></div>
          <div><dt>Дата</dt><dd>{new Date(document.documentDate).toLocaleDateString('uk-UA')}</dd></div>
          <div><dt>МВО</dt><dd>{[document.sourceResponsiblePerson.lastName, document.sourceResponsiblePerson.firstName, document.sourceResponsiblePerson.middleName].filter(Boolean).join(' ')}</dd></div>
          <div><dt>Номенклатура</dt><dd>{document.lines.map((line) => line.inventoryItem.name).join(', ')}</dd></div>
          <div><dt>Одержувач</dt><dd>{document.recipientName ?? (document.destinationResponsiblePerson ? [document.destinationResponsiblePerson.lastName, document.destinationResponsiblePerson.firstName, document.destinationResponsiblePerson.middleName].filter(Boolean).join(' ') : '—')}</dd></div>
        </dl>
        <p>Операцію буде скасовано з формуванням зворотного облікового руху.</p>
        <FormField label="Причина скасування" required error={reasonError}>
          <Textarea disabled={loading} maxLength={1000} value={reason} onChange={(event) => { setReason(event.target.value); setReasonError(''); }} />
        </FormField>
      </> : null}
      <div className="ui-alert" data-tone="warning" role="status">
        <strong>
          {documentaryIssue
            ? 'Доступну для оформлення кількість передачі буде відновлено'
            : directIssue
              ? requireReason ? 'Кількість буде повернено до залишку МВО' : 'Кількість буде повернено до вашого залишку'
            : 'Попередній стан майна буде відновлено'}
        </strong>
        <span>
          {documentaryIssue
            ? 'Складський залишок не зміниться. Історія видачі збережеться.'
            : directIssue
              ? 'Документ і підтверджуючий файл залишаться в історії зі статусом «Скасовано».'
            : 'Історія документа збережеться. Якщо майно вже було видане, скасування може бути недоступним.'}
        </span>
      </div>
      <p className="text-[var(--color-text-secondary)]">Якщо документ зараз не можна скасувати, причина буде показана тут.</p>
    </div>
  </Modal>;
}
