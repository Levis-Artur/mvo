'use client';

import { PageHeader } from '@/components/layout/page-header';
import {
  Button,
  Card,
  DataTable,
  StatusBadge,
} from '@/components/ui';
import { formatDateTime, fullName } from '@/components/common/formatters';
import { formatQuantity } from '@/features/inventory/quantity-format';
import { documentNumberLabel } from '@/features/stock-documents/stock-document-rules';
import { StockDocumentStatusBadge } from '@/features/stock-documents/stock-document-status-badge';
import type { AuthUser, StockDocument } from '@/lib/types';

export function MyTransferredPropertyCard({
  user,
  transfer,
  transferLineId,
  onBack,
  onIssue,
  onViewIssue,
}: {
  user: AuthUser;
  transfer: StockDocument;
  transferLineId: string;
  onBack: () => void;
  onIssue: () => void;
  onViewIssue: (issueId: string) => void;
}) {
  const line = transfer.lines.find((item) => item.id === transferLineId);
  if (!line) return null;

  const available = Number(line.availableToIssue ?? '0');
  const canIssue =
    transfer.status === 'POSTED' &&
    transfer.sourceResponsiblePersonId === user.responsiblePersonId &&
    available > 0;
  const recipient = transfer.destinationResponsiblePerson
    ? `${transfer.destinationResponsiblePerson.externalAccountingCode ?? transfer.destinationResponsiblePerson.personnelNumber} — ${fullName(transfer.destinationResponsiblePerson)}`
    : 'Одержувача не вказано';
  const issueRows = (transfer.issues ?? []).flatMap((issue) =>
    issue.lines
      .filter((issueLine) => issueLine.sourceTransferLineId === line.id)
      .map((issueLine) => ({ issue, issueLine })),
  );

  return (
    <section className="my-transferred-property-card grid min-w-0 gap-4">
      <PageHeader
        action={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={onBack}>
              Назад
            </Button>
            {canIssue ? (
              <Button type="button" onClick={onIssue}>
                Оформити видачу
              </Button>
            ) : null}
          </div>
        }
        description={`Код: ${line.inventoryItem.externalCode} · Одиниця: ${line.inventoryItem.unitOfMeasure ?? '—'}`}
        icon="box"
        title={line.inventoryItem.name}
      />

      <Card title="Передана позиція">
        <dl className="transfer-line-details">
          <Detail label="Передано">
            {formatQuantity(line.quantity)} {line.inventoryItem.unitOfMeasure ?? ''}
          </Detail>
          <Detail label="Видано">
            {formatQuantity(line.issuedQuantity ?? '0')} {line.inventoryItem.unitOfMeasure ?? ''}
          </Detail>
          <Detail label="Залишилось оформити видачу">
            {formatQuantity(line.availableToIssue ?? line.quantity)} {line.inventoryItem.unitOfMeasure ?? ''}
          </Detail>
          <Detail label="Кому передано">{recipient}</Detail>
          <Detail label="Передача">
            {documentNumberLabel(transfer.displayNumber)}
          </Detail>
          <Detail label="Дата">
            {new Date(transfer.documentDate).toLocaleDateString('uk-UA')}
          </Detail>
          <Detail label="Статус">
            <StockDocumentStatusBadge status={transfer.status} />
          </Detail>
        </dl>
        {!canIssue && available <= 0 ? (
          <div className="mt-3">
            <StatusBadge tone="neutral">Видано повністю</StatusBadge>
          </div>
        ) : null}
      </Card>

      <Card title="Видачі">
        <DataTable
          ariaLabel="Видачі переданої позиції"
          columns={[
            { label: 'Дата' },
            { label: 'Документ' },
            { label: 'Кому видано' },
            { label: 'Кількість', numeric: true },
            { label: 'Статус' },
            { label: 'Документ/файл' },
            { label: 'Дія', actions: true },
          ]}
          emptyMessage="Для цієї переданої позиції видач ще не оформлено."
          responsiveMode="cards-wide"
          rows={issueRows.map(({ issue, issueLine }) => {
            return [
              formatDateTime(issue.documentDate),
              documentNumberLabel(issue.displayNumber),
              issue.recipientName ?? '—',
              formatQuantity(issueLine.quantity),
              <StockDocumentStatusBadge key="status" status={issue.status} />,
              issue.attachments.length ? (
                <StatusBadge key="attachment" tone="info">
                  Є документ
                </StatusBadge>
              ) : '—',
              <Button
                key="view"
                size="compact"
                type="button"
                variant="outline"
                onClick={() => onViewIssue(issue.id)}
              >
                Переглянути видачу
              </Button>,
            ];
          })}
          tableClassName="my-transfer-issues-table"
        />
      </Card>
    </section>
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
