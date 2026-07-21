import type { StockDocument } from '@/lib/types';
import { Button, ErrorState, Modal } from '@/components/ui';
import { documentNumberLabel } from './stock-document-rules';

export function DeleteDocumentModal({ document, loading, error, simplified, onConfirm, onClose }: {
  document: StockDocument; loading: boolean; error: string; simplified: boolean; onConfirm: () => void; onClose: () => void;
}) {
  return <Modal closeOnEscape={!loading} destructive footer={<><Button disabled={loading} variant="outline" type="button" onClick={onClose}>Закрити</Button><Button disabled={loading} variant="danger" type="button" onClick={onConfirm}>{loading ? 'Видалення…' : 'Видалити чернетку'}</Button></>} onClose={onClose} title="Видалення чернетки">
    <div className="grid gap-3"><p>Видалити чернетку документа <strong>{documentNumberLabel(document.documentNumber, simplified)}</strong>?</p><p className="text-sm text-[var(--color-text-secondary)]">Проведені та скасовані документи видаляти не можна.</p>{error ? <ErrorState message={error} /> : null}</div>
  </Modal>;
}
