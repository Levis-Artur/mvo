import { DataTable, StatusBadge } from '@/components/ui';
import type { StockBalance } from '@/lib/types';
import { formatQuantity, isPositiveQuantity } from './quantity-format';

export function StockBalancesTable({
  balances,
  loading,
}: {
  balances: StockBalance[];
  loading: boolean;
}) {
  return (
    <DataTable
      ariaLabel="Поточні залишки майна"
      columns={[
        { label: 'МВО' },
        { label: 'Код' },
        { label: 'Найменування' },
        { label: 'Одиниця' },
        { label: 'Поточна кількість', numeric: true },
        { label: 'Остання операція' },
        { label: 'Оновлено' },
      ]}
      emptyMessage="Залишків за вказаними фільтрами не знайдено."
      loading={loading}
      rows={balances.map((balance) => {
        const quantity = formatQuantity(balance.quantity);
        return [
          <span key="person">
            <strong className="block">{balance.responsiblePerson.fullName}</strong>
            <small className="text-[var(--color-text-secondary)]">
              {balance.responsiblePerson.personnelNumber}
            </small>
          </span>,
          <span className="font-mono" key="code">
            {balance.inventoryItem.externalCode}
          </span>,
          balance.inventoryItem.name,
          balance.inventoryItem.unitOfMeasure ?? '—',
          <StatusBadge
            key="available"
            tone={isPositiveQuantity(balance.quantity) ? 'success' : 'warning'}
          >
            {quantity}
          </StatusBadge>,
          <span key="operation" title="Тип останньої операції не повертається API залишків">
            Зміна залишку
          </span>,
          new Date(balance.updatedAt).toLocaleString('uk-UA'),
        ];
      })}
    />
  );
}
