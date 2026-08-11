'use client';

import { PageHeader } from '@/components/layout/page-header';
import {
  Button,
  Card,
} from '@/components/ui';
import { fullName } from '@/components/common/formatters';
import { formatQuantity } from '@/features/inventory/quantity-format';
import { documentNumberLabel } from '@/features/stock-documents/stock-document-rules';
import { StockDocumentStatusBadge } from '@/features/stock-documents/stock-document-status-badge';
import type { StockDocument } from '@/lib/types';

export function MyTransferredPropertyCard({
  transfer,
  transferLineId,
  onBack,
}: {
  transfer: StockDocument;
  transferLineId: string;
  onBack: () => void;
}) {
  const line = transfer.lines.find((item) => item.id === transferLineId);
  if (!line) return null;

  const recipient = transfer.destinationResponsiblePerson
    ? `${transfer.destinationResponsiblePerson.externalAccountingCode ?? transfer.destinationResponsiblePerson.personnelNumber} — ${fullName(transfer.destinationResponsiblePerson)}`
    : 'Одержувача не вказано';

  return (
    <section className="my-transferred-property-card grid min-w-0 gap-4">
      <PageHeader
        action={
          <Button type="button" variant="outline" onClick={onBack}>
            Назад
          </Button>
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
