import type { StockDocument } from '@/lib/types';
import { fullName } from '@/components/common/formatters';
import { Button, Card, ErrorState, Modal } from '@/components/ui';
import { formatQuantity } from '@/features/inventory/quantity-format';
import { documentNumberLabel, documentPostingBlocker, documentTypeLabel } from './stock-document-rules';

export function PostDocumentModal({ document, loading, error, simplified, onConfirm, onClose }: {
  document: StockDocument; loading: boolean; error: string; simplified: boolean; onConfirm: () => void; onClose: () => void;
}) {
  const postingBlocker = documentPostingBlocker(document);
  const recipient = document.destinationResponsiblePerson
    ? fullName(document.destinationResponsiblePerson)
    : document.recipientName ?? '—';
  return <Modal
    closeOnEscape={!loading}
    footer={<><Button disabled={loading} variant="outline" type="button" onClick={onClose}>Закрити</Button><Button disabled={loading || Boolean(postingBlocker)} type="button" onClick={onConfirm}>{loading ? 'Проведення…' : 'Провести'}</Button></>}
    onClose={onClose}
    title="Проведення документа"
  >
    <div className="grid gap-4 text-sm">
      {error ? <ErrorState message={error} /> : null}
      <Card title={`Документ: ${documentNumberLabel(document.documentNumber, simplified)}`}>
        <dl className="grid grid-cols-[auto_1fr] gap-2">
          <dt>Тип</dt><dd className="font-semibold">{documentTypeLabel(document.type)}</dd>
          <dt>Відправник</dt><dd>{fullName(document.sourceResponsiblePerson)}</dd>
          <dt>Одержувач</dt><dd>{recipient}</dd>
          <dt>Позицій</dt><dd>{document.totalPositions}</dd>
          <dt>Кількість</dt><dd>{formatQuantity(document.totalQuantity)}</dd>
        </dl>
      </Card>
      {postingBlocker ? <ErrorState message={postingBlocker} /> : null}
      {document.type === 'ASSIGNMENT' ? <div className="ui-alert" data-tone="info" role="status">Майно залишиться у вашому обліку, але буде позначене як таке, що знаходиться в обраного МВО.</div> : null}
      {document.type === 'ISSUE' ? <div className="ui-alert" data-tone="warning" role="status">Після проведення документа вказана кількість буде списана з обліку.</div> : null}
      <div className="ui-alert" data-tone="warning" role="status">
        <strong>Після проведення документ не можна редагувати</strong>
        <span>Перевірте одержувача, позиції та кількість. За потреби проведений документ можна буде скасувати окремою дією.</span>
      </div>
    </div>
  </Modal>;
}
