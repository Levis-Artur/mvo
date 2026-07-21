import { formatQuantity } from '@/features/inventory/quantity-format';
import type { MyPropertyItem } from '@/lib/types';
import { Button, Card, Modal } from '@/components/ui';

export function MyPropertyDetailsModal({ item, onClose }: { item: MyPropertyItem; onClose: () => void }) {
  return <Modal
    footer={<Button variant="outline" type="button" onClick={onClose}>Закрити</Button>}
    onClose={onClose}
    size="small"
    title="Передане майно"
  >
    <Card title={item.inventoryItem.name}>
      <dl className="detail-list">
        <Detail label="Код">{item.inventoryItem.externalCode}</Detail>
        <Detail label="Одиниця">{item.inventoryItem.unitOfMeasure ?? '—'}</Detail>
        <Detail label="Кількість">{formatQuantity(item.quantity)}</Detail>
        <Detail label="У кого знаходиться">{item.currentCustodian.personnelNumber} — {item.currentCustodian.fullName}</Detail>
        <Detail label="Дата передачі">{new Date(item.updatedAt).toLocaleDateString('uk-UA')}</Detail>
      </dl>
    </Card>
  </Modal>;
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt>{label}</dt><dd>{children}</dd></div>;
}
