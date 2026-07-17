import type { StockDocument } from '@/lib/types';
import { fullName } from '@/components/common/formatters';
import { Button, Card, ErrorState, Modal } from '@/components/ui';
import { formatQuantity } from '@/features/inventory/quantity-format';

export function PostDocumentModal({ document, loading, error, onConfirm, onClose }: {
  document: StockDocument; loading: boolean; error: string; onConfirm: () => void; onClose: () => void;
}) {
  const recipient = document.destinationResponsiblePerson
    ? fullName(document.destinationResponsiblePerson)
    : document.recipientName ?? '—';
  return <Modal
    closeOnEscape={!loading}
    footer={<><Button disabled={loading} variant="outline" type="button" onClick={onClose}>Закрити</Button><Button disabled={loading} type="button" onClick={onConfirm}>{loading ? 'Проведення…' : 'Провести'}</Button></>}
    onClose={onClose}
    title="Проведення документа"
  >
    <div className="grid gap-4 text-sm">
      {error ? <ErrorState message={error} /> : null}
      <Card title={`Документ № ${document.documentNumber}`}>
        <dl className="grid grid-cols-[auto_1fr] gap-2">
          <dt>Тип</dt><dd className="font-semibold">{document.type === 'TRANSFER' ? 'Передача' : 'Видача'}</dd>
          <dt>Відправник</dt><dd>{fullName(document.sourceResponsiblePerson)}</dd>
          <dt>Одержувач</dt><dd>{recipient}</dd>
          <dt>Позицій</dt><dd>{document.totalPositions}</dd>
          <dt>Кількість</dt><dd>{formatQuantity(document.totalQuantity)}</dd>
        </dl>
      </Card>
      <div className="ui-alert" data-tone="warning" role="status">
        <strong>Після проведення документ не можна редагувати</strong>
        <span>Залишки буде змінено транзакційно. Для виправлення проведеного документа використовується скасування зі зворотними операціями.</span>
      </div>
    </div>
  </Modal>;
}
