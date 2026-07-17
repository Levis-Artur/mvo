'use client';

import { useEffect, useState } from 'react';
import { responsiblePersonsService as apiClient } from './responsible-persons.service';
import type { StockBalance, StockDocument, StockTransaction } from '@/lib/types';
import { DataTable, ErrorState } from '@/components/ui';
import { getErrorMessage } from '@/components/common';
import { transactionTypeLabel } from '@/features/inventory/transaction-model';
import { StockDocumentStatusBadge } from '@/features/stock-documents/stock-document-status-badge';

export function PersonStockTab({
  personId,
  onPresenceResolved,
}: {
  personId: string;
  onPresenceResolved?: (hasStock: boolean) => void;
}) {
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    apiClient
      .getResponsiblePersonStockBalances(personId, { limit: 50 })
      .then((response) => {
        const positive = response.items.filter(
          (balance) => Number(balance.quantity) > 0,
        );
        setBalances(positive);
        onPresenceResolved?.(positive.length > 0);
      })
      .catch((reason: unknown) => setError(getErrorMessage(reason)))
      .finally(() => setLoading(false));
  }, [onPresenceResolved, personId]);

  if (error) return <ErrorState message={error} />;

  return (
    <DataTable
      ariaLabel="Позитивні залишки МВО"
      columns={[
        { label: 'Код' },
        { label: 'Найменування' },
        { label: 'Кількість', numeric: true },
        { label: 'Одиниця' },
      ]}
      emptyMessage="Позитивних залишків немає."
      loading={loading}
      rows={balances.map((balance) => [
        balance.inventoryItem.externalCode,
        balance.inventoryItem.name,
        balance.quantity,
        balance.inventoryItem.unitOfMeasure ?? '—',
      ])}
    />
  );
}

export function PersonOperationsTab({ personId }: { personId: string }) {
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    apiClient
      .getResponsiblePersonStockTransactions(personId, { limit: 50 })
      .then((response) => setTransactions(response.items))
      .catch((reason: unknown) => setError(getErrorMessage(reason)))
      .finally(() => setLoading(false));
  }, [personId]);

  if (error) return <ErrorState message={error} />;

  return (
    <DataTable
      ariaLabel="Останні операції МВО"
      columns={[
        { label: 'Дата' },
        { label: 'Тип' },
        { label: 'Позиція' },
        { label: 'Кількість', numeric: true },
        { label: 'Було', numeric: true },
        { label: 'Стало', numeric: true },
        { label: 'Джерело' },
      ]}
      emptyMessage="Операцій не знайдено."
      loading={loading}
      rows={transactions.map((transaction) => [
        new Date(transaction.occurredAt).toLocaleDateString('uk-UA'),
        transactionTypeLabel(transaction.type),
        transaction.inventoryItem.name,
        transaction.quantity,
        transaction.balanceBefore,
        transaction.balanceAfter,
        transaction.sourceDocument ?? '—',
      ])}
    />
  );
}

export function PersonTransfersTab({ personId }: { personId: string }) {
  const [documents, setDocuments] = useState<StockDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiClient.stockDocuments({
        sourceResponsiblePersonId: personId,
        page: 1,
        limit: 20,
      }),
      apiClient.stockDocuments({
        destinationResponsiblePersonId: personId,
        page: 1,
        limit: 20,
      }),
    ])
      .then(([outgoing, incoming]) => {
        const unique = new Map<string, StockDocument>();
        [...outgoing.items, ...incoming.items].forEach((document) =>
          unique.set(document.id, document),
        );
        setDocuments(
          [...unique.values()].sort((left, right) =>
            right.documentDate.localeCompare(left.documentDate),
          ),
        );
      })
      .catch((reason: unknown) => setError(getErrorMessage(reason)))
      .finally(() => setLoading(false));
  }, [personId]);

  if (error) return <ErrorState message={error} />;

  return (
    <DataTable
      ariaLabel="Останні передачі МВО"
      columns={[
        { label: 'Номер' },
        { label: 'Дата' },
        { label: 'Напрямок' },
        { label: 'Контрагент' },
        { label: 'Статус' },
      ]}
      emptyMessage="Передач не знайдено."
      loading={loading}
      rows={documents.map((document) => {
        const outgoing = document.sourceResponsiblePersonId === personId;
        const counterpart = outgoing
          ? document.destinationResponsiblePerson
          : document.sourceResponsiblePerson;
        return [
          document.documentNumber,
          new Date(document.documentDate).toLocaleDateString('uk-UA'),
          outgoing ? 'Передано' : 'Отримано',
          counterpart
            ? [
                counterpart.lastName,
                counterpart.firstName,
                counterpart.middleName,
              ]
                .filter(Boolean)
                .join(' ')
            : document.recipientName ?? '—',
          <StockDocumentStatusBadge key="status" status={document.status} />,
        ];
      })}
    />
  );
}
