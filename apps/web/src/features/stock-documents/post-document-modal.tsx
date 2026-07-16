'use client';

import { ErrorMessage, Modal } from '@/components/common';
import { fullName } from '@/components/common/formatters';
import type { StockDocument } from '@/lib/types';

export function PostDocumentModal({ document, loading, error, onConfirm, onClose }: {
  document: StockDocument; loading: boolean; error: string; onConfirm: () => void; onClose: () => void;
}) {
  const recipient = document.destinationResponsiblePerson
    ? fullName(document.destinationResponsiblePerson)
    : document.recipientName ?? '—';
  return <Modal title="Проведення документа" onClose={onClose}>
    <div className="grid gap-3 text-sm">
      <dl className="grid grid-cols-2 gap-2 rounded border border-[var(--border)] p-3">
        <dt>Номер</dt><dd>{document.documentNumber}</dd><dt>Тип</dt><dd>{document.type === 'TRANSFER' ? 'Передача' : 'Видача'}</dd>
        <dt>Відправник</dt><dd>{fullName(document.sourceResponsiblePerson)}</dd><dt>Одержувач</dt><dd>{recipient}</dd>
        <dt>Позицій</dt><dd>{document.totalPositions}</dd><dt>Кількість</dt><dd>{document.totalQuantity}</dd>
      </dl>
      <p className="rounded border border-amber-300 bg-amber-50 p-3 text-amber-900">Після проведення документ не можна редагувати.</p>
      {error ? <ErrorMessage message={error} /> : null}
      <div className="flex justify-end gap-2"><button className="btn btn-outline !w-auto" type="button" onClick={onClose}>Закрити</button><button className="btn btn-primary !w-auto" disabled={loading} type="button" onClick={onConfirm}>{loading ? 'Проведення...' : 'Провести'}</button></div>
    </div>
  </Modal>;
}
