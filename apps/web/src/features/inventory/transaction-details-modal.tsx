import type { StockTransaction } from '@/lib/types';
import { Button, Modal, StatusBadge } from '@/components/ui';
import { formatQuantity } from './quantity-format';
import { transactionDirection, transactionSource, transactionTypeLabel } from './transaction-model';

export function TransactionDetailsModal({ transaction, onClose }: { transaction: StockTransaction; onClose: () => void }) {
  return (
    <Modal footer={<Button variant="outline" type="button" onClick={onClose}>Закрити</Button>} onClose={onClose} size="large" title="Деталі операції">
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <Detail label="ID"><span className="break-all font-mono">{transaction.id}</span></Detail>
        <Detail label="Дата і час">{new Date(transaction.occurredAt).toLocaleString('uk-UA')}</Detail>
        <Detail label="Тип">{transactionTypeLabel(transaction.type)}</Detail>
        <Detail label="Статус"><StatusBadge tone="success">Проведено</StatusBadge></Detail>
        <Detail label="Напрямок">{transactionDirection(transaction.type)}</Detail>
        <Detail label="Кількість">{formatQuantity(transaction.quantity)}</Detail>
        <Detail label="МВО">{transaction.responsiblePerson.personnelNumber} — {transaction.responsiblePerson.fullName}</Detail>
        <Detail label="Номенклатура">{transaction.inventoryItem.externalCode} — {transaction.inventoryItem.name}</Detail>
        <Detail label="Було">{formatQuantity(transaction.balanceBefore)}</Detail>
        <Detail label="Стало">{formatQuantity(transaction.balanceAfter)}</Detail>
        <Detail label="Документ або імпорт">{transactionSource(transaction)}</Detail>
        <Detail label="Коментар">{transaction.comment || '—'}</Detail>
        <Detail label="Користувач">Не надається API</Detail>
        <Detail label="requestId">Не надається API</Detail>
        <Detail label="Створено">{new Date(transaction.createdAt).toLocaleString('uk-UA')}</Detail>
      </dl>
    </Modal>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0"><dt className="font-semibold text-[var(--color-text-secondary)]">{label}</dt><dd className="mt-1 break-words">{children}</dd></div>;
}
