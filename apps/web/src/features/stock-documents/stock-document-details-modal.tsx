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
import { StockDocumentAttachmentList } from './stock-document-attachment-list';

export function StockDocumentDetailsModal({ document, user, loading, error, readOnly = false, onEdit, onPost, onCancel, onDelete, onViewIssue, onOpenSourceTransfer, onClose }: {
  document: StockDocument; user: AuthUser; loading: boolean; error: string;
  readOnly?: boolean;
  onEdit: () => void; onPost: () => void; onCancel: () => void; onDelete: () => void;
  onViewIssue?: (issueId: string) => void;
  onOpenSourceTransfer?: (transferId: string) => void;
  onClose: () => void;
}) {
  const actions = readOnly
    ? { edit: false, post: false, cancel: false, remove: false }
    : lifecycleActions(document, user);
  const direction = documentDirectionPresentation(document);
  const recipient = document.destinationResponsiblePerson
    ? fullName(document.destinationResponsiblePerson)
    : document.recipientName ?? '—';
  const showLegacyIssueTracking =
    user.role !== 'MVO' && document.type === 'MVO_TRANSFER';
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
    title={`${document.type === 'ISSUE' ? 'Видача' : document.type === 'MVO_TRANSFER' ? 'Передача' : 'Документ'} ${documentNumberLabel(document.displayNumber)}`}
  >
    <div className="grid gap-4 text-sm">
      {error ? <ErrorState message={error} /> : null}
      {document.type === 'MVO_TRANSFER' && document.accountingExportState === 'EXPORTED' ? <div className="ui-alert" data-tone="info" role="status"><strong>Передано бухгалтерії</strong><span>Звичайне скасування цієї передачі недоступне.</span></div> : null}
      {document.type === 'TRANSFER' || document.type === 'ASSIGNMENT' ? <div className="ui-alert" data-tone="info" role="status"><strong>Стара передача</strong><span>Цей документ створено за старими правилами та доступний лише для перегляду.</span></div> : null}
      <Card title="Загальні дані">
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="Дата">{formatDateTime(document.documentDate)}</Detail>
          <Detail label="Тип"><StatusBadge tone={direction.tone}>{direction.label}</StatusBadge></Detail>
          <Detail label="Статус"><StockDocumentStatusBadge status={document.status} /></Detail>
          <Detail label="Відправник">{fullName(document.sourceResponsiblePerson)}</Detail>
          <Detail label="Одержувач">{recipient}</Detail>
          {user.role !== 'MVO' && document.sourceTransfer ? <Detail label="Передача-підстава">
            {onOpenSourceTransfer ? <Button type="button" variant="link" onClick={() => onOpenSourceTransfer(document.sourceTransfer!.id)}>{documentNumberLabel(document.sourceTransfer.displayNumber)}</Button> : documentNumberLabel(document.sourceTransfer.displayNumber)}
          </Detail> : null}
          {user.role !== 'MVO' && document.sourceTransfer?.destinationResponsiblePerson ? <Detail label="Кому передано за передачею">{fullName(document.sourceTransfer.destinationResponsiblePerson)}</Detail> : null}
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
        columns={showLegacyIssueTracking ? [
          { label: 'Код' }, { label: 'Назва' }, { label: 'Одиниця' },
          { label: 'Передано', numeric: true }, { label: 'Видано', numeric: true },
          { label: 'Залишилось оформити', numeric: true }, { label: 'Примітка' },
        ] : user.role === 'MVO' ? [
          { label: 'Код' }, { label: 'Назва' }, { label: 'Одиниця' },
          { label: 'Кількість', numeric: true }, { label: 'Примітка' },
        ] : [
          { label: 'Код' }, { label: 'Номенклатура' }, { label: 'Джерело' }, { label: 'Одиниця' },
          { label: 'Кількість', numeric: true }, { label: 'Примітка' },
        ]}
        responsiveMode="cards-wide"
        rows={document.lines.map((line) => showLegacyIssueTracking ? [
          line.inventoryItem.externalCode, line.inventoryItem.name,
          line.inventoryItem.unitOfMeasure ?? '—', formatQuantity(line.quantity),
          formatQuantity(line.issuedQuantity ?? '0'),
          formatQuantity(line.availableToIssue ?? line.quantity), line.note ?? '—',
        ] : user.role === 'MVO' ? [
          line.inventoryItem.externalCode, line.inventoryItem.name,
          line.inventoryItem.unitOfMeasure ?? '—', formatQuantity(line.quantity), line.note ?? '—',
        ] : [
          line.inventoryItem.externalCode, line.inventoryItem.name,
          document.type === 'ISSUE' && document.sourceTransferId
            ? <StatusBadge key="source" tone="info">З передачі</StatusBadge>
            : <StatusBadge key="legacy" tone="neutral">Стара логіка</StatusBadge>,
          line.inventoryItem.unitOfMeasure ?? '—', formatQuantity(line.quantity), line.note ?? '—',
        ])}
      />
      {showLegacyIssueTracking && (document.issues?.length ?? 0) > 0 ? (
        <Card title="Оформлені видачі">
          <DataTable
            ariaLabel="Видачі з цієї передачі"
            columns={[
              { label: 'Дата' }, { label: 'Документ' }, { label: 'Кому видано' },
              { label: 'Позицій', numeric: true }, { label: 'Статус' },
              { label: 'Документ/файл' }, { label: 'Дія', actions: true },
            ]}
            responsiveMode="cards-wide"
            rows={(document.issues ?? []).map((issue) => [
              formatDateTime(issue.documentDate),
              documentNumberLabel(issue.displayNumber),
              issue.recipientName ?? '—',
              String(issue.totalPositions),
              <StockDocumentStatusBadge key="status" status={issue.status} />,
              issue.attachments.length ? <StatusBadge key="attachment" tone="info">Є документ</StatusBadge> : '—',
              onViewIssue ? <Button key="view" size="compact" type="button" variant="outline" onClick={() => onViewIssue(issue.id)}>Переглянути видачу</Button> : null,
            ])}
          />
        </Card>
      ) : null}
      {document.attachments.length ? <Card title={document.type === 'ISSUE' ? 'Підтверджуючий документ' : 'Вкладення'}>
        <StockDocumentAttachmentList attachments={document.attachments} />
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
