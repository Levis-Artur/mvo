import type { AuthUser, StockDocument } from '@/lib/types';
import { formatDateTime, fullName } from '@/components/common/formatters';
import { Button, Card, DataTable, ErrorState, Modal, StatusBadge } from '@/components/ui';
import { formatQuantity } from '@/features/inventory/quantity-format';
import {
  documentDirectionPresentation,
  documentNumberLabel,
  lifecycleActions,
} from './stock-document-rules';
import { StockDocumentStatusBadge } from './stock-document-status-badge';
import { formatFileSize } from './stock-document-attachments-model';
import { stockDocumentsService } from './stock-documents.service';

export function StockDocumentDetailsModal({ document, user, loading, error, readOnly = false, onEdit, onPost, onCancel, onDelete, onClose }: {
  document: StockDocument; user: AuthUser; loading: boolean; error: string;
  readOnly?: boolean;
  onEdit: () => void; onPost: () => void; onCancel: () => void; onDelete: () => void; onClose: () => void;
}) {
  const actions = readOnly
    ? { edit: false, post: false, cancel: false, remove: false }
    : lifecycleActions(document, user);
  const direction = documentDirectionPresentation(document);
  const recipient = document.destinationResponsiblePerson
    ? fullName(document.destinationResponsiblePerson)
    : document.recipientName ?? '—';
  return <Modal
    closeOnEscape={!loading}
    footer={<>
      {actions.edit ? <Button disabled={loading} variant="outline" type="button" onClick={onEdit}>Редагувати</Button> : null}
      {actions.post ? <Button disabled={loading} type="button" onClick={onPost}>Провести</Button> : null}
      {actions.cancel ? <Button disabled={loading} variant="danger" type="button" onClick={onCancel}>Скасувати документ</Button> : null}
      {actions.remove ? <Button disabled={loading} variant="danger" type="button" onClick={onDelete}>Видалити чернетку</Button> : null}
      <Button disabled={loading} variant="outline" type="button" onClick={onClose}>Закрити</Button>
    </>}
    onClose={onClose}
    size="large"
    title={`Документ: ${documentNumberLabel(document.displayNumber)}`}
  >
    <div className="grid gap-4 text-sm">
      {error ? <ErrorState message={error} /> : null}
      {document.type === 'TRANSFER' || document.type === 'ASSIGNMENT' ? <div className="ui-alert" data-tone="info" role="status"><strong>Стара передача</strong><span>Цей документ створено за старими правилами та доступний лише для перегляду.</span></div> : null}
      <Card title="Загальні дані">
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="Дата">{formatDateTime(document.documentDate)}</Detail>
          <Detail label="Тип"><StatusBadge tone={direction.tone}>{direction.label}</StatusBadge></Detail>
          <Detail label="Статус"><StockDocumentStatusBadge status={document.status} /></Detail>
          <Detail label="Відправник">{fullName(document.sourceResponsiblePerson)}</Detail>
          <Detail label="Одержувач">{recipient}</Detail>
          {document.recipientUnit ? <Detail label="Підрозділ одержувача">{document.recipientUnit}</Detail> : null}
          <Detail label="Автор">{document.createdByUser.username}</Detail>
          <Detail label="Проведено">{document.postedAt ? `${formatDateTime(document.postedAt)} · ${document.postedByUser?.username ?? '—'}` : '—'}</Detail>
          <Detail label="Скасовано">{document.cancelledAt ? `${formatDateTime(document.cancelledAt)} · ${document.cancelledByUser?.username ?? '—'}` : '—'}</Detail>
          <Detail label="Підстава">{document.basis ?? '—'}</Detail>
          <Detail label="Примітка">{document.note ?? '—'}</Detail>
        </dl>
      </Card>
      <DataTable
        ariaLabel="Рядки документа"
        columns={user.role === 'MVO' ? [
          { label: 'Код' }, { label: 'Назва' }, { label: 'Одиниця' },
          { label: 'Кількість', numeric: true }, { label: 'Примітка' },
        ] : [
          { label: 'Код' }, { label: 'Номенклатура' }, { label: 'Джерело' }, { label: 'Одиниця' },
          { label: 'Кількість', numeric: true }, { label: 'Примітка' },
        ]}
        rows={document.lines.map((line) => user.role === 'MVO' ? [
          line.inventoryItem.externalCode, line.inventoryItem.name,
          line.inventoryItem.unitOfMeasure ?? '—', formatQuantity(line.quantity), line.note ?? '—',
        ] : [
          line.inventoryItem.externalCode, line.inventoryItem.name,
          document.type === 'MVO_TRANSFER'
            ? <StatusBadge key="source" tone="success">Залишок МВО</StatusBadge>
            : <StatusBadge key="legacy" tone="neutral">Стара логіка</StatusBadge>,
          line.inventoryItem.unitOfMeasure ?? '—', formatQuantity(line.quantity), line.note ?? '—',
        ])}
      />
      {document.attachments.length ? <Card title="Вкладення">
        <div className="grid gap-2">
          {document.attachments.map((attachment) => <a className="break-all font-semibold text-[var(--color-primary)] underline" href={stockDocumentsService.attachmentDownloadUrl(document.id, attachment.id)} key={attachment.id}>{attachment.originalFileName} · {formatFileSize(attachment.sizeBytes)}</a>)}
        </div>
      </Card> : null}
      <div className="flex justify-end gap-6 font-semibold">
        <span>Позицій: {document.totalPositions}</span>
        <span>Загальна кількість: {formatQuantity(document.totalQuantity)}</span>
      </div>
    </div>
  </Modal>;
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0"><dt className="font-semibold text-[var(--color-text-secondary)]">{label}</dt><dd className="mt-1 break-words">{children}</dd></div>;
}
