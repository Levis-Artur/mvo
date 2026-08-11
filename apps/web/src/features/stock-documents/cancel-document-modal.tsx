import type { StockDocument } from '@/lib/types';
import { Button, ErrorState, Modal } from '@/components/ui';
import { documentActionState, documentNumberLabel } from './stock-document-rules';

export function CancelDocumentModal({ document, loading, error, onConfirm, onClose }: {
  document: StockDocument; loading: boolean; error: string; onConfirm: () => void; onClose: () => void;
}) {
  const state = documentActionState(error, loading);
  const documentaryIssue =
    document.type === 'ISSUE' && Boolean(document.sourceTransferId);
  const directIssue = document.type === 'ISSUE' && !document.sourceTransferId;
  return <Modal
    closeOnEscape={!state.loading}
    destructive
    footer={<><Button disabled={state.disabled} variant="outline" type="button" onClick={onClose}>Закрити</Button><Button disabled={state.disabled} variant="danger" type="button" onClick={onConfirm}>{state.loading ? 'Скасування…' : directIssue ? 'Скасувати видачу' : 'Скасувати документ'}</Button></>}
    onClose={onClose}
    title="Скасування документа"
  >
    <div className="grid gap-4 text-sm">
      {state.error ? <ErrorState message={state.error} /> : null}
      <p>Скасувати проведений документ <strong>{documentNumberLabel(document.displayNumber)}</strong>?</p>
      <div className="ui-alert" data-tone="warning" role="status">
        <strong>
          {documentaryIssue
            ? 'Доступну для оформлення кількість передачі буде відновлено'
            : directIssue
              ? 'Кількість буде повернено до вашого залишку'
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
