import type { StockTransaction } from '@/lib/types';
import { Button, DataTable } from '@/components/ui';
import { formatQuantity } from './quantity-format';
import { transactionSource, transactionTypeLabel } from './transaction-model';

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
        ...(transactions.some((item) => item.type === 'ISSUE_OUT') ? [{ label: 'Не реалізовано', numeric: true }] : []),
        { label: 'Документ або імпорт' },
        { label: 'Дії', actions: true },
      ]}
      emptyMessage="Операцій за вказаними фільтрами не знайдено."
      loading={loading}
      responsiveMode="cards-wide"
      scrollMode="horizontal"
      rows={transactions.map((item) => [
        new Date(item.occurredAt).toLocaleString('uk-UA'),
        transactionTypeLabel(item.type),
        <span className="block max-w-56 break-words" key="person">{item.responsiblePerson.externalAccountingCode ?? 'Не вказано'} — {item.responsiblePerson.fullName}</span>,
        <span className="block max-w-64 break-words" key="item"><span className="font-mono">{item.inventoryItem.externalCode}</span> — {item.inventoryItem.name}</span>,
        formatQuantity(item.quantity),
        ...(transactions.some((transaction) => transaction.type === 'ISSUE_OUT') ? [item.type === 'ISSUE_OUT' ? formatQuantity(item.availableToRealize ?? item.quantity) : '—'] : []),
        <span className="block max-w-56 break-words" key="source">{transactionSource(item, false)}</span>,
        <Button key="action" variant="ghost" type="button" onClick={() => onOpen(item)}>Переглянути</Button>,
      ])}
    />
  );
}
