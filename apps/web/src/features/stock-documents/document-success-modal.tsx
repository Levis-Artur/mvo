import { fullName } from '@/components/common';
import { Button, Card, Modal, StatusBadge } from '@/components/ui';
import { formatQuantity } from '@/features/inventory/quantity-format';
import type { StockDocument } from '@/lib/types';
import { documentNumberLabel, documentTypeLabel } from './stock-document-rules';

export function DocumentSuccessModal({ document, mode, onView, onReturn }: {
  document: StockDocument;
  mode: 'draft' | 'post';
  onView: () => void;
  onReturn: () => void;
}) {
  const recipient = document.destinationResponsiblePerson
    ? fullName(document.destinationResponsiblePerson)
    : document.recipientName ?? 'Не вказано';
  const itemNames = document.lines.slice(0, 2).map((line) => line.inventoryItem.name).join(', ');
  const moreItems = document.lines.length > 2 ? ` та ще ${document.lines.length - 2}` : '';
  return <Modal
    footer={<><Button variant="outline" type="button" onClick={onReturn}>Повернутися до мого майна</Button><Button type="button" onClick={onView}>Переглянути документ</Button></>}
    onClose={onView}
    size="medium"
    title={mode === 'draft' ? 'Чернетку збережено' : `${documentTypeLabel(document.type)} успішна`}
  >
    <div className="grid gap-4">
      {mode === 'draft' ? <div className="ui-alert" data-tone="success" role="status">Чернетку збережено. Ви можете повернутися до неї пізніше або провести документ зараз.</div> : <div className="ui-alert" data-tone="success" role="status">Документ проведено, дані про майно оновлено.</div>}
      <Card title="Підсумок">
        <dl className="detail-list">
          <Detail label={document.type === 'ISSUE' ? 'Що видано' : 'Що передано'}>{itemNames || 'Майно'}{moreItems}</Detail>
          <Detail label="Кількість позицій">{document.totalPositions}</Detail>
          <Detail label="Загальна кількість одиниць">{formatQuantity(document.totalQuantity)}</Detail>
          <Detail label={document.type === 'ISSUE' ? 'Кому видано' : 'Кому передано'}>{recipient}</Detail>
          <Detail label="Номер документа">{documentNumberLabel(document.displayNumber)}</Detail>
          {document.type === 'ISSUE' ? <Detail label="Накладна"><StatusBadge tone={document.attachments.length ? 'success' : 'warning'}>{document.attachments.length ? 'Прикріплена' : 'Не прикріплена'}</StatusBadge></Detail> : null}
        </dl>
      </Card>
    </div>
  </Modal>;
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt>{label}</dt><dd>{children}</dd></div>;
}
