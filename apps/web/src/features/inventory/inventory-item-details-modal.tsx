'use client';

import { useEffect, useMemo, useState } from 'react';
import type { InventoryItem, InventoryItemAccountingCard } from '@/lib/types';
import { Button, Card, DataTable, ErrorState, LoadingState, Modal, StatusBadge } from '@/components/ui';
import { getErrorMessage } from '@/components/common';
import { inventoryService } from './inventory.service';
import { formatQuantity } from './quantity-format';
import { documentNumberLabel } from '@/features/stock-documents/stock-document-rules';
import { transactionTypeLabel } from './transaction-model';

type CardTab = 'distribution' | 'documents' | 'transactions';

export function InventoryItemDetailsModal({ item, canEdit, onClose, onEdit }: {
  item: InventoryItem;
  canEdit: boolean;
  onClose: () => void;
  onEdit: () => void;
}) {
  const [card, setCard] = useState<InventoryItemAccountingCard | null>(null);
  const [tab, setTab] = useState<CardTab>('distribution');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    inventoryService.inventoryItemAccountingCard(item.id)
      .then((result) => { if (active) setCard(result); })
      .catch((reason: unknown) => { if (active) setError(getErrorMessage(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [item.id]);

  const owners = useMemo(() => card ? new Set([
    ...card.directBalances.map((row) => row.responsiblePerson.id),
    ...card.custodyBalances.map((row) => row.accountingOwner.id),
  ]).size : 0, [card]);
  const holders = useMemo(() => card ? new Set([
    ...card.directBalances.map((row) => row.responsiblePerson.id),
    ...card.custodyBalances.map((row) => row.custodian.id),
  ]).size : 0, [card]);

  return <Modal
    footer={<>{canEdit ? <Button type="button" onClick={onEdit}>Редагувати</Button> : null}<Button variant="outline" type="button" onClick={onClose}>Закрити</Button></>}
    onClose={onClose}
    size="large"
    title={`Картка номенклатури: ${item.externalCode}`}
  >
    <div className="grid min-w-0 gap-4">
      <Card title="Номенклатура">
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Detail label="Код" value={item.externalCode} />
          <Detail label="Назва" value={item.name} />
          <Detail label="Одиниця" value={item.unitOfMeasure ?? '—'} />
          <Detail label="Активність" value={<StatusBadge tone={item.isActive ? 'success' : 'neutral'}>{item.isActive ? 'Активна' : 'Архівна'}</StatusBadge>} />
        </dl>
      </Card>
      {loading ? <LoadingState label="Завантаження облікової картки…" /> : null}
      {error ? <ErrorState message={error} /> : null}
      {card ? <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Metric label="Безпосередньо у МВО" value={card.totals.directQuantity} />
          <Metric label="Закріплено за іншими" value={card.totals.assignedQuantity} />
          <Metric label="Разом під обліком" value={card.totals.totalAccountedQuantity} />
          <Metric label="Облікових власників" value={String(owners)} />
          <Metric label="Фактичних утримувачів" value={String(holders)} />
        </div>
        <nav aria-label="Розділи картки номенклатури" className="flex flex-wrap gap-2">
          <Tab active={tab === 'distribution'} label="Розподіл" onClick={() => setTab('distribution')} />
          <Tab active={tab === 'documents'} label="Документи" onClick={() => setTab('documents')} />
          <Tab active={tab === 'transactions'} label="Історія операцій" onClick={() => setTab('transactions')} />
        </nav>
        {tab === 'distribution' ? <DistributionTable card={card} /> : null}
        {tab === 'documents' ? <DataTable ariaLabel="Документи номенклатури" columns={[{ label: 'Номер' }, { label: 'Дата' }, { label: 'Тип' }, { label: 'Статус' }, { label: 'Відправник' }, { label: 'Одержувач' }, { label: 'Кількість', numeric: true }]} emptyMessage="Документів немає." rows={card.recentDocuments.map((document) => [documentNumberLabel(document.displayNumber), new Date(document.documentDate).toLocaleDateString('uk-UA'), document.type === 'ASSIGNMENT' ? 'Передача' : document.type === 'TRANSFER' ? 'Стара логіка' : 'Видача', document.status, document.sourceResponsiblePerson.fullName, document.destinationResponsiblePerson?.fullName ?? '—', formatQuantity(document.lines[0]?.quantity ?? '0')])} /> : null}
        {tab === 'transactions' ? <DataTable ariaLabel="Історія операцій номенклатури" columns={[{ label: 'Дата' }, { label: 'Тип' }, { label: 'Bucket' }, { label: 'Обліковий власник' }, { label: 'Від кого' }, { label: 'Кому' }, { label: 'Кількість', numeric: true }]} emptyMessage="Операцій немає." rows={card.recentTransactions.map((transaction) => [new Date(transaction.occurredAt).toLocaleString('uk-UA'), transactionTypeLabel(transaction.type), transaction.bucketKind ?? 'LEGACY', transaction.accountingOwner?.fullName ?? transaction.responsiblePerson.fullName, transaction.sourceCustodian?.fullName ?? '—', transaction.destinationCustodian?.fullName ?? '—', formatQuantity(transaction.quantity)])} /> : null}
      </> : null}
    </div>
  </Modal>;
}

function DistributionTable({ card }: { card: InventoryItemAccountingCard }) {
  return <DataTable ariaLabel="Розподіл номенклатури" columns={[{ label: 'Обліковий власник' }, { label: 'Фактичний утримувач' }, { label: 'Тип' }, { label: 'Кількість', numeric: true }, { label: 'Останній документ' }, { label: 'Дата' }]} rows={[
    ...card.directBalances.map((row) => {
      const latest = card.recentTransactions.find((transaction) =>
        (transaction.accountingOwner?.id ?? transaction.responsiblePerson.id) === row.responsiblePerson.id &&
        transaction.bucketKind !== 'ASSIGNED',
      );
      return [row.responsiblePerson.fullName, row.responsiblePerson.fullName, <StatusBadge key="direct" tone="success">DIRECT</StatusBadge>, formatQuantity(row.quantity), latest?.sourceDocument ?? latest?.documentId ?? '—', latest ? new Date(latest.occurredAt).toLocaleDateString('uk-UA') : '—'];
    }),
    ...card.custodyBalances.map((row) => {
      const latest = card.recentTransactions.find((transaction) => transaction.accountingOwner?.id === row.accountingOwner.id && transaction.destinationCustodian?.id === row.custodian.id);
      return [row.accountingOwner.fullName, row.custodian.fullName, <StatusBadge key="assigned" tone="info">ASSIGNED</StatusBadge>, formatQuantity(row.quantity), latest?.sourceDocument ?? latest?.documentId ?? '—', latest ? new Date(latest.occurredAt).toLocaleDateString('uk-UA') : '—'];
    }),
  ]} />;
}

function Tab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <Button aria-current={active ? 'page' : undefined} variant={active ? 'primary' : 'outline'} type="button" onClick={onClick}>{label}</Button>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <Card title={label}><p className="text-xl font-bold tabular-nums">{formatQuantity(value)}</p></Card>;
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="grid gap-1"><dt className="text-xs font-semibold text-[var(--color-text-secondary)]">{label}</dt><dd>{value}</dd></div>;
}
