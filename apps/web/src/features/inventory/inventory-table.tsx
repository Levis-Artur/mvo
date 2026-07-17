import type { InventoryItem } from '@/lib/types';
import { Button, DataTable, StatusBadge } from '@/components/ui';
import { formatQuantity } from './quantity-format';
import { inventoryItemStatuses } from './inventory-model';

export function InventoryTable({
  items,
  loading,
  canEdit,
  canDelete,
  onView,
  onEdit,
  onToggleArchive,
  onDelete,
}: {
  items: InventoryItem[];
  loading: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onView: (item: InventoryItem) => void;
  onEdit: (item: InventoryItem) => void;
  onToggleArchive: (item: InventoryItem) => void;
  onDelete: (item: InventoryItem) => void;
}) {
  return (
    <DataTable
      ariaLabel="Довідник номенклатури"
      columns={[
        { label: 'Код' },
        { label: 'Назва' },
        { label: 'Одиниця' },
        { label: 'Активність' },
        { label: 'Перевірка' },
        { label: 'Використання' },
        { label: 'МВО із залишком', numeric: true },
        { label: 'Загальний залишок', numeric: true },
        { label: 'Створено' },
        { label: 'Дії', actions: true },
      ]}
      emptyMessage="Номенклатуру за вказаними фільтрами не знайдено."
      loading={loading}
      rows={items.map((item) => {
        const statuses = inventoryItemStatuses(item);
        return [
          <span className="font-mono font-semibold" key="code">{item.externalCode}</span>,
          <Button
            variant="link"
            key="name"
            type="button"
            onClick={() => onView(item)}
          >
            {item.name}
          </Button>,
          item.unitOfMeasure ?? '—',
          <StatusBadge key="active" tone={item.isActive ? 'success' : 'neutral'}>
            {statuses.active}
          </StatusBadge>,
          <StatusBadge
            key="review"
            tone={item.reviewStatus === 'NEEDS_REVIEW' ? 'warning' : 'success'}
          >
            {statuses.needsReview}
          </StatusBadge>,
          <StatusBadge key="used" tone={statuses.used ? 'info' : 'neutral'}>
            {statuses.used ? 'Використовується в операціях' : 'Не використовується'}
          </StatusBadge>,
          item.responsiblePersonsCount ?? 0,
          formatQuantity(item.totalQuantity ?? '0'),
          new Date(item.createdAt).toLocaleDateString('uk-UA'),
          <div className="flex min-w-48 flex-wrap gap-1" key="actions">
            <Button variant="ghost" type="button" onClick={() => onView(item)}>
              Переглянути
            </Button>
            {canEdit ? (
              <>
                <Button variant="ghost" type="button" onClick={() => onEdit(item)}>
                  Редагувати
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => onToggleArchive(item)}
                >
                  {item.isActive ? 'Архівувати' : 'Відновити'}
                </Button>
              </>
            ) : null}
            {canDelete ? (
              <Button variant="danger" type="button" onClick={() => onDelete(item)}>
                Видалити
              </Button>
            ) : null}
          </div>,
        ];
      })}
    />
  );
}
