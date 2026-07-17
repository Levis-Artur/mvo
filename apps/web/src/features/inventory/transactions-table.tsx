import type { StockTransaction } from '@/lib/types';
import { Button, DataTable, StatusBadge } from '@/components/ui';
import { formatQuantity } from './quantity-format';
import { transactionDirection, transactionSource, transactionTypeLabel } from './transaction-model';

export function TransactionsTable({ transactions, loading, onOpen }: {
  transactions: StockTransaction[];
  loading: boolean;
  onOpen: (transaction: StockTransaction) => void;
}) {
  return (
    <DataTable
      ariaLabel="Журнал операцій із залишками"
      columns={[
        { label: 'Дата та час' }, { label: 'Тип' }, { label: 'МВО' },
        { label: 'Номенклатура' }, { label: 'Кількість', numeric: true },
        { label: 'Напрямок' }, { label: 'Документ або імпорт' },
        { label: 'Користувач' }, { label: 'requestId' }, { label: 'Статус' },
        { label: 'Дії', actions: true },
      ]}
      emptyMessage="Операцій за вказаними фільтрами не знайдено."
      loading={loading}
      rows={transactions.map((item) => [
        new Date(item.occurredAt).toLocaleString('uk-UA'),
        transactionTypeLabel(item.type),
        <span className="block max-w-56 break-words" key="person">{item.responsiblePerson.personnelNumber} — {item.responsiblePerson.fullName}</span>,
        <span className="block max-w-64 break-words" key="item"><span className="font-mono">{item.inventoryItem.externalCode}</span> — {item.inventoryItem.name}</span>,
        formatQuantity(item.quantity),
        transactionDirection(item.type),
        <span className="block max-w-56 break-words" key="source">{transactionSource(item)}</span>,
        <span key="user" title="Автор операції не повертається поточним API">Не надається API</span>,
        <span key="request" title="requestId не повертається поточним API">Не надається API</span>,
        <StatusBadge key="status" tone="success">Проведено</StatusBadge>,
        <Button key="action" variant="ghost" type="button" onClick={() => onOpen(item)}>Переглянути</Button>,
      ])}
    />
  );
}
