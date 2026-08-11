import { formatDateTime } from '@/components/common/formatters';
import { Button, Card, DataTable, Modal, StatusBadge } from '@/components/ui';
import { formatQuantity } from '@/features/inventory/quantity-format';
import { StockDocumentAttachmentList } from '@/features/stock-documents/stock-document-attachment-list';
import type { AccountingMovementDetails } from '@/lib/types';

export function AccountingMovementDetailsModal({
  details,
  openingDocumentId = '',
  onOpenDocument,
  onClose,
}: {
  details: AccountingMovementDetails;
  openingDocumentId?: string;
  onOpenDocument?: (id: string) => void;
  onClose: () => void;
}) {
  const transfer = details.operationType === 'MVO_TRANSFER';
  const issue = details.operationType === 'ISSUE';
  const destination = details.destinationResponsiblePerson;

  return (
    <Modal
      footer={
        <Button type="button" variant="outline" onClick={onClose}>
          Закрити
        </Button>
      }
      onClose={onClose}
      size="large"
      title={`${operationTitle(details.operationType)}: ${details.documentLabel}`}
    >
      <div className="grid min-w-0 gap-4 text-sm">
        <Card title="Загальні дані">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Detail label="Документ">{details.documentLabel}</Detail>
            <Detail label="Дата">{formatDateTime(details.documentDate)}</Detail>
            <Detail label="Тип операції">
              <StatusBadge tone={operationTone(details.operationType)}>
                {operationLabel(details.operationType)}
              </StatusBadge>
            </Detail>
            <Detail label="Статус">{statusLabel(details.status)}</Detail>
            <Detail label="Автор">{details.author?.username ?? 'Не вказано'}</Detail>
            <Detail label="МВО-відправник">{details.responsiblePerson.fullName}</Detail>
            <Detail label="Код МВО">
              {details.responsiblePerson.externalAccountingCode
                ?? details.responsiblePerson.personnelNumber}
            </Detail>
            {destination ? (
              <Detail label="Кому передано">
                {destination.fullName}
              </Detail>
            ) : null}
            {destination ? (
              <Detail label="Код МВО одержувача">
                {destination.externalAccountingCode
                  ?? destination.personnelNumber}
              </Detail>
            ) : null}
            {issue && details.sourceTransfer ? (
              <Detail label="Пов’язана передача">
                {onOpenDocument ? (
                  <Button
                    disabled={openingDocumentId === details.sourceTransfer.id}
                    size="compact"
                    type="button"
                    variant="link"
                    onClick={() => onOpenDocument(details.sourceTransfer!.id)}
                  >
                    {openingDocumentId === details.sourceTransfer.id
                      ? 'Відкриття…'
                      : `Передача № ${details.sourceTransfer.displayNumber}`}
                  </Button>
                ) : (
                  `Передача № ${details.sourceTransfer.displayNumber}`
                )}
              </Detail>
            ) : null}
            {issue ? (
              <Detail label="Кому фактично видано">
                {details.counterparty?.fullName ?? '—'}
              </Detail>
            ) : null}
            {details.recipientUnit ? (
              <Detail label="Підрозділ одержувача">
                {details.recipientUnit}
              </Detail>
            ) : null}
            <Detail label="Підстава">{details.basis ?? '—'}</Detail>
            <Detail label="Примітка">{details.note ?? '—'}</Detail>
          </dl>
        </Card>

        <Card title="Позиції">
          <DataTable
            ariaLabel="Позиції документа руху майна"
            columns={
              transfer
                ? [
                    { label: 'Код' },
                    { label: 'Назва' },
                    { label: 'Одиниця' },
                    { label: 'Передано', numeric: true },
                    { label: 'Оформлено видач', numeric: true },
                    { label: 'Залишилось оформити', numeric: true },
                  ]
                : [
                    { label: 'Код номенклатури' },
                    { label: 'Назва' },
                    { label: 'Одиниця' },
                    { label: 'Кількість', numeric: true },
                    { label: 'Примітка' },
                  ]
            }
            emptyMessage="Позиції відсутні."
            responsiveMode="cards-wide"
            rows={details.lines.map((line) =>
              transfer
                ? [
                    line.inventoryItem.externalCode,
                    line.inventoryItem.name,
                    line.inventoryItem.unitOfMeasure ?? '—',
                    formatQuantity(line.quantity),
                    formatQuantity(line.issuedQuantity ?? '0'),
                    formatQuantity(line.availableToIssue ?? line.quantity),
                  ]
                : [
                    line.inventoryItem.externalCode,
                    line.inventoryItem.name,
                    line.inventoryItem.unitOfMeasure ?? '—',
                    formatQuantity(line.quantity),
                    line.note ?? '—',
                  ],
            )}
          />
        </Card>

        {transfer ? (
          <Card title="Оформлені видачі">
            <DataTable
              ariaLabel="Оформлені видачі з передачі"
              columns={[
                { label: '№' },
                { label: 'Дата' },
                { label: 'Кому видано' },
                { label: 'Кількість', numeric: true },
                { label: 'Статус' },
                { label: 'Документ/файл' },
                { label: 'Дія', actions: true },
              ]}
              emptyMessage="Видачі з цієї передачі ще не оформлювалися."
              responsiveMode="cards-wide"
              rows={details.issues.map((childIssue) => [
                `№ ${childIssue.displayNumber}`,
                formatDateTime(childIssue.documentDate),
                childIssue.recipientName ?? '—',
                formatQuantity(childIssue.quantity),
                <StatusBadge
                  key="status"
                  tone={childIssue.status === 'CANCELLED' ? 'danger' : 'success'}
                >
                  {statusLabel(childIssue.status)}
                </StatusBadge>,
                childIssue.attachments.length ? 'Є документ' : '—',
                onOpenDocument ? (
                  <Button
                    disabled={openingDocumentId === childIssue.id}
                    key="open"
                    size="compact"
                    type="button"
                    variant="outline"
                    onClick={() => onOpenDocument(childIssue.id)}
                  >
                    {openingDocumentId === childIssue.id
                      ? 'Відкриття…'
                      : 'Переглянути'}
                  </Button>
                ) : null,
              ])}
            />
          </Card>
        ) : null}

        {details.attachments.length ? (
          <Card title={issue ? 'Підтверджуючий документ' : 'Вкладення'}>
            <StockDocumentAttachmentList attachments={details.attachments} />
          </Card>
        ) : null}
      </div>
    </Modal>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0"><dt className="font-semibold text-[var(--color-text-secondary)]">{label}</dt><dd className="mt-1 break-words">{children}</dd></div>;
}

function operationTitle(operation: AccountingMovementDetails['operationType']) {
  if (operation === 'MVO_TRANSFER') return 'Передача';
  if (operation === 'ISSUE') return 'Видача';
  return 'Імпорт';
}

function operationLabel(operation: AccountingMovementDetails['operationType']) {
  if (operation === 'IMPORT') return 'Надходження';
  if (operation === 'MVO_TRANSFER') return 'Передача МВО';
  return 'Видача';
}

function operationTone(operation: AccountingMovementDetails['operationType']): 'success' | 'info' {
  return operation === 'IMPORT' ? 'success' : 'info';
}

function statusLabel(status: AccountingMovementDetails['status']) {
  if (status === 'POSTED' || status === 'COMPLETED') return 'Проведено';
  if (status === 'PARTIALLY_COMPLETED') return 'Проведено частково';
  if (status === 'CANCELLED') return 'Скасовано';
  return 'Не завершено';
}
