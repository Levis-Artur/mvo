'use client';

import { useEffect, useState } from 'react';
import { Button, Card, DataTable, ErrorState, StatusBadge } from '@/components/ui';
import { ReadOnlyDocumentDetails } from '@/features/stock-documents/read-only-document-details';
import { getErrorMessage } from '@/components/common';
import { formatQuantity } from '@/features/inventory/quantity-format';
import { transactionTypeLabel } from '@/features/inventory/transaction-model';
import { documentNumberLabel } from '@/features/stock-documents/stock-document-rules';
import { StockDocumentStatusBadge } from '@/features/stock-documents/stock-document-status-badge';
import type {
  AccountingCardDocument,
  ResponsiblePerson,
  ReadAccessMode,
  ResponsiblePersonAccountingCard,
  StockTransaction,
} from '@/lib/types';
import { responsiblePersonsService as apiClient } from './responsible-persons.service';

export function PersonStockTab({
  personId,
  onPresenceResolved,
}: {
  personId: string;
  onPresenceResolved?: (hasStock: boolean) => void;
}) {
  const [card, setCard] = useState<ResponsiblePersonAccountingCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    apiClient
      .responsiblePersonAccountingCard(personId)
      .then((result) => {
        if (!active) return;
        setCard(result);
        onPresenceResolved?.(
          result.directBalances.length > 0,
        );
      })
      .catch((reason: unknown) => {
        if (active) setError(getErrorMessage(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [onPresenceResolved, personId]);

  if (error) return <ErrorState message={error} />;

  const rows = card?.directBalances.map((balance) => [
    balance.inventoryItem.externalCode,
    balance.inventoryItem.name,
    formatQuantity(balance.quantity),
    formatQuantity(balance.unrealizedQuantity ?? '0'),
  ]) ?? [];

  return (
    <div className="grid gap-3">
      {card ? (
        <Card title="Поточний прямий залишок">
          <strong className="text-xl tabular-nums">
            {formatQuantity(card.totalDirectQuantity)}
          </strong>
        </Card>
      ) : null}
      <DataTable
        ariaLabel="Поточні прямі залишки МВО"
        columns={[
          { label: 'Код' },
          { label: 'Номенклатура' },
          { label: 'Залишок на складі', numeric: true },
          { label: 'Нереалізовано', numeric: true },
        ]}
        emptyMessage="Поточних залишків немає."
        loading={loading}
        rows={rows}
      />
    </div>
  );
}

export function PersonOperationsTab({ personId, accessMode, canViewDocuments = false, operationTarget }: { personId: string; accessMode?: ReadAccessMode; canViewDocuments?: boolean; operationTarget?: ResponsiblePerson }) {
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    setLoading(true);
    apiClient
      .getResponsiblePersonStockTransactions(personId, { limit: 50, accessMode })
      .then((response) => setTransactions(response.items))
      .catch((reason: unknown) => setError(getErrorMessage(reason)))
      .finally(() => setLoading(false));
  }, [personId, accessMode, revision]);

  if (error) return <ErrorState message={error} />;
  return (
    <>
    <DataTable
      ariaLabel="Останні операції МВО"
      columns={[
        { label: 'Дата' },
        { label: 'Операція' },
        { label: 'Номенклатура' },
        { label: 'Кількість', numeric: true },
        ...(transactions.some((transaction) => transaction.type === 'ISSUE_OUT') ? [{ label: 'Не реалізовано', numeric: true }] : []),
        { label: 'Джерело' },
        ...(canViewDocuments ? [{ label: 'Документ' }] : []),
      ]}
      emptyMessage="Операцій не знайдено."
      loading={loading}
      responsiveMode="cards-wide"
      rows={transactions.map((transaction) => [
        new Date(transaction.occurredAt).toLocaleDateString('uk-UA'),
        transactionTypeLabel(transaction.type),
        transaction.inventoryItem.name,
        formatQuantity(transaction.quantity),
        ...(transactions.some((item) => item.type === 'ISSUE_OUT') ? [transaction.type === 'ISSUE_OUT' ? formatQuantity(transaction.availableToRealize ?? transaction.quantity) : '—'] : []),
        transaction.sourceDocument ?? '—',
        ...(canViewDocuments ? [transaction.documentId ? <Button key="open" type="button" variant="outline" size="compact" onClick={() => setSelectedId(transaction.documentId!)}>Переглянути документ</Button> : '—'] : []),
      ])}
    />
    {selectedId ? <ReadOnlyDocumentDetails documentId={selectedId} operationTarget={operationTarget} onCompleted={() => setRevision((value) => value + 1)} onClose={() => setSelectedId(null)} /> : null}
    </>
  );
}

export function PersonTransfersTab({ personId, transfersOnly = false, canViewDocuments = false }: { personId: string; transfersOnly?: boolean; canViewDocuments?: boolean }) {
  const [revision, setRevision] = useState(0);
  const [documents, setDocuments] = useState<AccountingCardDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    apiClient
      .responsiblePersonAccountingCard(personId)
      .then((card) =>
        setDocuments(
          [...card.recentTransfers, ...(transfersOnly ? [] : card.recentIssues)].sort((left, right) =>
            right.documentDate.localeCompare(left.documentDate),
          ),
        ),
      )
      .catch((reason: unknown) => setError(getErrorMessage(reason)))
      .finally(() => setLoading(false));
  }, [personId, transfersOnly, revision]);

  if (error) return <ErrorState message={error} />;
  return (
    <>
    <DataTable
      ariaLabel={transfersOnly ? 'Останні передачі МВО' : 'Останні передачі та видачі МВО'}
      columns={[
        { label: 'Номер' },
        { label: 'Дата' },
        { label: 'Тип' },
        { label: 'Відправник' },
        { label: 'Одержувач' },
        { label: 'Статус' },
        ...(canViewDocuments ? [{ label: 'Документ' }] : []),
        ...(documents.some((document) => document.type === 'ISSUE') ? [
          { label: 'Видано', numeric: true }, { label: 'Не реалізовано', numeric: true },
        ] : []),
      ]}
      emptyMessage={transfersOnly ? 'Передач не знайдено.' : 'Передач і видач не знайдено.'}
      loading={loading}
      responsiveMode="cards-wide"
      rows={documents.map((document) => [
        documentNumberLabel(document.displayNumber),
        new Date(document.documentDate).toLocaleDateString('uk-UA'),
        document.type === 'ISSUE' ? (
          <StatusBadge key="issue" tone="warning">
            Видача
          </StatusBadge>
        ) : (
          <StatusBadge
            key="transfer"
            tone="info"
          >
            Передача
          </StatusBadge>
        ),
        document.sourceResponsiblePerson.fullName,
        document.destinationResponsiblePerson?.fullName ?? 'Зовнішній одержувач',
        <StockDocumentStatusBadge key="status" status={document.status} />,
        ...(canViewDocuments ? [<div key="document" className="flex flex-wrap gap-2">
          {document.hasAttachment ? <StatusBadge tone="info">Є документ</StatusBadge> : null}
          <Button type="button" variant="outline" size="compact" onClick={() => setSelectedId(document.id)}>Переглянути документ</Button>
        </div>] : []),
        ...(documents.some((item) => item.type === 'ISSUE') ? [
          document.type === 'ISSUE' ? document.lines.map((line) => formatQuantity(line.quantity)).join(', ') : '—',
          document.type === 'ISSUE' ? document.lines.map((line) => formatQuantity(line.availableToRealize ?? line.quantity)).join(', ') : '—',
        ] : []),
      ])}
    />
    {selectedId ? <ReadOnlyDocumentDetails documentId={selectedId} onCompleted={() => setRevision((value) => value + 1)} onClose={() => setSelectedId(null)} /> : null}
    </>
  );
}
