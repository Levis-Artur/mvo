import type { StockDocument } from '@/lib/types';
import { Button, ErrorState, Modal } from '@/components/ui';
import { documentActionState } from './stock-document-rules';

export function CancelDocumentModal({ document, loading, error, onConfirm, onClose }: {
  document: StockDocument; loading: boolean; error: string; onConfirm: () => void; onClose: () => void;
}) {
  const state = documentActionState(error, loading);
  return <Modal
    closeOnEscape={!state.loading}
    destructive
    footer={<><Button disabled={state.disabled} variant="outline" type="button" onClick={onClose}>Закрити</Button><Button disabled={state.disabled} variant="danger" type="button" onClick={onConfirm}>{state.loading ? 'Скасування…' : 'Скасувати документ'}</Button></>}
    onClose={onClose}
    title="Скасування документа"
  >
    <div className="grid gap-4 text-sm">
      {state.error ? <ErrorState message={state.error} /> : null}
      <p>Скасувати проведений документ № <strong>{document.documentNumber}</strong>?</p>
      <div className="ui-alert" data-tone="warning" role="status">
        <strong>Буде виконано reversal</strong>
        <span>Backend створить зворотні операції та відновить попередній вплив документа на залишки. Вихідні операції журналу не видаляються.</span>
      </div>
      <p className="text-[var(--color-text-secondary)]">Якщо скасування небезпечне через поточні залишки або залежності, backend заблокує дію. Повідомлення буде показано тут без приховування.</p>
    </div>
  </Modal>;
}
