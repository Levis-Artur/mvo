import { formatDateTime } from '@/components/common/formatters';
import { Button, DataTable, StatusBadge } from '@/components/ui';
import { stockDocumentsService } from '@/features/stock-documents/stock-documents.service';
import type {
  InventoryItemAccountingCard,
  InventoryItemCardDocument,
} from '@/lib/types';
import {
  movementDisplayQuantity,
  movementTone,
} from './inventory-item-card-model';
import { formatQuantity } from './quantity-format';

export function InventoryBalancesTable({
  card,
  loading,
}: {
  card: InventoryItemAccountingCard | null;
  loading: boolean;
}) {
  return (
    <DataTable
      ariaLabel="Поточні залишки номенклатури по МВО"
      columns={[
        { label: 'Номер МВО' },
        { label: 'ПІБ' },
        { label: 'Управління' },
        { label: 'Служба' },
        { label: 'Підрозділ' },
        { label: 'Поточна кількість', numeric: true },
        { label: 'Остання зміна' },
      ]}
      emptyMessage="Поточних залишків за цією позицією немає."
      loading={loading && !card}
      rows={(card?.currentBalances ?? []).map((balance) => [
        balance.responsiblePerson.personnelNumber,
        balance.responsiblePerson.fullName,
        balance.responsiblePerson.management.name,
        balance.responsiblePerson.service.name,
        balance.responsiblePerson.unit?.name ?? '—',
        formatQuantity(balance.quantity),
        formatDateTime(balance.updatedAt),
      ])}
    />
  );
}

export function InventoryMovementsTable({
  card,
  loading,
}: {
  card: InventoryItemAccountingCard | null;
  loading: boolean;
}) {
  return (
    <DataTable
      ariaLabel="Історія руху номенклатури"
      columns={[
        { label: 'Дата і час' },
        { label: 'Тип операції' },
        { label: 'Звідки' },
        { label: 'Куди або кому' },
        { label: 'Кількість', numeric: true },
        { label: 'Було', numeric: true },
        { label: 'Стало', numeric: true },
        { label: 'Номер документа' },
        { label: 'Джерело' },
        { label: 'Користувач' },
      ]}
      emptyMessage="Рухів за вибраними фільтрами не знайдено."
      loading={loading && !card}
      rows={(card?.movements.items ?? []).map((movement) => [
        formatDateTime(movement.occurredAt),
        <StatusBadge key="type" tone={movementTone(movement.category)}>
          {movement.typeLabel}
        </StatusBadge>,
        movement.from,
        movement.to,
        formatSignedQuantity(movementDisplayQuantity(movement)),
        formatQuantity(movement.balanceBefore),
        formatQuantity(movement.balanceAfter),
        movement.documentNumber,
        movement.source,
        movement.user ?? '—',
      ])}
    />
  );
}

function formatSignedQuantity(value: string) {
  return value.startsWith('+')
    ? `+${formatQuantity(value.slice(1))}`
    : formatQuantity(value);
}

export function InventoryDocumentsTable({
  card,
  loading,
  opening,
  onOpen,
}: {
  card: InventoryItemAccountingCard | null;
  loading: boolean;
  opening: boolean;
  onOpen: (document: InventoryItemCardDocument) => void;
}) {
  return (
    <DataTable
      ariaLabel="Документи номенклатури"
      columns={[
        { label: 'Дата і час' },
        { label: 'Документ' },
        { label: 'Тип' },
        { label: 'Звідки' },
        { label: 'Куди або кому' },
        { label: 'Кількість', numeric: true },
        { label: 'Статус' },
        { label: 'Вкладення' },
        { label: 'Дії', actions: true },
      ]}
      emptyMessage="Пов’язаних документів немає."
      loading={loading && !card}
      rows={(card?.documents.items ?? []).map((document) => [
        formatDateTime(document.occurredAt),
        document.title,
        document.typeLabel,
        document.from,
        document.to,
        formatQuantity(document.quantity),
        <StatusBadge
          key="status"
          tone={
            document.statusLabel === 'Проведено'
              ? 'success'
              : document.statusLabel === 'Скасовано'
                ? 'warning'
                : 'neutral'
          }
        >
          {document.statusLabel}
        </StatusBadge>,
        <AttachmentList document={document} key="attachments" />,
        <Button
          disabled={opening}
          key="open"
          size="compact"
          variant="outline"
          type="button"
          onClick={() => onOpen(document)}
        >
          Відкрити
        </Button>,
      ])}
    />
  );
}

function AttachmentList({ document }: { document: InventoryItemCardDocument }) {
  if (!document.attachments.length || document.kind !== 'STOCK_DOCUMENT') {
    return '—';
  }
  return (
    <div className="grid gap-1">
      {document.attachments.map((attachment) => (
        <a
          className="max-w-48 truncate text-[var(--color-primary)] underline"
          href={stockDocumentsService.attachmentDownloadUrl(
            document.id,
            attachment.id,
          )}
          key={attachment.id}
          title={attachment.originalFileName}
        >
          {attachment.originalFileName}
        </a>
      ))}
    </div>
  );
}
