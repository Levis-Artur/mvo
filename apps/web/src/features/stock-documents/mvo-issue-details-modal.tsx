'use client';

import { formatDateTime } from '@/components/common/formatters';
import {
  Button,
  Card,
  DataTable,
  ErrorState,
  Modal,
} from '@/components/ui';
import { formatQuantity } from '@/features/inventory/quantity-format';
import type { StockDocument } from '@/lib/types';
import { documentNumberLabel } from './stock-document-rules';
import { StockDocumentAttachmentList } from './stock-document-attachment-list';
import { StockDocumentStatusBadge } from './stock-document-status-badge';

export function MvoIssueDetailsModal({
  document,
  loading,
  error,
  onCancel,
  onClose,
}: {
  document: StockDocument;
  loading: boolean;
  error: string;
  onCancel: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      closeOnEscape={!loading}
      footer={
        <>
          {document.status === 'POSTED' ? (
            <Button
              disabled={loading}
              type="button"
              variant="danger"
              onClick={onCancel}
            >
              Скасувати видачу
            </Button>
          ) : null}
          <Button
            disabled={loading}
            type="button"
            variant="outline"
            onClick={onClose}
          >
            Закрити
          </Button>
        </>
      }
      onClose={onClose}
      size="large"
      title={`Видача ${documentNumberLabel(document.displayNumber)}`}
    >
      <div className="issue-details">
        {error ? <ErrorState message={error} /> : null}
        <Card title="Загальні дані">
          <dl className="issue-details__summary">
            <Detail label="Дата">
              {new Date(document.documentDate).toLocaleDateString('uk-UA')}
            </Detail>
            <Detail label="Кому видано">
              {document.recipientName ?? 'Не вказано'}
            </Detail>
            <Detail label="Статус">
              <StockDocumentStatusBadge status={document.status} />
            </Detail>
            <Detail label="Коментар">{document.note ?? '—'}</Detail>
            <Detail label="Створено">
              {formatDateTime(document.createdAt)}
            </Detail>
          </dl>
        </Card>

        <Card title="Позиції">
          <DataTable
            ariaLabel={`Позиції видачі ${documentNumberLabel(document.displayNumber)}`}
            columns={[
              { label: 'Код', className: 'issue-lines__code' },
              { label: 'Назва', className: 'issue-lines__name' },
              { label: 'Кількість', numeric: true, className: 'issue-lines__quantity' },
              { label: 'Одиниця', className: 'issue-lines__unit' },
            ]}
            responsiveMode="cards-wide"
            rows={document.lines.map((line) => [
              line.inventoryItem.externalCode,
              line.inventoryItem.name,
              formatQuantity(line.quantity),
              line.inventoryItem.unitOfMeasure ?? '—',
            ])}
            tableClassName="issue-details__lines"
          />
        </Card>

        <Card title="Підтверджуючий документ">
          {document.attachments.length ? (
            <StockDocumentAttachmentList attachments={document.attachments} />
          ) : (
            <p className="text-sm text-[var(--color-text-secondary)]">
              Файл не прикріплено.
            </p>
          )}
        </Card>
      </div>
    </Modal>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
