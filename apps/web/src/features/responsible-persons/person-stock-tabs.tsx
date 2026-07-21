'use client';

import { useEffect, useState } from 'react';
import { responsiblePersonsService as apiClient } from './responsible-persons.service';
import type { AccountingCardDocument, ResponsiblePersonAccountingCard, StockTransaction } from '@/lib/types';
import { Button, Card, DataTable, ErrorState, StatusBadge } from '@/components/ui';
import { getErrorMessage } from '@/components/common';
import { transactionTypeLabel } from '@/features/inventory/transaction-model';
import { StockDocumentStatusBadge } from '@/features/stock-documents/stock-document-status-badge';
import { documentNumberLabel } from '@/features/stock-documents/stock-document-rules';
import { formatQuantity } from '@/features/inventory/quantity-format';

type PersonStockSection = 'direct' | 'assigned-out' | 'assigned-to-me';

export function PersonStockTab({ personId, onPresenceResolved }: {
  personId: string;
  onPresenceResolved?: (hasStock: boolean) => void;
}) {
  const [card, setCard] = useState<ResponsiblePersonAccountingCard | null>(null);
  const [section, setSection] = useState<PersonStockSection>('direct');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    apiClient.responsiblePersonAccountingCard(personId)
      .then((result) => {
        if (!active) return;
        setCard(result);
        onPresenceResolved?.(result.directBalances.length > 0 || result.assignedToOthers.length > 0);
      })
      .catch((reason: unknown) => { if (active) setError(getErrorMessage(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [onPresenceResolved, personId]);

  if (error) return <ErrorState message={error} />;
  const rows = !card ? [] : section === 'direct'
    ? card.directBalances.map((balance) => [balance.inventoryItem.externalCode, balance.inventoryItem.name, 'Власний прямий баланс', 'Цей МВО', formatQuantity(balance.quantity)])
    : (section === 'assigned-out' ? card.assignedToOthers : card.assignedToMe).map((balance) => [balance.inventoryItem.externalCode, balance.inventoryItem.name, balance.accountingOwner.fullName, balance.custodian.fullName, formatQuantity(balance.quantity)]);

  return <div className="grid gap-3">
    {card ? <div className="grid gap-3 sm:grid-cols-2"><Card title="Разом під обліком"><strong className="text-xl tabular-nums">{formatQuantity(card.totalOwnedAccountingQuantity)}</strong></Card><Card title="Фактично утримує"><strong className="text-xl tabular-nums">{formatQuantity(card.totalPhysicallyHeldQuantity)}</strong></Card></div> : null}
    <nav aria-label="Залишки картки МВО" className="flex flex-wrap gap-2">
      <SectionButton active={section === 'direct'} onClick={() => setSection('direct')}>Власний прямий баланс</SectionButton>
      <SectionButton active={section === 'assigned-out'} onClick={() => setSection('assigned-out')}>Власне майно, закріплене за іншими</SectionButton>
      <SectionButton active={section === 'assigned-to-me'} onClick={() => setSection('assigned-to-me')}>Чуже майно, закріплене за цим МВО</SectionButton>
    </nav>
    <DataTable ariaLabel="Облікова картка МВО" columns={[{ label: 'Код' }, { label: 'Номенклатура' }, { label: 'Обліковий власник' }, { label: 'Фактичний утримувач' }, { label: 'Кількість', numeric: true }]} emptyMessage="У цьому розділі майна немає." loading={loading} rows={rows} />
  </div>;
}

function SectionButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return <Button aria-current={active ? 'page' : undefined} variant={active ? 'primary' : 'outline'} type="button" onClick={onClick}>{children}</Button>;
}

export function PersonOperationsTab({ personId }: { personId: string }) {
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    apiClient.getResponsiblePersonStockTransactions(personId, { limit: 50 })
      .then((response) => setTransactions(response.items))
      .catch((reason: unknown) => setError(getErrorMessage(reason)))
      .finally(() => setLoading(false));
  }, [personId]);

  if (error) return <ErrorState message={error} />;
  return <DataTable ariaLabel="Останні операції МВО" columns={[{ label: 'Дата' }, { label: 'Тип' }, { label: 'Позиція' }, { label: 'Bucket' }, { label: 'Кількість', numeric: true }, { label: 'Було', numeric: true }, { label: 'Стало', numeric: true }, { label: 'Джерело' }]} emptyMessage="Операцій не знайдено." loading={loading} rows={transactions.map((transaction) => [new Date(transaction.occurredAt).toLocaleDateString('uk-UA'), transactionTypeLabel(transaction.type), transaction.inventoryItem.name, transaction.bucketKind ?? 'LEGACY', formatQuantity(transaction.quantity), formatQuantity(transaction.balanceBefore), formatQuantity(transaction.balanceAfter), transaction.sourceDocument ?? '—'])} />;
}

export function PersonTransfersTab({ personId }: { personId: string }) {
  const [documents, setDocuments] = useState<AccountingCardDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    apiClient.responsiblePersonAccountingCard(personId)
      .then((card) => setDocuments([...card.recentAssignments, ...card.recentIssues].sort((left, right) => right.documentDate.localeCompare(left.documentDate))))
      .catch((reason: unknown) => setError(getErrorMessage(reason)))
      .finally(() => setLoading(false));
  }, [personId]);

  if (error) return <ErrorState message={error} />;
  return <DataTable ariaLabel="Останні передачі та видачі МВО" columns={[{ label: 'Номер' }, { label: 'Дата' }, { label: 'Тип' }, { label: 'Відправник' }, { label: 'Одержувач' }, { label: 'Статус' }]} emptyMessage="Передач і видач не знайдено." loading={loading} rows={documents.map((document) => [documentNumberLabel(document.displayNumber), new Date(document.documentDate).toLocaleDateString('uk-UA'), document.type === 'ASSIGNMENT' ? <StatusBadge key="assignment" tone="info">Передача</StatusBadge> : <StatusBadge key="issue" tone="warning">Видача</StatusBadge>, document.sourceResponsiblePerson.fullName, document.destinationResponsiblePerson?.fullName ?? 'Зовнішній одержувач', <StockDocumentStatusBadge key="status" status={document.status} />])} />;
}
