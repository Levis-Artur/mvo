'use client';

import { useState } from 'react';
import { formatDateTime } from '@/components/common/formatters';
import {
  Button,
  Card,
  DataTable,
  ErrorState,
  Modal,
  StatusBadge,
} from '@/components/ui';
import { formatQuantity } from '@/features/inventory/quantity-format';
import type { IssueRealization, StockDocument } from '@/lib/types';
import { IssueRealizationAttachmentList } from './issue-realization-attachment-list';
import { documentNumberLabel } from './stock-document-rules';
import { StockDocumentAttachmentList } from './stock-document-attachment-list';
import { StockDocumentStatusBadge } from './stock-document-status-badge';

export function MvoIssueDetailsModal({
  document,
  loading,
  error,
  onCancel,
  onCancelRealization,
  onClose,
  onRealize,
}: {
  document: StockDocument;
  loading: boolean;
  error: string;
  onCancel: () => void;
  onCancelRealization: (realization: IssueRealization) => void;
  onClose: () => void;
  onRealize: () => void;
}) {
  const [selectedRealization, setSelectedRealization] =
    useState<IssueRealization | null>(null);
  const realizations = document.realizations ?? [];
  const canRealize =
    document.status === 'POSTED' && Number(document.availableToRealize ?? 0) > 0;
  const hasActiveRealizations = realizations.some(
    (realization) => realization.status === 'POSTED',
  );
  return (
    <>
      <Modal
      closeOnEscape={!loading}
      footer={
        <>
          {canRealize ? (
            <Button disabled={loading} type="button" onClick={onRealize}>
              Реалізувати
            </Button>
          ) : null}
          {document.status === 'POSTED' ? (
            <Button
              disabled={loading || hasActiveRealizations}
              title={
                hasActiveRealizations
                  ? 'Спочатку скасуйте всі проведені реалізації'
                  : undefined
              }
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
            <Detail label="Видано">
              {formatQuantity(document.issuedQuantity ?? document.totalQuantity)}
            </Detail>
            <Detail label="Реалізовано">
              {formatQuantity(document.realizedQuantity ?? '0')}
            </Detail>
            <Detail label="Залишилось реалізувати">
              {formatQuantity(document.availableToRealize ?? document.totalQuantity)}
            </Detail>
          </dl>
          {hasActiveRealizations ? (
            <p className="form-field__hint">
              Щоб скасувати видачу, спочатку скасуйте всі проведені реалізації.
            </p>
          ) : null}
        </Card>

        <Card title="Позиції">
          <DataTable
            ariaLabel={`Позиції видачі ${documentNumberLabel(document.displayNumber)}`}
            columns={[
              { label: 'Код', className: 'issue-lines__code' },
              { label: 'Назва', className: 'issue-lines__name' },
              { label: 'Видано', numeric: true, className: 'issue-lines__quantity' },
              { label: 'Реалізовано', numeric: true, className: 'issue-lines__quantity' },
              { label: 'Залишилось', numeric: true, className: 'issue-lines__quantity' },
              { label: 'Одиниця', className: 'issue-lines__unit' },
            ]}
            responsiveMode="cards-wide"
            rows={document.lines.map((line) => [
              line.inventoryItem.externalCode,
              line.inventoryItem.name,
              formatQuantity(line.quantity),
              formatQuantity(line.realizedQuantity ?? '0'),
              formatQuantity(line.availableToRealize ?? line.quantity),
              line.inventoryItem.unitOfMeasure ?? '—',
            ])}
            tableClassName="issue-details__lines"
          />
        </Card>

        <Card title="Історія реалізації виданого">
          {realizations.length ? (
            <DataTable
              ariaLabel="Історія реалізації виданого"
              columns={[
                { label: '№' },
                { label: 'Дата' },
                { label: 'Кількість', numeric: true },
                { label: 'Статус' },
                { label: 'Документ' },
                { label: 'Дія', actions: true },
              ]}
              responsiveMode="cards-wide"
              rows={realizations.map((realization) => [
                `№ ${realization.displayNumber}`,
                new Date(realization.realizationDate).toLocaleDateString('uk-UA'),
                formatQuantity(realization.totalQuantity),
                <StatusBadge
                  key="status"
                  tone={realization.status === 'POSTED' ? 'success' : 'neutral'}
                >
                  {realization.status === 'POSTED' ? 'Проведено' : 'Скасовано'}
                </StatusBadge>,
                realization.hasAttachment ? (
                  <StatusBadge key="attachment" tone="info">Є документ</StatusBadge>
                ) : '—',
                <Button
                  key="open"
                  size="compact"
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedRealization(realization)}
                >
                  Переглянути
                </Button>,
              ])}
            />
          ) : (
            <p className="text-sm text-[var(--color-text-secondary)]">
              Видане майно ще не реалізовували.
            </p>
          )}
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
      {selectedRealization ? (
        <IssueRealizationDetailsModal
          issueDisplayNumber={document.displayNumber}
          issueId={document.id}
          realization={selectedRealization}
          saving={loading}
          onCancel={() => {
            onCancelRealization(selectedRealization);
            setSelectedRealization(null);
          }}
          onClose={() => setSelectedRealization(null)}
        />
      ) : null}
    </>
  );
}

function IssueRealizationDetailsModal({
  issueId,
  issueDisplayNumber,
  realization,
  saving,
  onCancel,
  onClose,
}: {
  issueId: string;
  issueDisplayNumber: number;
  realization: IssueRealization;
  saving: boolean;
  onCancel: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      closeOnEscape={!saving}
      footer={
        <>
          {realization.status === 'POSTED' ? (
            <Button disabled={saving} type="button" variant="danger" onClick={onCancel}>
              Скасувати реалізацію
            </Button>
          ) : null}
          <Button disabled={saving} type="button" variant="outline" onClick={onClose}>
            Закрити
          </Button>
        </>
      }
      onClose={onClose}
      size="large"
      title={`Реалізація № ${realization.displayNumber}`}
    >
      <div className="issue-details">
        <Card title="Загальні дані">
          <dl className="issue-details__summary">
            <Detail label="Дата">
              {new Date(realization.realizationDate).toLocaleDateString('uk-UA')}
            </Detail>
            <Detail label="Видача">
              {documentNumberLabel(issueDisplayNumber)}
            </Detail>
            <Detail label="Одержувач">
              {realization.recipientText ?? 'Не вказано'}
            </Detail>
            <Detail label="Коментар">{realization.note ?? '—'}</Detail>
            <Detail label="Статус">
              <StatusBadge tone={realization.status === 'POSTED' ? 'success' : 'neutral'}>
                {realization.status === 'POSTED' ? 'Проведено' : 'Скасовано'}
              </StatusBadge>
            </Detail>
          </dl>
        </Card>
        <Card title="Позиції">
          <DataTable
            ariaLabel={`Позиції реалізації № ${realization.displayNumber}`}
            columns={[
              { label: 'Код' },
              { label: 'Назва' },
              { label: 'Кількість', numeric: true },
              { label: 'Одиниця' },
            ]}
            responsiveMode="cards-wide"
            rows={realization.lines.map((line) => [
              line.inventoryItem.externalCode,
              line.inventoryItem.name,
              formatQuantity(line.quantity),
              line.inventoryItem.unitOfMeasure ?? '—',
            ])}
          />
        </Card>
        {realization.attachments.length ? (
          <Card title="Підтверджуючі документи">
            <IssueRealizationAttachmentList
              attachments={realization.attachments}
              issueId={issueId}
              realizationId={realization.id}
            />
          </Card>
        ) : null}
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
