import type { InventoryItem } from '@/lib/types';
import { Button, Card, Modal, StatusBadge } from '@/components/ui';
import { formatQuantity } from './quantity-format';
import { inventoryItemStatuses } from './inventory-model';

export function InventoryItemDetailsModal({
  item,
  canEdit,
  onClose,
  onEdit,
}: {
  item: InventoryItem;
  canEdit: boolean;
  onClose: () => void;
  onEdit: () => void;
}) {
  const statuses = inventoryItemStatuses(item);
  return (
    <Modal
      footer={
        <>
          {canEdit ? <Button type="button" onClick={onEdit}>Редагувати</Button> : null}
          <Button variant="outline" type="button" onClick={onClose}>Закрити</Button>
        </>
      }
      onClose={onClose}
      size="large"
      title={`Номенклатура: ${item.externalCode}`}
    >
      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Основні дані">
          <dl className="grid gap-3">
            <Detail label="Код" value={item.externalCode} />
            <Detail label="Найменування" value={item.name} />
            <Detail label="Одиниця виміру" value={item.unitOfMeasure ?? '—'} />
            <Detail label="Категорія" value={item.category ?? '—'} />
            <Detail label="Опис" value={item.description ?? '—'} />
          </dl>
        </Card>
        <Card title="Облікові показники">
          <dl className="grid gap-3">
            <Detail
              label="Активність"
              value={
                <StatusBadge tone={item.isActive ? 'success' : 'neutral'}>
                  {statuses.active}
                </StatusBadge>
              }
            />
            <Detail
              label="Перевірка"
              value={
                <StatusBadge
                  tone={item.reviewStatus === 'NEEDS_REVIEW' ? 'warning' : 'success'}
                >
                  {statuses.needsReview}
                </StatusBadge>
              }
            />
            <Detail label="МВО із залишком" value={item.responsiblePersonsCount ?? 0} />
            <Detail
              label="Загальний залишок"
              value={formatQuantity(item.totalQuantity ?? '0')}
            />
            <Detail
              label="Створено"
              value={new Date(item.createdAt).toLocaleString('uk-UA')}
            />
          </dl>
        </Card>
      </div>
    </Modal>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-[var(--color-border-light)] pb-2">
      <dt className="text-xs font-semibold text-[var(--color-text-secondary)]">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
