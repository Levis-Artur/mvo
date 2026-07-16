'use client';

import { ErrorMessage, Modal } from '@/components/common';
import type { StockDocument } from '@/lib/types';

export function CancelDocumentModal({ document, loading, error, onConfirm, onClose }: {
  document: StockDocument; loading: boolean; error: string; onConfirm: () => void; onClose: () => void;
}) {
  return <Modal title="Скасування документа" onClose={onClose}>
    <div className="grid gap-3 text-sm">
      <p>Скасувати проведений документ № {document.documentNumber}? Рух залишків буде сторновано backend.</p>
      {error ? <ErrorMessage message={error} /> : null}
      <div className="flex justify-end gap-2"><button className="btn btn-outline !w-auto" type="button" onClick={onClose}>Закрити</button><button className="btn btn-danger !w-auto" disabled={loading} type="button" onClick={onConfirm}>{loading ? 'Скасування...' : 'Скасувати документ'}</button></div>
    </div>
  </Modal>;
}
