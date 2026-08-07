import { formatDateTime } from '@/components/common/formatters';
import { Button, Card, DataTable, Modal, StatusBadge } from '@/components/ui';
import { formatQuantity } from '@/features/inventory/quantity-format';
import type { AccountingMovementDetails } from '@/lib/types';
import { accountingMovementsService } from './accounting-movements.service';

export function AccountingMovementDetailsModal({
  details,
  onClose,
}: {
  details: AccountingMovementDetails;
  onClose: () => void;
}) {
  return (
    <Modal
      footer={<Button type="button" variant="outline" onClick={onClose}>Закрити</Button>}
      onClose={onClose}
      size="large"
      title={`Рух майна: ${details.documentLabel}`}
    >
      <div className="grid min-w-0 gap-4 text-sm">
        <Card title="Загальні дані">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Detail label="Документ">{details.documentLabel}</Detail>
            <Detail label="Дата">{formatDateTime(details.documentDate)}</Detail>
            <Detail label="Операція">
              <StatusBadge tone={operationTone(details.operationType)}>
                {operationLabel(details.operationType)}
              </StatusBadge>
            </Detail>
            <Detail label="Статус">{statusLabel(details.status)}</Detail>
            <Detail label="Автор">{details.author?.username ?? 'Не вказано'}</Detail>
            <Detail label="МВО">{personLabel(details.responsiblePerson)}</Detail>
            <Detail label="Контрагент / одержувач">
              {details.counterparty ? counterpartyLabel(details.counterparty) : '—'}
            </Detail>
            <Detail label="Підрозділ одержувача">{details.recipientUnit ?? '—'}</Detail>
            <Detail label="Підстава">{details.basis ?? '—'}</Detail>
            <Detail label="Примітка">{details.note ?? '—'}</Detail>
          </dl>
        </Card>

        <Card title="Позиції">
          <DataTable
            ariaLabel="Позиції документа руху майна"
            columns={[
              { label: 'Код МВО' },
              { label: 'МВО' },
              { label: 'Код номенклатури' },
              { label: 'Назва' },
              { label: 'Одиниця' },
              { label: 'Кількість', numeric: true },
              { label: 'Примітка' },
            ]}
            emptyMessage="Позиції відсутні."
            responsiveMode="cards-wide"
            rows={details.lines.map((line) => [
              line.responsiblePerson.externalAccountingCode ?? line.responsiblePerson.personnelNumber,
              line.responsiblePerson.fullName,
              line.inventoryItem.externalCode,
              line.inventoryItem.name,
              line.inventoryItem.unitOfMeasure ?? '—',
              formatQuantity(line.quantity),
              line.note ?? '—',
            ])}
          />
        </Card>

        {details.attachments.length ? (
          <Card title="Вкладення">
            <div className="grid min-w-0 gap-2">
              {details.attachments.map((attachment) => (
                <a
                  className="min-w-0 break-words font-semibold text-[var(--color-primary)] underline"
                  href={accountingMovementsService.attachmentDownloadUrl(attachment.documentId, attachment.id)}
                  key={attachment.id}
                >
                  {attachment.originalFileName} · {formatFileSize(attachment.sizeBytes)}
                </a>
              ))}
            </div>
          </Card>
        ) : null}
      </div>
    </Modal>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0"><dt className="font-semibold text-[var(--color-text-secondary)]">{label}</dt><dd className="mt-1 break-words">{children}</dd></div>;
}

function personLabel(person: AccountingMovementDetails['responsiblePerson']) {
  return `${person.externalAccountingCode ?? person.personnelNumber} — ${person.fullName}`;
}

function counterpartyLabel(person: NonNullable<AccountingMovementDetails['counterparty']>) {
  return person.externalAccountingCode
    ? `${person.externalAccountingCode} — ${person.fullName}`
    : person.fullName;
}

function operationLabel(operation: AccountingMovementDetails['operationType']) {
  if (operation === 'IMPORT') return 'Надходження';
  if (operation === 'MVO_TRANSFER') return 'Передача';
  if (operation === 'ISSUE') return 'Видача';
  return 'Скасування';
}

function operationTone(operation: AccountingMovementDetails['operationType']): 'success' | 'info' | 'warning' {
  if (operation === 'IMPORT') return 'success';
  if (operation === 'CANCELLATION') return 'warning';
  return 'info';
}

function statusLabel(status: AccountingMovementDetails['status']) {
  if (status === 'POSTED' || status === 'COMPLETED') return 'Проведено';
  if (status === 'PARTIALLY_COMPLETED') return 'Проведено частково';
  if (status === 'CANCELLED') return 'Скасовано';
  return 'Не завершено';
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}
